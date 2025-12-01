import {
	type NextResponse,
	createNextRequest,
	getRewriteUrl,
	isNextContinue,
	isRewriteResponse,
} from '@foxen/core';
import { createNextFetchEvent } from './event.js';
import type { MiddlewareExecutorOptions, MiddlewareHandler, MiddlewareResult } from './types.js';

/**
 * Execute middleware and process the result
 *
 * Middleware can:
 * 1. Return nothing (continue to route handler)
 * 2. Return a Response (stop and return that response)
 * 3. Return NextResponse.next() (continue with optional modifications)
 * 4. Return NextResponse.redirect() (redirect to another URL)
 * 5. Return NextResponse.rewrite() (internally rewrite to another path)
 *
 * @param request - The incoming request
 * @param handler - The middleware handler function
 * @param options - Execution options
 * @returns Middleware result with continuation status and optional response
 *
 * @example
 * ```ts
 * const result = await executeMiddleware(request, middleware.handler, {
 *   basePath: '/api',
 * });
 *
 * if (!result.continue) {
 *   return result.response;
 * }
 *
 * if (result.rewriteTo) {
 *   // Handle internal rewrite
 *   request = new Request(result.rewriteTo, request);
 * }
 *
 * // Continue to route handler
 * ```
 */
export async function executeMiddleware(
	request: Request,
	handler: MiddlewareHandler,
	options: MiddlewareExecutorOptions = {},
): Promise<MiddlewareResult> {
	const { basePath, i18n, continueOnError = false, verbose = false } = options;

	try {
		// Create NextRequest from incoming request
		const nextRequest = createNextRequest(request, {
			nextConfig: {
				basePath,
				i18n,
			},
		});

		// Create NextFetchEvent
		const event = createNextFetchEvent();

		if (verbose) {
			console.log(`[foxen:middleware] Executing middleware for ${request.url}`);
		}

		// Call the middleware handler
		const result = await handler(nextRequest, event);

		// Wait for any waitUntil promises
		await event.waitForAll();

		// Process the result
		return parseMiddlewareResponse(result, request, verbose);
	} catch (error) {
		console.error('[foxen:middleware] Middleware error:', error);

		if (continueOnError) {
			return { continue: true };
		}

		return {
			continue: false,
			response: new Response(
				JSON.stringify({
					error: 'Middleware Error',
					message: error instanceof Error ? error.message : 'Unknown error',
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				},
			),
		};
	}
}

/**
 * Parse middleware response and convert to MiddlewareResult
 *
 * @param response - The response from middleware
 * @param originalRequest - The original request
 * @param verbose - Whether to log verbose output
 * @returns Parsed middleware result
 */
export function parseMiddlewareResponse(
	// biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
	response: Response | NextResponse | undefined | null | void,
	originalRequest: Request,
	verbose = false,
): MiddlewareResult {
	// No result = continue
	if (response === undefined || response === null) {
		if (verbose) {
			console.log('[foxen:middleware] No response, continuing');
		}
		return { continue: true };
	}

	// Check if it's not a Response at all
	if (!(response instanceof Response)) {
		if (verbose) {
			console.log('[foxen:middleware] Non-Response result, continuing');
		}
		return { continue: true };
	}

	// Check for NextResponse.rewrite()
	if (isRewriteResponse(response)) {
		const rewriteUrl = getRewriteUrl(response);
		if (verbose) {
			console.log(`[foxen:middleware] Rewrite to: ${rewriteUrl}`);
		}

		// Extract response headers (cookies, etc.)
		const responseHeaders = extractResponseHeaders(response);

		return {
			continue: true,
			rewriteTo: rewriteUrl ?? undefined,
			responseHeaders,
		};
	}

	// Check for NextResponse.next()
	if (isNextContinue(response)) {
		if (verbose) {
			console.log('[foxen:middleware] NextResponse.next(), continuing');
		}

		// Extract request modifications
		const modifiedRequest = extractRequestModifications(response, originalRequest);

		// Extract response headers
		const responseHeaders = extractResponseHeaders(response);

		return {
			continue: true,
			request: modifiedRequest,
			responseHeaders,
		};
	}

	// Check for redirect (3xx status with Location header)
	if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
		if (verbose) {
			console.log(
				`[foxen:middleware] Redirect to: ${response.headers.get('location')} (${response.status})`,
			);
		}

		// Clone response and add any cookies
		const redirectResponse = new Response(null, {
			status: response.status,
			headers: response.headers,
		});

		return {
			continue: false,
			response: redirectResponse,
		};
	}

	// Regular response - stop and return it
	if (verbose) {
		console.log(`[foxen:middleware] Response with status ${response.status}`);
	}

	return {
		continue: false,
		response,
	};
}

