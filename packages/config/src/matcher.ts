import type { RouteCondition } from './types.js';

/**
 * Result from path matching
 */
export interface PathMatchResult {
	/** Whether the path matched the pattern */
	matched: boolean;
	/** Extracted path parameters */
	params: Record<string, string | string[]>;
}

/**
 * Options for path matching
 */
export interface PathMatchOptions {
	/**
	 * Base path to prepend to the pattern.
	 * Set to empty string or false to skip basePath handling.
	 */
	basePath?: string | false;
	/**
	 * Whether to treat trailing slash as significant
	 */
	trailingSlash?: boolean;
}

/**
 * Result from condition matching
 */
export interface ConditionMatchResult {
	/** Whether all conditions matched */
	matches: boolean;
	/** Captured values from regex groups in conditions */
	captures: Record<string, string>;
}

/**
 * Parsed path segment
 */
interface ParsedSegment {
	/** Raw segment text */
	raw: string;
	/** Type of segment */
	type: 'static' | 'param' | 'catch-all' | 'optional-catch-all' | 'optional' | 'group';
	/** Parameter name (for dynamic segments) */
	name?: string;
	/** Regex pattern for the segment */
	pattern: string;
}

/**
 * Parse a path pattern into segments
 *
 * @param pattern - The path pattern to parse
 * @returns Array of parsed segments
 */
export function parsePath(pattern: string): ParsedSegment[] {
	const segments: ParsedSegment[] = [];
	const parts = pattern.split('/').filter(Boolean);

	for (const part of parts) {
		// Route groups like (admin) - ignored in matching
		if (/^\([^)]+\)$/.test(part)) {
			segments.push({
				raw: part,
				type: 'group',
				pattern: '',
			});
			continue;
		}

		// Catch-all with zero or more: :param* or [...param]
		const catchAllZeroMatch = part.match(/^:(\w+)\*$/) || part.match(/^\[\.\.\.(\w+)\]$/);
		if (catchAllZeroMatch) {
			segments.push({
				raw: part,
				type: 'catch-all',
				name: catchAllZeroMatch[1],
				pattern: '(?<{name}>.*)',
			});
			continue;
		}

		// Optional catch-all: [[...param]]
		const optionalCatchAllMatch = part.match(/^\[\[\.\.\.(\w+)\]\]$/);
		if (optionalCatchAllMatch) {
			segments.push({
				raw: part,
				type: 'optional-catch-all',
				name: optionalCatchAllMatch[1],
				pattern: '(?<{name}>.*)',
			});
			continue;
		}

		// One or more: :param+
		const oneOrMoreMatch = part.match(/^:(\w+)\+$/);
		if (oneOrMoreMatch) {
			segments.push({
				raw: part,
				type: 'catch-all',
				name: oneOrMoreMatch[1],
				pattern: '(?<{name}>.+)',
			});
			continue;
		}

		// Optional param: :param? or [param] (Next.js optional route)
		const optionalMatch = part.match(/^:(\w+)\?$/) || part.match(/^\[(\w+)\]$/);
		if (optionalMatch) {
			// Check if it's a Next.js dynamic route [param] vs truly optional :param?
			if (part.startsWith('[') && !part.startsWith('[[')) {
				// [param] is required in Next.js
				segments.push({
					raw: part,
					type: 'param',
					name: optionalMatch[1],
					pattern: '(?<{name}>[^/]+)',
				});
			} else {
				segments.push({
					raw: part,
					type: 'optional',
					name: optionalMatch[1],
					pattern: '(?<{name}>[^/]*)?',
				});
			}
			continue;
		}

		// Required param: :param
		const paramMatch = part.match(/^:(\w+)$/);
		if (paramMatch) {
			segments.push({
				raw: part,
				type: 'param',
				name: paramMatch[1],
				pattern: '(?<{name}>[^/]+)',
			});
			continue;
		}

		// Static segment - escape special regex characters
		segments.push({
			raw: part,
			type: 'static',
			pattern: part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
		});
	}

	return segments;
}

