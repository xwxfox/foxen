import { ResponseCookies, stringifyCookie } from './cookies.ts';
import type { MiddlewareResponseInit, NextResponseInit } from './types.ts';
import { NextURL } from './url.ts';

// Internal symbol for NextResponse state
const INTERNALS = Symbol.for('elysia-app-router.response');

// Valid redirect status codes
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

interface NextResponseInternals {
	cookies: ResponseCookies;
	url?: NextURL;
}

/**
 * Validate a URL and return it as a string.
 */
function validateURL(url: string | NextURL | URL): string {
	return String(url);
}

/**
 * Handle middleware request header modifications.
 */
function handleMiddlewareField(init: MiddlewareResponseInit | undefined, headers: Headers): void {
	if (init?.request?.headers) {
		const requestHeaders =
			init.request.headers instanceof Headers
				? init.request.headers
				: new Headers(init.request.headers as Record<string, string>);

		const keys: string[] = [];
		for (const [key, value] of requestHeaders) {
			headers.set(`x-middleware-request-${key}`, value);
			keys.push(key);
		}

		headers.set('x-middleware-override-headers', keys.join(','));
	}
}

/**
 * NextResponse extends the Web API Response with Next.js specific features.
 *
 * This class provides:
 * - cookies: ResponseCookies API for cookie management
 * - Static methods: json(), redirect(), rewrite(), next()
 *
 * This is a 1:1 implementation of Next.js's NextResponse.
 */
export class NextResponse<_Body = unknown> extends Response {
	[INTERNALS]: NextResponseInternals;

	constructor(body?: BodyInit | null, init: NextResponseInit = {}) {
		// Convert our init format to ResponseInit
		const responseInit: ResponseInit = {
			status: init.status,
			statusText: init.statusText,
			headers: init.headers,
		};
		super(body, responseInit);

		const headers = this.headers;
		const cookies = new ResponseCookies(headers);

		// Create a proxy to handle cookie modifications for middleware
		const cookiesProxy = new Proxy(cookies, {
			get(target, prop, receiver) {
				switch (prop) {
					case 'delete':
					case 'set': {
						return (
							...args: Parameters<typeof cookies.set> | Parameters<typeof cookies.delete>
						) => {
							const result = Reflect.apply(
								target[prop as 'set' | 'delete'],
								target,
								args as Parameters<typeof cookies.set>,
							);

							if (result instanceof ResponseCookies) {
								headers.set(
									'x-middleware-set-cookie',
									result
										.getAll()
										.map((cookie) => stringifyCookie(cookie))
										.join(','),
								);
							}

							return result;
						};
					}
					default:
						return Reflect.get(target, prop, receiver);
				}
			},
		});

		this[INTERNALS] = {
			cookies: cookiesProxy,
			url: init.url
				? new NextURL(init.url, {
						nextConfig: init.nextConfig,
					})
				: undefined,
		};
	}

	[Symbol.for('edge-runtime.inspect.custom')]() {
		return {
			cookies: this.cookies,
			url: this.url,
			body: this.body,
			bodyUsed: this.bodyUsed,
			headers: Object.fromEntries(this.headers),
			ok: this.ok,
			redirected: this.redirected,
			status: this.status,
			statusText: this.statusText,
			type: this.type,
		};
	}

	public get cookies(): ResponseCookies {
		return this[INTERNALS].cookies;
	}

	/**
	 * Create a JSON response.
	 */
	static override json<JsonBody>(body: JsonBody, init?: ResponseInit): NextResponse<JsonBody> {
		const response: Response = Response.json(body, init);
		return new NextResponse(response.body, response);
	}

	/**
	 * Create a redirect response.
	 *
	 * @param url The URL to redirect to
	 * @param init The status code (default: 307) or ResponseInit
	 */
	static override redirect(
		url: string | NextURL | URL,
		init?: number | ResponseInit,
	): NextResponse {
		const status = typeof init === 'number' ? init : (init?.status ?? 307);
		if (!REDIRECTS.has(status)) {
			throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');
		}
		const initObj = typeof init === 'object' ? init : {};
		const initHeaders = initObj?.headers;
		const headers = new Headers(
			initHeaders instanceof Headers
				? initHeaders
				: (initHeaders as Record<string, string> | undefined),
		);
		headers.set('Location', validateURL(url));

		return new NextResponse(null, {
			...initObj,
			headers,
			status,
		});
	}

	/**
	 * Create a rewrite response.
	 *
	 * Rewrites the request to a different URL internally while keeping
	 * the original URL visible in the browser.
	 */
	static rewrite(destination: string | NextURL | URL, init?: MiddlewareResponseInit): NextResponse {
		const initHeaders = init?.headers;
		const headers = new Headers(
			initHeaders instanceof Headers
				? (initHeaders as HeadersInit)
				: (initHeaders as Record<string, string> | undefined),
		);
		headers.set('x-middleware-rewrite', validateURL(destination));

		handleMiddlewareField(init, headers);
		return new NextResponse(null, { ...init, headers });
	}

	/**
	 * Continue to the next handler.
	 *
	 * This signals that the request should continue to the route handler
	 * with optional modifications to headers.
	 */
	static next(init?: MiddlewareResponseInit): NextResponse {
		const initHeaders = init?.headers;
		const headers = new Headers(
			initHeaders instanceof Headers
				? (initHeaders as HeadersInit)
				: (initHeaders as Record<string, string> | undefined),
		);
		headers.set('x-middleware-next', '1');

		handleMiddlewareField(init, headers);
		return new NextResponse(null, { ...init, headers });
	}
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if a response is a NextResponse instance.
 */
export function isNextResponse(obj: unknown): obj is NextResponse {
	return obj instanceof NextResponse;
}

/**
 * Check if a response indicates a rewrite.
 */
export function isRewriteResponse(response: Response): boolean {
	return response.headers.has('x-middleware-rewrite');
}

/**
 * Check if a response indicates continuation.
 */
export function isNextContinue(response: Response): boolean {
	return response.headers.get('x-middleware-next') === '1';
}

/**
 * Check if a response is a redirect.
 */
export function isRedirectResponse(response: Response): boolean {
	return response.status >= 300 && response.status < 400 && response.headers.has('location');
}

/**
 * Get the rewrite destination URL from a response.
 */
export function getRewriteUrl(response: Response): string | null {
	return response.headers.get('x-middleware-rewrite');
}

/**
 * Get the redirect URL from a response.
 */
export function getRedirectUrl(response: Response): string | null {
	return response.headers.get('location');
}
