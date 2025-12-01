import type { NextRequest } from '@foxen/core';

/**
 * IP address information
 */
export interface IPInfo {
	/** The IP address */
	ip: string;
	/** Whether it's an IPv6 address */
	isIPv6: boolean;
	/** Whether it's a private/local address */
	isPrivate: boolean;
}

/**
 * Geolocation information (typically from CDN headers)
 */
export interface GeoInfo {
	/** Country code (ISO 3166-1 alpha-2) */
	country?: string;
	/** Region/state */
	region?: string;
	/** City */
	city?: string;
	/** Latitude */
	latitude?: string;
	/** Longitude */
	longitude?: string;
	/** Timezone */
	timezone?: string;
}

/**
 * Headers that may contain the client IP address
 */
const IP_HEADERS = [
	'x-forwarded-for',
	'x-real-ip',
	'cf-connecting-ip', // Cloudflare
	'x-client-ip',
	'x-cluster-client-ip',
	'forwarded-for',
	'forwarded',
	'true-client-ip', // Akamai
	'x-vercel-forwarded-for', // Vercel
];

/**
 * Private IP ranges
 */
const PRIVATE_IP_RANGES = [
	/^127\./,
	/^10\./,
	/^172\.(1[6-9]|2[0-9]|3[0-1])\./,
	/^192\.168\./,
	/^::1$/,
	/^fe80:/i,
	/^fc00:/i,
	/^fd00:/i,
];

/**
 * Get the client IP address from a request
 */
export function getIP(request: Request | NextRequest): string | undefined {
	const headers = request.headers;

	// Check common proxy headers
	for (const header of IP_HEADERS) {
		const value = headers.get(header);
		if (value) {
			// x-forwarded-for can contain multiple IPs
			const ip = value.split(',')[0]?.trim();
			if (ip && isValidIP(ip)) {
				return ip;
			}
		}
	}

	// Check "forwarded" header (RFC 7239)
	const forwarded = headers.get('forwarded');
	if (forwarded) {
		const match = forwarded.match(/for=["']?([^"',;\s]+)/i);
		if (match?.[1]) {
			const ip = match[1].replace(/^\[|\]$/g, ''); // Remove brackets for IPv6
			if (isValidIP(ip)) {
				return ip;
			}
		}
	}

	return undefined;
}

/**
 * Get detailed IP information
 */
export function getIPInfo(request: Request | NextRequest): IPInfo | undefined {
	const ip = getIP(request);
	if (!ip) return undefined;

	return {
		ip,
		isIPv6: ip.includes(':'),
		isPrivate: PRIVATE_IP_RANGES.some((range) => range.test(ip)),
	};
}

/**
 * Validate an IP address
 */
export function isValidIP(ip: string): boolean {
	// IPv4
	const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
	if (ipv4Pattern.test(ip)) {
		const parts = ip.split('.').map(Number);
		return parts.every((part) => part >= 0 && part <= 255);
	}

	// IPv6 (simplified check)
	const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
	return ipv6Pattern.test(ip);
}

/**
 * Get geolocation information from CDN headers
 */
export function getGeo(request: Request | NextRequest): GeoInfo {
	const headers = request.headers;
	const geo: GeoInfo = {};

	// Vercel headers
	geo.country = headers.get('x-vercel-ip-country') ?? undefined;
	geo.region = headers.get('x-vercel-ip-country-region') ?? undefined;
	geo.city = headers.get('x-vercel-ip-city') ?? undefined;
	geo.latitude = headers.get('x-vercel-ip-latitude') ?? undefined;
	geo.longitude = headers.get('x-vercel-ip-longitude') ?? undefined;
	geo.timezone = headers.get('x-vercel-ip-timezone') ?? undefined;

	// Cloudflare headers (as fallback)
	if (!geo.country) {
		geo.country = headers.get('cf-ipcountry') ?? undefined;
	}

	// AWS CloudFront headers
	if (!geo.country) {
		geo.country = headers.get('cloudfront-viewer-country') ?? undefined;
	}

	return geo;
}

/**
 * Get the request protocol (http or https)
 */
export function getProtocol(request: Request | NextRequest): 'http' | 'https' {
	const proto = request.headers.get('x-forwarded-proto');
	if (proto === 'https' || proto === 'http') {
		return proto;
	}

	// Check URL
	const url = new URL(request.url);
	return url.protocol === 'https:' ? 'https' : 'http';
}

/**
 * Get the host from request headers
 */
export function getHost(request: Request | NextRequest): string {
	return (
		request.headers.get('x-forwarded-host') ??
		request.headers.get('host') ??
		new URL(request.url).host
	);
}

/**
 * Get the full URL including protocol and host
 */
export function getFullURL(request: Request | NextRequest): string {
	const protocol = getProtocol(request);
	const host = getHost(request);
	const url = new URL(request.url);
	return `${protocol}://${host}${url.pathname}${url.search}`;
}

/**
 * Get content type from request
 */
export function getContentType(request: Request | NextRequest): string | undefined {
	const contentType = request.headers.get('content-type');
	if (!contentType) return undefined;

	// Return just the mime type without parameters
	return contentType.split(';')[0]?.trim();
}

/**
 * Check if request accepts JSON
 */
export function acceptsJSON(request: Request | NextRequest): boolean {
	const accept = request.headers.get('accept') ?? '';
	return accept.includes('application/json') || accept.includes('*/*') || accept === '';
}

/**
 * Check if request is an AJAX/XHR request
 */
export function isAjax(request: Request | NextRequest): boolean {
	return request.headers.get('x-requested-with')?.toLowerCase() === 'xmlhttprequest';
}

/**
 * Check if request is a prefetch request
 */
export function isPrefetch(request: Request | NextRequest): boolean {
	return (
		request.headers.get('purpose') === 'prefetch' ||
		request.headers.get('x-purpose') === 'prefetch' ||
		request.headers.get('sec-purpose') === 'prefetch'
	);
}

/**
 * Get bearer token from Authorization header
 */
export function getBearerToken(request: Request | NextRequest): string | undefined {
	const auth = request.headers.get('authorization');
	if (!auth?.toLowerCase().startsWith('bearer ')) {
		return undefined;
	}
	return auth.slice(7);
}

/**
 * Get basic auth credentials
 */
export function getBasicAuth(
	request: Request | NextRequest,
): { username: string; password: string } | undefined {
	const auth = request.headers.get('authorization');
	if (!auth?.toLowerCase().startsWith('basic ')) {
		return undefined;
	}

	try {
		const decoded = atob(auth.slice(6));
		const [username, ...passwordParts] = decoded.split(':');
		if (!username) return undefined;

		return {
			username,
			password: passwordParts.join(':'),
		};
	} catch {
		return undefined;
	}
}
