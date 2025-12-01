import { type PathMatchOptions, applyParams, matchConditions, matchPath } from './matcher.js';
import type { NextRedirect } from './types.js';

/**
 * Options for redirect processing
 */
export interface RedirectProcessOptions extends PathMatchOptions {
	/** Whether to preserve query string from original request */
	preserveQueryString?: boolean;
}

/**
 * Result from processing redirects
 */
export interface RedirectResult {
	/** Whether a redirect matched */
	matched: boolean;
	/** The redirect response (if matched) */
	response?: Response;
	/** The matched rule (for debugging) */
	rule?: NextRedirect;
}

/**
 * Process a single redirect rule against a request
 *
 * @param request - The incoming request
 * @param rule - The redirect rule to check
 * @param options - Processing options
 * @returns Redirect result
 */
export function processRedirect(
	request: Request,
	rule: NextRedirect,
	options?: RedirectProcessOptions,
): RedirectResult {
	const url = new URL(request.url);

	// Check path match
	const pathMatch = matchPath(url.pathname, rule.source, {
		basePath: rule.basePath === false ? false : options?.basePath,
	});

	if (!pathMatch.matched) {
		return { matched: false };
	}

	// Check conditions
	const conditionMatch = matchConditions(request, rule.has, rule.missing);

	if (!conditionMatch.matches) {
		return { matched: false };
	}

	// Build destination URL
	const destination = applyParams(rule.destination, pathMatch.params, conditionMatch.captures);

	// Handle external URLs vs internal paths
	let finalUrl: URL;

	if (destination.startsWith('http://') || destination.startsWith('https://')) {
		finalUrl = new URL(destination);
	} else {
		finalUrl = new URL(destination, url.origin);
	}

	// Preserve query string from original request if enabled
	if (options?.preserveQueryString !== false) {
		// Merge query params - destination takes precedence
		const originalParams = url.searchParams;
		const destinationParams = finalUrl.searchParams;

		for (const [key, value] of originalParams.entries()) {
			if (!destinationParams.has(key)) {
				destinationParams.set(key, value);
			}
		}
	}

	// Create redirect response
	const statusCode = rule.permanent ? 308 : 307;
	const response = createRedirectResponse(finalUrl.toString(), statusCode);

	return {
		matched: true,
		response,
		rule,
	};
}

/**
 * Process all redirect rules against a request (first match wins)
 *
 * @param request - The incoming request
 * @param rules - Array of redirect rules
 * @param options - Processing options
 * @returns Redirect result from first matching rule
 *
 * @example
 * ```ts
 * const result = processRedirects(request, config.redirects);
 * if (result.matched && result.response) {
 *   return result.response;
 * }
 * ```
 */
export function processRedirects(
	request: Request,
	rules: NextRedirect[],
	options?: RedirectProcessOptions,
): RedirectResult {
	for (const rule of rules) {
		const result = processRedirect(request, rule, options);
		if (result.matched) {
			return result;
		}
	}

	return { matched: false };
}

/**
 * Create a redirect response
 *
 * @param destination - The destination URL
 * @param statusCode - HTTP status code (307 or 308)
 * @returns Response object with redirect headers
 */
export function createRedirectResponse(destination: string, statusCode: 307 | 308 = 307): Response {
	return new Response(null, {
		status: statusCode,
		headers: {
			Location: destination,
		},
	});
}

/**
 * Check if a URL is external (different origin)
 *
 * @param url - URL to check
 * @param origin - Origin to compare against
 * @returns True if URL is external
 */
export function isExternalUrl(url: string, origin?: string): boolean {
	if (url.startsWith('http://') || url.startsWith('https://')) {
		if (origin) {
			try {
				const parsed = new URL(url);
				const originUrl = new URL(origin);
				return parsed.origin !== originUrl.origin;
			} catch {
				return true;
			}
		}
		return true;
	}
	return false;
}
