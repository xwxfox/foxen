import { type PathMatchOptions, applyParams, matchConditions, matchPath } from './matcher.js';
import type { NextRewrite, NextRewritesConfig } from './types.js';

/**
 * Options for rewrite processing
 */
export interface RewriteProcessOptions extends PathMatchOptions {
	/** Whether to preserve query string from original request */
	preserveQueryString?: boolean;
}

/**
 * Result from processing rewrites
 */
export interface RewriteResult {
	/** Whether a rewrite matched */
	matched: boolean;
	/** The rewritten pathname (if matched) */
	pathname?: string;
	/** Whether the destination is an external URL */
	isExternal?: boolean;
	/** The full external URL (if isExternal) */
	externalUrl?: string;
	/** The matched rule (for debugging) */
	rule?: NextRewrite;
}

/**
 * Process a single rewrite rule against a request
 *
 * @param request - The incoming request
 * @param rule - The rewrite rule to check
 * @param options - Processing options
 * @returns Rewrite result
 */
export function processRewrite(
	request: Request,
	rule: NextRewrite,
	options?: RewriteProcessOptions,
): RewriteResult {
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

	// Build destination
	const destination = applyParams(rule.destination, pathMatch.params, conditionMatch.captures);

	// Check if destination is external
	if (destination.startsWith('http://') || destination.startsWith('https://')) {
		let externalUrl = destination;

		// Preserve query string if needed
		if (options?.preserveQueryString !== false) {
			const destUrl = new URL(destination);
			for (const [key, value] of url.searchParams.entries()) {
				if (!destUrl.searchParams.has(key)) {
					destUrl.searchParams.set(key, value);
				}
			}
			externalUrl = destUrl.toString();
		}

		return {
			matched: true,
			isExternal: true,
			externalUrl,
			rule,
		};
	}

	return {
		matched: true,
		pathname: destination,
		isExternal: false,
		rule,
	};
}

/**
 * Process an array of rewrite rules (first match wins)
 *
 * @param request - The incoming request
 * @param rules - Array of rewrite rules
 * @param options - Processing options
 * @returns Rewrite result from first matching rule
 */
export function processRewriteArray(
	request: Request,
	rules: NextRewrite[],
	options?: RewriteProcessOptions,
): RewriteResult {
	for (const rule of rules) {
		const result = processRewrite(request, rule, options);
		if (result.matched) {
			return result;
		}
	}

	return { matched: false };
}

/**
 * Full rewrite processing result including phase
 */
export interface FullRewriteResult extends RewriteResult {
	/** Which phase the rewrite matched in */
	phase?: 'beforeFiles' | 'afterFiles' | 'fallback';
}

/**
 * Process all rewrite rules against a request
 *
 * Rewrites are processed in three phases:
 * 1. beforeFiles - Before checking static files
 * 2. afterFiles - After checking static files but before dynamic routes
 * 3. fallback - Only if no page/file was matched
 *
 * For runtime usage, you typically process beforeFiles first, then your routes,
 * then afterFiles if no route matched, and finally fallback.
 *
 * @param request - The incoming request
 * @param rewrites - Rewrites config with phases
 * @param phase - Which phase to process ('beforeFiles' | 'afterFiles' | 'fallback' | 'all')
 * @param options - Processing options
 * @returns Rewrite result
 *
 * @example
 * ```ts
 * // Process beforeFiles first
 * const before = processRewrites(request, config.rewrites, 'beforeFiles');
 * if (before.matched) {
 *   // Use before.pathname or before.externalUrl
 * }
 *
 * // After routes, process afterFiles and fallback
 * const after = processRewrites(request, config.rewrites, 'afterFiles');
 * ```
 */
export function processRewrites(
	request: Request,
	rewrites: NextRewritesConfig,
	phase: 'beforeFiles' | 'afterFiles' | 'fallback' | 'all' = 'all',
	options?: RewriteProcessOptions,
): FullRewriteResult {
	if (phase === 'all') {
		// Process all phases in order
		for (const p of ['beforeFiles', 'afterFiles', 'fallback'] as const) {
			const rules = rewrites[p] || [];
			const result = processRewriteArray(request, rules, options);
			if (result.matched) {
				return { ...result, phase: p };
			}
		}
		return { matched: false };
	}

	const rules = rewrites[phase] || [];
	const result = processRewriteArray(request, rules, options);

	if (result.matched) {
		return { ...result, phase };
	}

	return { matched: false };
}

/**
 * Create a new request with rewritten URL (for internal rewrites)
 *
 * @param originalRequest - The original request
 * @param newPathname - The new pathname to use
 * @param preserveQueryString - Whether to preserve the original query string
 * @returns New Request object with updated URL
 */
export function createRewrittenRequest(
	originalRequest: Request,
	newPathname: string,
	preserveQueryString = true,
): Request {
	const url = new URL(originalRequest.url);
	url.pathname = newPathname;

	if (!preserveQueryString) {
		url.search = '';
	}

	return new Request(url.toString(), {
		method: originalRequest.method,
		headers: originalRequest.headers,
		body: originalRequest.body,
		// @ts-ignore - duplex is not in types but needed for streaming
		duplex: 'half',
	});
}
