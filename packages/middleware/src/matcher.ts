import type { RouteCondition } from '@foxen/config';
import type { NormalizedMatcher } from './types.js';

/**
 * Default file extensions that should skip middleware
 */
const STATIC_EXTENSIONS = new Set([
	'.js',
	'.css',
	'.map',
	'.json',
	'.xml',
	'.txt',
	'.ico',
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.svg',
	'.webp',
	'.avif',
	'.woff',
	'.woff2',
	'.ttf',
	'.eot',
	'.otf',
	'.mp3',
	'.mp4',
	'.webm',
	'.ogg',
	'.wav',
	'.pdf',
]);

/**
 * Default paths that should skip middleware
 */
const DEFAULT_EXCLUSIONS = ['/_next/static/', '/_next/image/', '/favicon.ico'];

/**
 * Converts a Next.js path pattern to a RegExp
 *
 * Handles patterns like:
 * - `/api/:path*` - zero or more path segments
 * - `/users/:id` - required parameter
 * - `/posts/:slug?` - optional parameter
 * - `/((?!api|_next).*)` - negative lookahead
 *
 * @param pattern - Next.js path pattern
 * @returns Compiled RegExp
 */
export function pathToRegex(pattern: string): RegExp {
	// Handle negative lookahead patterns - preserve them as-is
	// These patterns look like: /((?!api|_next).*)
	if (pattern.includes('(?!')) {
		// These are already valid regex, don't escape anything inside
		return new RegExp(`^${pattern}$`);
	}

	// First, handle the named parameter patterns before escaping
	// Use placeholders to prevent escaping of special chars in patterns
	let regexStr = pattern
		// Convert :path* (zero or more path segments)
		.replace(/:(\w+)\*/g, '___STAR_PARAM___')
		// Convert :path+ (one or more path segments)
		.replace(/:(\w+)\+/g, '___PLUS_PARAM___')
		// Convert :path? (optional param)
		.replace(/:(\w+)\?/g, '___OPT_PARAM___')
		// Convert :path (required param)
		.replace(/:(\w+)/g, '___REQ_PARAM___');

	// Now escape special regex chars
	regexStr = regexStr.replace(/[.+^${}|[\]\\]/g, '\\$&');

	// Replace placeholders with actual regex patterns
	regexStr = regexStr
		.replace(/___STAR_PARAM___/g, '(.*)')
		.replace(/___PLUS_PARAM___/g, '(.+)')
		.replace(/___OPT_PARAM___/g, '([^/]*)?')
		.replace(/___REQ_PARAM___/g, '([^/]+)');

	return new RegExp(`^${regexStr}$`);
}

/**
 * Check if a request should run middleware
 *
 * @param request - The incoming request
 * @param matchers - Array of normalized matchers
 * @param options - Additional options
 * @returns true if middleware should run
 *
 * @example
 * ```ts
 * if (shouldRunMiddleware(request, middleware.matchers)) {
 *   const result = await executeMiddleware(request, middleware.handler);
 * }
 * ```
 */
export function shouldRunMiddleware(
	request: Request,
	matchers: NormalizedMatcher[],
	options: { skipStatic?: boolean } = {},
): boolean {
	const { skipStatic = true } = options;
	const url = new URL(request.url);
	const pathname = url.pathname;

	// Check default exclusions
	if (skipStatic && shouldSkipPath(pathname)) {
		return false;
	}

	// Check each matcher
	for (const matcher of matchers) {
		// Check path pattern
		if (!matcher.regex.test(pathname)) {
			continue;
		}

		// Check has conditions
		if (matcher.has && !matchesConditions(request, url, matcher.has, 'has')) {
			continue;
		}

		// Check missing conditions
		if (matcher.missing && !matchesConditions(request, url, matcher.missing, 'missing')) {
			continue;
		}

		return true;
	}

	return false;
}

/**
 * Check if a path should be skipped (static files, etc.)
 */
