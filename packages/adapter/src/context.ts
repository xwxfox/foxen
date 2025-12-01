import { NextRequest } from '@foxen/core';
import type { GeoData, RuntimeContext } from './types.ts';

// ============================================
// IP Extraction
// ============================================

/**
 * Headers to check for client IP address
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
 * Extract client IP address from request headers.
 *
 * Checks common proxy headers in order of reliability.
 *
 * @example
 * ```ts
 * const ip = extractIPFromHeaders(request.headers);
 * // '1.2.3.4'
 * ```
 */
export function extractIPFromHeaders(headers: Headers): string | undefined {
	for (const header of IP_HEADERS) {
		const value = headers.get(header);
		if (value) {
			// x-forwarded-for can contain comma-separated list
			const ip = value.split(',')[0]?.trim();
			if (ip && isValidIP(ip)) {
				return ip;
			}
		}
	}
	return undefined;
}

/**
 * Basic IP validation
 */
function isValidIP(ip: string): boolean {
	// IPv4
	if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
		return true;
	}
	// IPv6 (simplified check)
	if (ip.includes(':')) {
		return true;
	}
	return false;
}

// ============================================
// Geo Extraction
// ============================================

/**
 * Extract geolocation data from CDN headers.
 *
 * Supports:
 * - Vercel: x-vercel-ip-country, x-vercel-ip-city, etc.
 * - Cloudflare: cf-ipcountry
 *
 * @example
 * ```ts
 * const geo = extractGeoFromHeaders(request.headers);
 * // { country: 'US', region: 'CA', city: 'San Francisco' }
 * ```
 */
export function extractGeoFromHeaders(headers: Headers): GeoData | undefined {
	// Try Vercel headers first
	const vercelCountry = headers.get('x-vercel-ip-country');
	if (vercelCountry) {
		return {
			country: vercelCountry,
			region: headers.get('x-vercel-ip-country-region') ?? undefined,
			city: decodeHeader(headers.get('x-vercel-ip-city')),
			latitude: headers.get('x-vercel-ip-latitude') ?? undefined,
			longitude: headers.get('x-vercel-ip-longitude') ?? undefined,
		};
	}

	// Try Cloudflare headers
	const cfCountry = headers.get('cf-ipcountry');
	if (cfCountry) {
		return {
			country: cfCountry,
			city: decodeHeader(headers.get('cf-ipcity')),
			latitude: headers.get('cf-iplatitude') ?? undefined,
			longitude: headers.get('cf-iplongitude') ?? undefined,
		};
	}

	return undefined;
}

/**
 * Decode URL-encoded header value (city names may be encoded)
 */
