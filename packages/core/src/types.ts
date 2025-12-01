// ============================================
// Geo Types
// ============================================

/**
 * Geolocation data from CDN headers.
 */
export interface Geo {
	/** Country code */
	country?: string;
	/** Region/state code */
	region?: string;
	/** City name */
	city?: string;
	/** Latitude */
	latitude?: string;
	/** Longitude */
	longitude?: string;
}

// ============================================
// i18n Configuration
// ============================================

/**
 * Domain locale configuration for multi-domain i18n.
 */
export interface DomainLocale {
	/** The domain for this locale */
	domain: string;
	/** The default locale for this domain */
	defaultLocale: string;
	/** The locales available on this domain */
	locales?: string[];
	/** HTTP method */
	http?: boolean;
}

/**
 * Internationalization configuration matching Next.js i18n config.
 */
export interface I18NConfig {
	/** Default locale when not specified */
	defaultLocale: string;
	/** List of supported locales */
	locales: string[];
	/** Domain-specific locale configuration */
	domains?: DomainLocale[];
	/** Whether to detect locale from Accept-Language header */
	localeDetection?: boolean;
}

// ============================================
// Cookie Types (matching @edge-runtime/cookies)
// ============================================

/**
 * CookieListItem as specified by W3C.
 * @see https://wicg.github.io/cookie-store/#dictdef-cookielistitem
 */
export interface CookieListItem {
	/** A string with the name of a cookie. */
	name: string;
	/** A string containing the value of the cookie. */
	value: string;
	/** The domain of the cookie. */
	domain?: string;
	/** The path of the cookie. */
	path?: string;
	/** Whether the cookie is secure. */
	secure?: boolean;
	/** The SameSite attribute of the cookie. */
	sameSite?: 'strict' | 'lax' | 'none';
	/** Whether the cookie is partitioned. */
	partitioned?: boolean;
	/** A number of milliseconds or Date containing the expires of the cookie. */
	expires?: number | Date;
}

/**
 * Superset of CookieListItem extending it with
 * the `httpOnly`, `maxAge` and `priority` properties.
 */
export interface ResponseCookie extends CookieListItem {
	httpOnly?: boolean;
	maxAge?: number;
	priority?: 'low' | 'medium' | 'high';
}

/**
 * Subset of CookieListItem, only containing `name` and `value`
 * since other cookie attributes aren't available on a `Request`.
 */
export interface RequestCookie {
	name: string;
	value: string;
}

// ============================================
// Request/Response Init Types
// ============================================

/**
 * Next.js config passed to NextRequest/NextResponse constructors.
 */
export interface NextConfig {
	basePath?: string;
	i18n?: I18NConfig | null;
	trailingSlash?: boolean;
}

/**
 * Options for creating a NextRequest.
 */
export interface NextRequestInit extends globalThis.RequestInit {
	nextConfig?: NextConfig;
	signal?: AbortSignal;
	/** @see https://github.com/whatwg/fetch/pull/1457 */
	duplex?: 'half';
}

/**
 * Options for creating a NextResponse.
 */
export interface NextResponseInit extends globalThis.ResponseInit {
	nextConfig?: NextConfig;
	url?: string;
}

/**
 * Modified request for middleware.
 */
export interface ModifiedRequest {
	/**
	 * If this is set, the request headers will be overridden with this value.
	 */
	headers?: Headers | Record<string, string>;
}

/**
 * Extended ResponseInit for middleware responses.
 */
export interface MiddlewareResponseInit extends globalThis.ResponseInit {
	/**
	 * These fields will override the request from clients.
	 */
	request?: ModifiedRequest;
}

// ============================================
// Middleware Types
// ============================================

/**
 * Matcher configuration for middleware.
 */
export interface MiddlewareMatcher {
	/** Source path pattern */
	source: string;
	/** Locale configuration */
	locale?: boolean;
	/** Conditions that must be present */
	has?: RouteCondition[];
	/** Conditions that must be absent */
	missing?: RouteCondition[];
}

/**
 * Middleware config export.
 */
export interface MiddlewareConfig {
	/** Path matchers */
	matcher?: string | string[] | MiddlewareMatcher[];
}

/**
 * Condition for matching routes.
 */
export interface RouteCondition {
	/** Type of condition */
	type: 'header' | 'cookie' | 'host' | 'query';
	/** Key to check */
	key: string;
	/** Value to match (optional, supports regex) */
	value?: string;
}

// ============================================
// Route Handler Types
// ============================================

/** HTTP methods supported by Next.js App Router */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** All supported HTTP methods */
export const HTTP_METHODS: readonly HttpMethod[] = [
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'HEAD',
	'OPTIONS',
] as const;

/**
 * Next.js style route handler.
 * Matches the signature expected by Next.js App Router.
 */
export type NextRouteHandler<Params = Record<string, string | string[]>> = (
	request: Request,
	context?: { params: Promise<Params> },
) => Response | Promise<Response>;

/**
 * Route module exports structure.
 */
export interface RouteModule {
	GET?: NextRouteHandler;
	POST?: NextRouteHandler;
	PUT?: NextRouteHandler;
	PATCH?: NextRouteHandler;
	DELETE?: NextRouteHandler;
	HEAD?: NextRouteHandler;
	OPTIONS?: NextRouteHandler;
	/** Next.js dynamic config */
	dynamic?: 'auto' | 'force-dynamic' | 'error' | 'force-static';
	/** Next.js revalidate config */
	revalidate?: number | false;
}

// ============================================
// Internal Symbols
// ============================================

/** Symbol for NextRequest internal state */
export const NEXT_REQUEST_INTERNAL = Symbol.for('elysia-app-router.request');

/** Symbol for NextResponse internal state */
export const NEXT_RESPONSE_INTERNAL = Symbol.for('elysia-app-router.response');

/** Symbol for NextURL internal state */
export const NEXT_URL_INTERNAL = Symbol.for('elysia-app-router.url');
