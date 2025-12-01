import { type PathMatchOptions, applyParams, matchConditions, matchPath } from './matcher.js';
import type { NextHeader } from './types.js';

/**
 * Options for header processing
 */
export interface HeaderProcessOptions extends PathMatchOptions {}

/**
 * Result from processing headers
 */
export interface HeadersResult {
	/** Headers to apply (accumulated from all matching rules) */
	headers: Array<{ key: string; value: string }>;
	/** The rules that matched (for debugging) */
	matchedRules: NextHeader[];
}

/**
 * Process header rules against a request
 *
 * Unlike redirects/rewrites, multiple header rules can match.
 * All matching headers are accumulated and returned.
 *
 * @param request - The incoming request
 * @param rules - Array of header rules
 * @param options - Processing options
 * @returns Headers to apply from all matching rules
 *
 * @example
 * ```ts
 * const result = processHeaders(request, config.headers);
 * for (const { key, value } of result.headers) {
 *   response.headers.set(key, value);
 * }
 * ```
 */
export function processHeaders(
	request: Request,
	rules: NextHeader[],
	options?: HeaderProcessOptions,
): HeadersResult {
	const url = new URL(request.url);
	const allHeaders: Array<{ key: string; value: string }> = [];
	const matchedRules: NextHeader[] = [];

	for (const rule of rules) {
		// Check path match
		const pathMatch = matchPath(url.pathname, rule.source, {
			basePath: rule.basePath === false ? false : options?.basePath,
		});

		if (!pathMatch.matched) {
			continue;
		}

		// Check conditions
		const conditionMatch = matchConditions(request, rule.has, rule.missing);

		if (!conditionMatch.matches) {
			continue;
		}

		// Apply params to header values and add to results
		for (const header of rule.headers) {
			const value = applyParams(header.value, pathMatch.params, conditionMatch.captures);
			allHeaders.push({
				key: header.key,
				value,
			});
		}

		matchedRules.push(rule);
	}

	return {
		headers: allHeaders,
		matchedRules,
	};
}

/**
 * Apply headers to a Response object
 *
 * @param response - The response to modify
 * @param headers - Headers to apply
 * @returns New Response with headers applied
 */
export function applyHeadersToResponse(
	response: Response,
	headers: Array<{ key: string; value: string }>,
): Response {
	// Clone the response to make it mutable
	const newResponse = new Response(response.body, response);

	for (const { key, value } of headers) {
		newResponse.headers.set(key, value);
	}

	return newResponse;
}

/**
 * Create a Headers object from the result
 *
 * @param result - Headers result from processHeaders
 * @returns Headers object
 */
export function createHeadersObject(result: HeadersResult): Headers {
	const headers = new Headers();

	for (const { key, value } of result.headers) {
		headers.append(key, value);
	}

	return headers;
}

/**
 * Merge header results, with later results taking precedence
 *
 * @param results - Array of header results to merge
 * @returns Merged headers result
 */
export function mergeHeaderResults(...results: HeadersResult[]): HeadersResult {
	const headerMap = new Map<string, string>();
	const allMatchedRules: NextHeader[] = [];

	for (const result of results) {
		for (const { key, value } of result.headers) {
			headerMap.set(key.toLowerCase(), value);
		}
		allMatchedRules.push(...result.matchedRules);
	}

	// Convert map back to array, preserving original case for keys
	const headers: Array<{ key: string; value: string }> = [];
	const seenKeys = new Set<string>();

	// Go through all results in order to get the original key casing
	for (const result of results) {
		for (const { key, value } of result.headers) {
			const lowerKey = key.toLowerCase();
			if (!seenKeys.has(lowerKey)) {
				seenKeys.add(lowerKey);
				// Use the value from the map (which has the last-set value)
				headers.push({
					key,
					value: headerMap.get(lowerKey) || value,
				});
			}
		}
	}

	return {
		headers,
		matchedRules: allMatchedRules,
	};
}

/**
 * Common security headers preset
 */
export const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
	{ key: 'X-DNS-Prefetch-Control', value: 'on' },
	{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'X-Frame-Options', value: 'DENY' },
	{ key: 'X-XSS-Protection', value: '1; mode=block' },
	{ key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
];

/**
 * CORS headers preset generator
 */
export function createCorsHeaders(options?: {
	origin?: string;
	methods?: string[];
	headers?: string[];
	credentials?: boolean;
	maxAge?: number;
}): Array<{ key: string; value: string }> {
	const headers: Array<{ key: string; value: string }> = [
		{ key: 'Access-Control-Allow-Origin', value: options?.origin || '*' },
		{
			key: 'Access-Control-Allow-Methods',
			value: (options?.methods || ['GET', 'POST', 'PUT', 'DELETE']).join(', '),
		},
		{
			key: 'Access-Control-Allow-Headers',
			value: (options?.headers || ['Content-Type', 'Authorization']).join(', '),
		},
	];

	if (options?.credentials) {
		headers.push({ key: 'Access-Control-Allow-Credentials', value: 'true' });
	}

	if (options?.maxAge !== undefined) {
		headers.push({ key: 'Access-Control-Max-Age', value: String(options.maxAge) });
	}

	return headers;
}
