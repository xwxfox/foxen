import type { HttpMethod, NextRequest, NextRouteHandler } from '@foxen/core';
import {
	createNextRequest as createNextRequestFromContext,
	createParamsPromise,
	getFoxenContext,
	normalizeParams,
} from './context.js';
import type {
	ElysiaContext,
	ElysiaHandler,
	HandlerAdapter,
	ParamInfo,
	RouteInfo,
	RuntimeContext,
} from './types.js';

/**
 * Creates a NextRequest from Elysia context with proper handling.
 */
function createNextRequest(ctx: ElysiaContext, basePath?: string): NextRequest {
	// Check if middleware modified the request
	const foxenCtx = getFoxenContext(ctx) as RuntimeContext;
	const request = foxenCtx._modifiedRequest ?? ctx.request;

	// If Elysia has parsed the body (from schema validation),
	// we need to create a new Request with that body
	if (ctx.body !== undefined && ctx.body !== null) {
		const headers = new Headers(request.headers);
		const bodyRequest = new Request(request.url, {
			method: request.method,
			headers,
			body: JSON.stringify(ctx.body),
		});
		return createNextRequestFromContext(bodyRequest, {
			basePath: basePath ?? foxenCtx._basePath,
			ip: foxenCtx._ip,
			geo: foxenCtx._geo,
		});
	}

	return createNextRequestFromContext(request, {
		basePath: basePath ?? foxenCtx._basePath,
		ip: foxenCtx._ip,
		geo: foxenCtx._geo,
	});
}

/**
 * Creates Next.js style params context.
 * Next.js 15+ uses async params via Promise.
 */
function createNextParams(
	elysiaParams: Record<string, string | string[]> | undefined,
	paramInfo: ParamInfo[],
): Promise<Record<string, string | string[]>> & Record<string, string | string[]> {
	const nextParams: Record<string, string | string[]> = {};

	if (!elysiaParams) {
		return createParamsPromise(nextParams);
	}

	// Find catch-all param name
	const catchAllParam = paramInfo.find((p) => p.isCatchAll);
	const catchAllName = catchAllParam?.name;

	// Normalize params (handle * -> slug conversion, etc.)
	const normalized = normalizeParams(elysiaParams, catchAllName);

	// Copy normalized params
	for (const [key, value] of Object.entries(normalized)) {
		nextParams[key] = value;
	}

	// Handle optional catch-all with empty value
	if (catchAllParam?.isOptional && nextParams[catchAllParam.name] === undefined) {
		nextParams[catchAllParam.name] = [];
	}

	// Copy regular params that weren't normalized
	for (const param of paramInfo) {
		if (
			!param.isCatchAll &&
			elysiaParams[param.name] !== undefined &&
			nextParams[param.name] === undefined
		) {
			nextParams[param.name] = elysiaParams[param.name] as string | string[];
		}
	}

	return createParamsPromise(nextParams);
}

/**
 * Default adapter that wraps Next.js handlers for Elysia.
 *
 * Features:
 * - Converts Elysia context to NextRequest
 * - Handles params as Promise (Next.js 15+ style)
 * - Respects middleware modifications
 * - Proper error handling
 */
export const defaultAdapter: HandlerAdapter = (
	handler: NextRouteHandler,
	routeInfo: RouteInfo,
	_method: HttpMethod,
): ElysiaHandler => {
	return async (ctx: ElysiaContext): Promise<Response> => {
		const request = createNextRequest(ctx);
		const params = createNextParams(ctx.params, routeInfo.params);

		try {
			const response = await handler(request, { params });

			// Handle different response types
			if (response instanceof Response) {
				return response;
			}

			// If handler returned a plain object, convert to JSON
			if (response !== null && response !== undefined) {
				return new Response(JSON.stringify(response), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// No content
			return new Response(null, { status: 204 });
		} catch (error) {
			console.error(`[foxen] Error in route ${routeInfo.elysiaPath}:`, error);
			return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	};
};

/**
 * Adapter for handlers that don't need params (simpler routes).
 */
export const simpleAdapter: HandlerAdapter = (
	handler: NextRouteHandler,
	_routeInfo: RouteInfo,
	_method: HttpMethod,
): ElysiaHandler => {
	return async (ctx: ElysiaContext): Promise<Response> => {
		try {
			const request = createNextRequest(ctx);
			const response = await handler(request);

			if (response instanceof Response) {
				return response;
			}

			if (response !== null && response !== undefined) {
				return new Response(JSON.stringify(response), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			return new Response(null, { status: 204 });
		} catch (error) {
			console.error('[foxen] Error in handler:', error);
			return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	};
};

/**
 * Creates an adapter with custom middleware-like behavior.
 */
export function createMiddlewareAdapter(
	beforeHandler?: (ctx: ElysiaContext, routeInfo: RouteInfo) => Promise<undefined | Response>,
	afterHandler?: (
		response: Response,
		ctx: ElysiaContext,
		routeInfo: RouteInfo,
	) => Promise<Response>,
): HandlerAdapter {
	return (handler: NextRouteHandler, routeInfo: RouteInfo, _method: HttpMethod): ElysiaHandler => {
		return async (ctx: ElysiaContext): Promise<Response> => {
			// Run before middleware
			if (beforeHandler) {
				const result = await beforeHandler(ctx, routeInfo);
				if (result instanceof Response) {
					return result;
				}
			}

			const request = createNextRequest(ctx);
			const params = createNextParams(ctx.params, routeInfo.params);

			try {
				let response = await handler(request, { params });

				// Ensure we have a Response
				if (!(response instanceof Response)) {
					if (response !== null && response !== undefined) {
						response = new Response(JSON.stringify(response), {
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						});
					} else {
						response = new Response(null, { status: 204 });
					}
				}

				// Run after middleware
				if (afterHandler) {
					response = await afterHandler(response, ctx, routeInfo);
				}

				return response;
			} catch (error) {
				console.error(`[foxen] Error in route ${routeInfo.elysiaPath}:`, error);
				return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		};
	};
}