/**
 * Extract request modifications from middleware response headers
 *
 * Middleware can set request headers using x-middleware-request-* headers
 */
function extractRequestModifications(
	response: Response,
	originalRequest: Request,
): Request | undefined {
	const overrideHeadersValue = response.headers.get('x-middleware-override-headers');

	if (!overrideHeadersValue) {
		return undefined;
	}

	const headersToModify = overrideHeadersValue.split(',').map((h) => h.trim());
	const newHeaders = new Headers(originalRequest.headers);

	for (const headerName of headersToModify) {
		const value = response.headers.get(`x-middleware-request-${headerName}`);
		if (value !== null) {
			newHeaders.set(headerName, value);
		}
	}

	// Create new request with modified headers
	return new Request(originalRequest.url, {
		method: originalRequest.method,
		headers: newHeaders,
		body: originalRequest.body,
		// @ts-expect-error - duplex is required for streaming bodies
		duplex: originalRequest.body ? 'half' : undefined,
	});
}

/**
 * Extract response headers that should be forwarded
 *
 * This includes cookies set by middleware
 */
function extractResponseHeaders(response: Response): Headers | undefined {
	const headers = new Headers();
	let hasHeaders = false;

	// Forward Set-Cookie headers
	const setCookieHeader = response.headers.get('x-middleware-set-cookie');
	if (setCookieHeader) {
		for (const cookie of setCookieHeader.split(',')) {
			headers.append('Set-Cookie', cookie.trim());
		}
		hasHeaders = true;
	}

	// Also check for regular set-cookie
	const setCookies = response.headers.getSetCookie?.() || [];
	for (const cookie of setCookies) {
		headers.append('Set-Cookie', cookie);
		hasHeaders = true;
	}

	return hasHeaders ? headers : undefined;
}

/**
 * Create a response with applied middleware headers
 *
 * This helper applies any response headers from middleware
 * to the final response from the route handler.
 *
 * @param response - The response from the route handler
 * @param middlewareResult - The middleware result
 * @returns Response with middleware headers applied
 */
export function applyMiddlewareHeaders(
	response: Response,
	middlewareResult: MiddlewareResult,
): Response {
	if (!middlewareResult.responseHeaders) {
		return response;
	}

	// Clone the response to modify headers
	const newHeaders = new Headers(response.headers);

	for (const [key, value] of middlewareResult.responseHeaders) {
		if (key.toLowerCase() === 'set-cookie') {
			newHeaders.append(key, value);
		} else {
			newHeaders.set(key, value);
		}
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders,
	});
}

/**
 * Create a rewritten request for internal rewrites
 *
 * @param originalRequest - The original request
 * @param rewriteTo - The URL to rewrite to
 * @returns New request with updated URL
 */
export function createRewrittenRequest(originalRequest: Request, rewriteTo: string): Request {
	// Parse the rewrite URL
	const rewriteUrl = new URL(rewriteTo, originalRequest.url);

	return new Request(rewriteUrl.toString(), {
		method: originalRequest.method,
		headers: originalRequest.headers,
		body: originalRequest.body,
		// @ts-expect-error - duplex is required for streaming bodies
		duplex: originalRequest.body ? 'half' : undefined,
	});
}