function decodeHeader(value: string | null): string | undefined {
	if (!value) return undefined;
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

// ============================================
// NextRequest Creation
// ============================================

/** Options for creating NextRequest */
export interface CreateNextRequestOptions {
	/** Base path for URL resolution */
	basePath?: string;
	/** Override IP address */
	ip?: string;
	/** Override geo data */
	geo?: GeoData;
	/** Route params (will be available via searchParams or nextUrl) */
	params?: Record<string, string | string[]>;
}

/**
 * Create a NextRequest from Elysia context.
 *
 * This function wraps an incoming Request in a NextRequest with proper
 * handling of params, geo, and IP extraction.
 *
 * @example
 * ```ts
 * // In Elysia handler
 * const nextRequest = createNextRequest(ctx.request, {
 *   basePath: '/api',
 *   params: ctx.params,
 * });
 * ```
 */
export function createNextRequest(
	request: Request,
	options: CreateNextRequestOptions = {},
): NextRequest {
	const { basePath, ip, geo, params } = options;
	const headers = request.headers;

	// Determine IP (override > header extraction)
	const resolvedIP = ip ?? extractIPFromHeaders(headers);

	// Determine geo (override > header extraction)
	const resolvedGeo = geo ?? extractGeoFromHeaders(headers);

	// Create NextRequest with init options
	const nextRequest = new NextRequest(request, {
		nextConfig: basePath ? { basePath } : undefined,
	});

	// Store additional data in internals for compatibility
	// NextRequest already extracts IP and geo from headers in constructor,
	// but we can provide overrides via the runtime context storage
	if (resolvedIP || resolvedGeo || params) {
		const runtimeCtx =
			(nextRequest as unknown as { _foxenContext?: RuntimeContext })._foxenContext ?? {};

		if (resolvedIP) runtimeCtx._ip = resolvedIP;
		if (resolvedGeo) runtimeCtx._geo = resolvedGeo;

		(nextRequest as unknown as { _foxenContext: RuntimeContext })._foxenContext = runtimeCtx;
	}

	return nextRequest;
}

// ============================================
// Params Promise (Next.js 15+)
// ============================================

/**
 * Create a resolved Promise for route params.
 *
 * Next.js 15+ uses Promise<Params> for dynamic route parameters.
 * This wraps params in a resolved promise for compatibility.
 *
 * @example
 * ```ts
 * const params = createParamsPromise({ id: '123' });
 * const { id } = await params; // Works with Next.js 15+ pattern
 * ```
 */
export function createParamsPromise<T extends Record<string, string | string[]>>(
	params: T,
): Promise<T> & T {
	// Create a promise that's already resolved
	const promise = Promise.resolve(params) as unknown as Promise<T> & T;

	// Also make params directly accessible (for backward compatibility)
	for (const [key, value] of Object.entries(params)) {
		(promise as Record<string, unknown>)[key] = value;
	}

	return promise;
}

/**
 * Normalize params from Elysia to Next.js format.
 *
 * Elysia uses :param for path params, Next.js uses [param].
 * Catch-all params need special handling for array values.
 *
 * @example
 * ```ts
 * // Elysia params: { '*': 'a/b/c' }
 * // Next.js expects: { slug: ['a', 'b', 'c'] }
 * normalizeParams({ '*': 'a/b/c' }, 'slug')
 * ```
 */
export function normalizeParams(
	params: Record<string, string | string[] | undefined>,
	catchAllName?: string,
): Record<string, string | string[]> {
	const result: Record<string, string | string[]> = {};

	for (const [key, value] of Object.entries(params)) {
		if (value === undefined) continue;

		// Handle catch-all wildcard
		if (key === '*' && catchAllName) {
			// Split path into segments
			if (typeof value === 'string') {
				result[catchAllName] = value ? value.split('/').filter(Boolean) : [];
			} else {
				result[catchAllName] = value;
			}
		} else if (key === '*') {
			// Keep as '*' if no name provided
			if (typeof value === 'string') {
				result['*'] = value ? value.split('/').filter(Boolean) : [];
			} else {
				result['*'] = value;
			}
		} else {
			result[key] = value;
		}
	}

	return result;
}

// ============================================
// Context Storage
// ============================================

const FOXEN_CONTEXT_KEY = Symbol.for('foxen.context');

/**
 * Get the Foxen runtime context from an Elysia context.
 */
export function getFoxenContext(ctx: unknown): RuntimeContext {
	const elysiaCtx = ctx as Record<symbol, RuntimeContext>;
	if (!elysiaCtx[FOXEN_CONTEXT_KEY]) {
		elysiaCtx[FOXEN_CONTEXT_KEY] = {};
	}
	return elysiaCtx[FOXEN_CONTEXT_KEY];
}

/**
 * Set the Foxen runtime context on an Elysia context.
 */
export function setFoxenContext(ctx: unknown, foxenCtx: RuntimeContext): void {
	const elysiaCtx = ctx as Record<symbol, RuntimeContext>;
	elysiaCtx[FOXEN_CONTEXT_KEY] = foxenCtx;
}

/**
 * Merge values into the existing Foxen context.
 */
export function updateFoxenContext(ctx: unknown, updates: Partial<RuntimeContext>): void {
	const foxenCtx = getFoxenContext(ctx);
	Object.assign(foxenCtx, updates);
}
