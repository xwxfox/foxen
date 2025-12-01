/**
 * Matcher pattern type
 */
export type MatcherPattern = string | RegExp | MatcherConfig;

/**
 * Matcher configuration
 */
export interface MatcherConfig {
	/** Source pattern (path) */
	source: string;
	/** Regular expression flags */
	regexp?: string;
	/** Locale settings */
	locale?: boolean;
	/** Check if has specific header */
	has?: Array<{
		type: 'header' | 'cookie' | 'query' | 'host';
		key: string;
		value?: string;
	}>;
	/** Check if missing specific header */
	missing?: Array<{
		type: 'header' | 'cookie' | 'query' | 'host';
		key: string;
		value?: string;
	}>;
}

/**
 * Compiled matcher function
 */
export type CompiledMatcher = (pathname: string, request?: Request) => boolean;

/**
 * Compile a matcher pattern into a function
 */
export function compileMatcher(pattern: MatcherPattern): CompiledMatcher {
	if (typeof pattern === 'string') {
		return compileStringPattern(pattern);
	}

	if (pattern instanceof RegExp) {
		return (pathname) => pattern.test(pathname);
	}

	return compileMatcherConfig(pattern);
}

/**
 * Compile a string pattern
 */
function compileStringPattern(pattern: string): CompiledMatcher {
	// Handle exact match
	if (!pattern.includes(':') && !pattern.includes('*') && !pattern.includes('(')) {
		return (pathname) => pathname === pattern;
	}

	// Convert Next.js pattern to regex
	const regexPattern = patternToRegex(pattern);
	const regex = new RegExp(`^${regexPattern}$`);

	return (pathname) => regex.test(pathname);
}

/**
 * Convert Next.js path pattern to regex
 */
function patternToRegex(pattern: string): string {
	// Use placeholders to avoid regex conflicts
	const CATCHALL_PLACEHOLDER = '___CATCHALL___';
	const PARAM_PLACEHOLDER = '___PARAM___';

	const regex = pattern
		// Catch-all parameters :param* (must match 0 or more path segments)
		.replace(/:([^/*]+)\*/g, CATCHALL_PLACEHOLDER)
		// Named parameters :param
		.replace(/:([^/]+)/g, PARAM_PLACEHOLDER)
		// Escape special regex characters
		.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
		// Standalone wildcard *
		.replace(/\*/g, '.*')
		// Replace placeholders with actual regex
		.replace(new RegExp(CATCHALL_PLACEHOLDER, 'g'), '(.*)')
		.replace(new RegExp(PARAM_PLACEHOLDER, 'g'), '([^/]+)');

	return regex;
}

/**
 * Compile a matcher config
 */
function compileMatcherConfig(config: MatcherConfig): CompiledMatcher {
	const sourcePattern = config.regexp
		? new RegExp(config.source, config.regexp)
		: new RegExp(`^${patternToRegex(config.source)}$`);

	return (pathname, request) => {
		// Check source pattern
		if (!sourcePattern.test(pathname)) {
			return false;
		}

		// Check "has" conditions
		if (config.has && request) {
			for (const condition of config.has) {
				if (!checkCondition(condition, request, true)) {
					return false;
				}
			}
		}

		// Check "missing" conditions
		if (config.missing && request) {
			for (const condition of config.missing) {
				if (!checkCondition(condition, request, false)) {
					return false;
				}
			}
		}

		return true;
	};
}

/**
 * Check a has/missing condition
 */
function checkCondition(
	condition: NonNullable<MatcherConfig['has']>[0],
	request: Request,
	shouldHave: boolean,
): boolean {
	let value: string | null = null;

	switch (condition.type) {
		case 'header':
			value = request.headers.get(condition.key);
			break;
		case 'cookie': {
			const cookies = request.headers.get('cookie');
			if (cookies) {
				const match = cookies.match(new RegExp(`(?:^|;\\s*)${condition.key}=([^;]*)`));
				value = match?.[1] ?? null;
			}
			break;
		}
		case 'query': {
			const url = new URL(request.url);
			value = url.searchParams.get(condition.key);
			break;
		}
		case 'host': {
			const url = new URL(request.url);
			value = url.host;
			break;
		}
	}

	const hasValue = value !== null;

	if (shouldHave) {
		// For "has" condition
		if (!hasValue) return false;
		if (condition.value && value !== condition.value) return false;
	} else {
		// For "missing" condition
		if (hasValue) {
			if (!condition.value) return false;
			if (value === condition.value) return false;
		}
	}

	return true;
}

/**
 * Compile multiple matchers
 */
export function compileMatchers(patterns: MatcherPattern | MatcherPattern[]): CompiledMatcher {
	const patternArray = Array.isArray(patterns) ? patterns : [patterns];
	const compiled = patternArray.map(compileMatcher);

	return (pathname, request) => {
		return compiled.some((matcher) => matcher(pathname, request));
	};
}

/**
 * Create a matcher that matches all paths except specified patterns
 */
export function createExcludeMatcher(excludePatterns: MatcherPattern[]): CompiledMatcher {
	const excludeMatcher = compileMatchers(excludePatterns);

	return (pathname, request) => {
		return !excludeMatcher(pathname, request);
	};
}

/**
 * Default patterns to exclude from middleware
 * These are typically static files and internal Next.js paths
 */
export const defaultExcludePatterns: string[] = [
	'/_next/static/:path*',
	'/_next/image/:path*',
	'/favicon.ico',
	'/robots.txt',
	'/sitemap.xml',
	'/api/health',
];

/**
 * Create middleware matcher with default exclusions
 */
export function createMiddlewareMatcher(
	includePatterns: MatcherPattern[],
	options?: {
		excludePatterns?: MatcherPattern[];
		includeDefaultExclusions?: boolean;
	},
): CompiledMatcher {
	const includeMatcher = compileMatchers(includePatterns);

	const excludeList: MatcherPattern[] = [
		...(options?.includeDefaultExclusions !== false ? defaultExcludePatterns : []),
		...(options?.excludePatterns ?? []),
	];

	const excludeMatcher = compileMatchers(excludeList);

	return (pathname, request) => {
		if (excludeMatcher(pathname, request)) {
			return false;
		}
		return includeMatcher(pathname, request);
	};
}