function shouldSkipPath(pathname: string): boolean {
	// Check default exclusion prefixes
	for (const exclusion of DEFAULT_EXCLUSIONS) {
		if (pathname.startsWith(exclusion) || pathname === exclusion.slice(0, -1)) {
			return true;
		}
	}

	// Check file extensions
	const lastDot = pathname.lastIndexOf('.');
	if (lastDot !== -1) {
		const ext = pathname.slice(lastDot).toLowerCase();
		if (STATIC_EXTENSIONS.has(ext)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if request matches conditions (has/missing)
 *
 * @param request - The request object
 * @param url - Parsed URL
 * @param conditions - Array of conditions to check
 * @param type - Whether checking "has" or "missing"
 */
function matchesConditions(
	request: Request,
	url: URL,
	conditions: RouteCondition[],
	type: 'has' | 'missing',
): boolean {
	for (const condition of conditions) {
		const matches = matchCondition(request, url, condition);
		if (type === 'has' && !matches) {
			return false;
		}
		if (type === 'missing' && matches) {
			return false;
		}
	}
	return true;
}

/**
 * Match a single condition
 */
function matchCondition(request: Request, url: URL, condition: RouteCondition): boolean {
	switch (condition.type) {
		case 'header': {
			const headerValue = request.headers.get(condition.key);
			if (!headerValue) return false;
			if (!condition.value) return true;
			return matchValue(headerValue, condition.value);
		}

		case 'cookie': {
			const cookies = parseCookies(request.headers.get('cookie') || '');
			const cookieValue = cookies[condition.key];
			if (!cookieValue) return false;
			if (!condition.value) return true;
			return matchValue(cookieValue, condition.value);
		}

		case 'query': {
			const queryValue = url.searchParams.get(condition.key);
			if (!queryValue) return false;
			if (!condition.value) return true;
			return matchValue(queryValue, condition.value);
		}

		case 'host': {
			if (!condition.value) return false;
			return matchValue(url.hostname, condition.value);
		}

		default:
			return false;
	}
}

/**
 * Match a value against a pattern (can be regex)
 */
function matchValue(actual: string, pattern: string): boolean {
	// Check if pattern looks like a regex
	if (pattern.startsWith('^') || pattern.endsWith('$') || pattern.includes('.*')) {
		try {
			return new RegExp(pattern).test(actual);
		} catch {
			// Invalid regex, fall through to exact match
		}
	}
	return actual === pattern;
}

/**
 * Parse cookies from a cookie header string
 */
function parseCookies(cookieHeader: string): Record<string, string> {
	const cookies: Record<string, string> = {};
	if (!cookieHeader) return cookies;

	for (const part of cookieHeader.split(';')) {
		const [key, ...valueParts] = part.split('=');
		const trimmedKey = key?.trim();
		if (trimmedKey) {
			cookies[trimmedKey] = valueParts.join('=').trim();
		}
	}

	return cookies;
}

/**
 * Compile multiple matcher configurations into normalized form
 *
 * @param matchers - Raw matcher configurations
 * @returns Array of normalized matchers
 */
export function compileMatchers(
	matchers: (string | { source: string; has?: RouteCondition[]; missing?: RouteCondition[] })[],
): NormalizedMatcher[] {
	return matchers.map((matcher) => {
		if (typeof matcher === 'string') {
			return {
				source: matcher,
				regex: pathToRegex(matcher),
			};
		}
		return {
			source: matcher.source,
			regex: pathToRegex(matcher.source),
			has: matcher.has,
			missing: matcher.missing,
		};
	});
}

/**
 * Test if a single path matches a pattern
 * Useful for testing matchers
 *
 * @param pathname - URL pathname to test
 * @param pattern - Pattern string
 * @returns true if matches
 */
export function testPathMatch(pathname: string, pattern: string): boolean {
	const regex = pathToRegex(pattern);
	return regex.test(pathname);
}
