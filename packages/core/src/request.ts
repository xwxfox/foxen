import { RequestCookies } from './cookies.ts';
import { RemovedPageError, RemovedUAError } from './errors.ts';
import type { Geo, NextRequestInit } from './types.ts';
import { NextURL } from './url.ts';

// Internal symbol for NextRequest state
const INTERNALS = Symbol.for('foxen.request');

interface NextRequestInternals {
	cookies: RequestCookies;
	url: string;
	nextUrl: NextURL;
	geo: Geo | undefined;
	ip: string | undefined;
}

/**
 * IP headers to check for client IP
 */
const IP_HEADERS = [
	'x-forwarded-for',
	'x-real-ip',
	'cf-connecting-ip',
	'x-client-ip',
	'x-cluster-client-ip',
	'forwarded-for',
	'true-client-ip',
	'x-vercel-forwarded-for',
];

/**
 * Extract IP address from request headers
 */
function extractIP(headers: Headers): string | undefined {
	for (const header of IP_HEADERS) {
		const value = headers.get(header);
		if (value) {
			const ip = value.split(',')[0]?.trim();
			if (ip) return ip;
		}
	}
	return undefined;
}

/**
 * Extract geo information from CDN headers
 */
function extractGeo(headers: Headers): Geo | undefined {
	const country = headers.get('x-vercel-ip-country') ?? headers.get('cf-ipcountry') ?? undefined;
	if (!country) return undefined;

	return {
		country,
		region: headers.get('x-vercel-ip-country-region') ?? undefined,
		city: headers.get('x-vercel-ip-city') ?? undefined,
		latitude: headers.get('x-vercel-ip-latitude') ?? undefined,
		longitude: headers.get('x-vercel-ip-longitude') ?? undefined,
	};
}

/**
 * NextRequest extends the Web API Request with Next.js specific features.
 *
 * This class provides:
 * - nextUrl: Extended URL with basePath and locale info
 * - cookies: RequestCookies API for cookie management
 *
 * This is a 1:1 implementation of Next.js's NextRequest.
 */
export class NextRequest extends Request {
	/** @internal */
	[INTERNALS]: NextRequestInternals;

	constructor(input: string | URL | Request, init: NextRequestInit = {}) {
		const url = typeof input !== 'string' && 'url' in input ? input.url : String(input);

		// Bun/Node Request instance requires duplex option when a body
		// is present or it errors
		if (init.body && init.duplex !== 'half') {
			init.duplex = 'half';
		}

		if (input instanceof Request) {
			super(input, init);
		} else {
			super(url, init);
		}

		const headers = this.headers;
		const nextUrl = new NextURL(url, {
			headers: Object.fromEntries(headers.entries()),
			nextConfig: init.nextConfig,
		});

		this[INTERNALS] = {
			cookies: new RequestCookies(headers),
			nextUrl,
			url: nextUrl.toString(),
			geo: extractGeo(headers),
			ip: extractIP(headers),
		};
	}

	[Symbol.for('edge-runtime.inspect.custom')]() {
		return {
			cookies: this.cookies,
			nextUrl: this.nextUrl,
			url: this.url,
			geo: this.geo,
			ip: this.ip,
			bodyUsed: this.bodyUsed,
			cache: this.cache,
			credentials: this.credentials,
			destination: this.destination,
			headers: Object.fromEntries(this.headers),
			integrity: this.integrity,
			keepalive: this.keepalive,
			method: this.method,
			mode: this.mode,
			redirect: this.redirect,
			referrer: this.referrer,
			referrerPolicy: this.referrerPolicy,
			signal: this.signal,
		};
	}

	public get cookies(): RequestCookies {
		return this[INTERNALS].cookies;
	}

	public get nextUrl(): NextURL {
		return this[INTERNALS].nextUrl;
	}

	/**
	 * The geo location of the request, determined by the CDN.
	 */
	public get geo(): Geo | undefined {
		return this[INTERNALS].geo;
	}

	/**
	 * The IP address of the client.
	 */
	public get ip(): string | undefined {
		return this[INTERNALS].ip;
	}
	/**
	 * @deprecated
	 * `page` has been deprecated in favour of `URLPattern`.
	 * Read more: https://nextjs.org/docs/messages/middleware-request-page
	 */
	public get page(): never {
		throw new RemovedPageError();
	}

	/**
	 * @deprecated
	 * `ua` has been removed in favour of `userAgent` function.
	 * Read more: https://nextjs.org/docs/messages/middleware-parse-user-agent
	 */
	public get ua(): never {
		throw new RemovedUAError();
	}

	/**
	 * Returns the URL of the request.
	 */
	public override get url(): string {
		return this[INTERNALS].url;
	}

	/**
	 * Create a NextRequest from an existing Request.
	 */
	static from(request: Request, init?: NextRequestInit): NextRequest {
		return new NextRequest(request, {
			...init,
			method: request.method,
			headers: request.headers,
			body: request.body,
			duplex: request.body ? 'half' : undefined,
		});
	}
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a NextRequest from an incoming Request.
 *
 * This is a convenience function for wrapping an incoming request.
 *
 * @example
 * ```ts
 * import { createNextRequest } from '@foxen/core';
 *
 * export function middleware(req: Request) {
 *   const request = createNextRequest(req, {
 *     nextConfig: { basePath: '/app' }
 *   });
 *
 *   const pathname = request.nextUrl.pathname;
 *   const token = request.cookies.get('auth-token');
 *
 *   return NextResponse.next();
 * }
 * ```
 */
export function createNextRequest(request: Request, init?: NextRequestInit): NextRequest {
	return NextRequest.from(request, init);
}

/**
 * Check if an object is a NextRequest instance.
 */
export function isNextRequest(obj: unknown): obj is NextRequest {
	return obj instanceof NextRequest;
}