/**
 * Match a path against a pattern
 *
 * @param pathname - The request pathname to match
 * @param pattern - The pattern to match against
 * @param options - Optional matching configuration
 * @returns Match result with extracted params
 *
 * @example
 * ```ts
 * matchPath('/users/123', '/users/:id')
 * // { matched: true, params: { id: '123' } }
 *
 * matchPath('/docs/a/b/c', '/docs/:path*')
 * // { matched: true, params: { path: ['a', 'b', 'c'] } }
 * ```
 */
export function matchPath(
	pathname: string,
	pattern: string,
	options?: PathMatchOptions,
): PathMatchResult {
	// Normalize paths
	const normalizedPath = pathname.replace(/\/$/, '') || '/';
	let normalizedPattern = pattern.replace(/\/$/, '') || '/';

	// Handle basePath
	if (options?.basePath !== false && typeof options?.basePath === 'string' && options.basePath) {
		const basePath = options.basePath.replace(/\/$/, '');
		if (basePath && !normalizedPattern.startsWith(basePath)) {
			normalizedPattern = basePath + normalizedPattern;
		}
	}

	const segments = parsePath(normalizedPattern);

	// Build regex from segments
	let regexStr = '^';
	let hasCatchAll = false;
	let catchAllName = '';
	let catchAllOptional = false;

	for (const segment of segments) {
		if (segment.type === 'group') {
			// Route groups are ignored in matching
			continue;
		}

		if (segment.type === 'catch-all' || segment.type === 'optional-catch-all') {
			// Catch-all consumes the rest of the path
			// Note: catch-all segments always have a name from parsePath
			if (!segment.name) continue;
			hasCatchAll = true;
			catchAllName = segment.name;
			catchAllOptional = segment.type === 'optional-catch-all';
			// Make the preceding slash optional for zero-or-more
			regexStr += catchAllOptional
				? `(?:/(?<${catchAllName}>.*))?$`
				: `(?:/(?<${catchAllName}>.*))?$`;
			break;
		}

		regexStr += '/';
		if (segment.name) {
			regexStr += segment.pattern.replace('{name}', segment.name);
		} else {
			regexStr += segment.pattern;
		}
	}

	if (!hasCatchAll) {
		regexStr += '$';
	}

	try {
		const regex = new RegExp(regexStr);
		const match = normalizedPath.match(regex);

		if (match) {
			const params: Record<string, string | string[]> = {};

			// First, handle explicitly matched groups
			if (match.groups) {
				for (const [key, value] of Object.entries(match.groups)) {
					// Check if this is a catch-all param - split into array
					const segment = segments.find((s) => s.name === key);
					if (segment && (segment.type === 'catch-all' || segment.type === 'optional-catch-all')) {
						params[key] = value ? value.split('/').filter(Boolean) : [];
					} else if (value !== undefined) {
						params[key] = value;
					}
				}
			}

			// For catch-all segments that weren't in groups (empty match), ensure they're set to []
			if (hasCatchAll && !(catchAllName in params)) {
				params[catchAllName] = [];
			}

			return { matched: true, params };
		}
	} catch (error) {
		console.error(`[foxen:config] Invalid pattern: ${pattern}`, error);
	}

	return { matched: false, params: {} };
}

/**
 * Apply parameters to a destination template
 *
 * @param template - The destination template with :param placeholders
 * @param params - Path parameters from matchPath
 * @param captures - Named captures from condition matching
 * @returns The destination with values substituted
 *
 * @example
 * ```ts
 * applyParams('/users/:id/profile', { id: '123' })
 * // '/users/123/profile'
 *
 * applyParams('/docs/:path*', { path: ['a', 'b', 'c'] })
 * // '/docs/a/b/c'
 * ```
 */
export function applyParams(
	template: string,
	params: Record<string, string | string[]>,
	captures?: Record<string, string>,
): string {
	let result = template;

	// First apply captures from conditions
	if (captures) {
		for (const [key, value] of Object.entries(captures)) {
			result = result.replace(new RegExp(`:${key}\\*?`, 'g'), value);
		}
	}

	// Then apply path params
	for (const [key, value] of Object.entries(params)) {
		const replacement = Array.isArray(value) ? value.join('/') : value;
		result = result.replace(new RegExp(`:${key}\\*?`, 'g'), replacement);
	}

	return result;
}

/**
 * Simple cookie parser
 */
function parseCookies(cookieHeader: string): Record<string, string> {
	const cookies: Record<string, string> = {};

	if (!cookieHeader) return cookies;

	for (const pair of cookieHeader.split(';')) {
		const [key, ...valueParts] = pair.trim().split('=');
		if (key) {
			cookies[key] = valueParts.join('=');
		}
	}

	return cookies;
}

/**
 * Match a single condition against request
 */
function matchSingleCondition(
	request: Request,
	url: URL,
	cookies: Record<string, string>,
	condition: RouteCondition,
	shouldMatch: boolean,
): { matches: boolean; captures: Record<string, string> } {
	let value: string | null = null;

	switch (condition.type) {
		case 'header':
			value = request.headers.get(condition.key);
			break;
		case 'cookie':
			value = cookies[condition.key] ?? null;
			break;
		case 'query':
			value = url.searchParams.get(condition.key);
			break;
		case 'host':
			value = url.host;
			break;
	}

	const hasValue = value !== null;

	if (!hasValue) {
		return {
			matches: !shouldMatch,
			captures: {},
		};
	}

	// If no value specified in condition, just check existence
	if (condition.value === undefined) {
		return {
			matches: shouldMatch,
			captures: {},
		};
	}

	// Check value match (supports regex with named capture groups)
	try {
		const regex = new RegExp(`^${condition.value}$`);
		const match = value?.match(regex);

		if (match) {
			// Extract named capture groups
			const captures: Record<string, string> = {};
			if (match.groups) {
				Object.assign(captures, match.groups);
			}

			return {
				matches: shouldMatch,
				captures,
			};
		}

		return {
			matches: !shouldMatch,
			captures: {},
		};
	} catch {
		// If regex fails, do exact match
		const matches = value === condition.value;
		return {
			matches: shouldMatch ? matches : !matches,
			captures: {},
		};
	}
}

/**
 * Match conditions (has/missing) against a request
 *
 * @param request - The incoming request
 * @param has - Conditions that must be present
 * @param missing - Conditions that must be absent
 * @returns Match result with captured values from regex groups
 *
 * @example
 * ```ts
 * matchConditions(request, [
 *   { type: 'header', key: 'x-auth-token' },
 *   { type: 'query', key: 'page', value: '\\d+' },
 * ])
 * // { matches: true, captures: {} }
 *
 * matchConditions(request, [
 *   { type: 'cookie', key: 'session', value: '(?<id>.+)' }
 * ])
 * // { matches: true, captures: { id: 'abc123' } }
 * ```
 */
export function matchConditions(
	request: Request,
	has?: RouteCondition[],
	missing?: RouteCondition[],
): ConditionMatchResult {
	const url = new URL(request.url);
	const cookies = parseCookies(request.headers.get('cookie') || '');
	const captures: Record<string, string> = {};

	// Check 'has' conditions (all must match)
	if (has && has.length > 0) {
		for (const condition of has) {
			const result = matchSingleCondition(request, url, cookies, condition, true);
			if (!result.matches) {
				return { matches: false, captures: {} };
			}
			Object.assign(captures, result.captures);
		}
	}

	// Check 'missing' conditions (all must NOT match)
	if (missing && missing.length > 0) {
		for (const condition of missing) {
			const result = matchSingleCondition(request, url, cookies, condition, false);
			if (!result.matches) {
				return { matches: false, captures: {} };
			}
			// Don't extract captures from 'missing' conditions
		}
	}

	return { matches: true, captures };
}
