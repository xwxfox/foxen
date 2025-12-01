import { join, resolve } from 'node:path';
import {
	type MiddlewareConfig,
	type MiddlewareMatcher,
	type RouteCondition,
	createNextRequest,
} from '@foxen/core';

// ============================================
// Types
// ============================================

/** Next.js middleware handler function */
export type NextMiddlewareHandler = (
	request: Request,
) => Response | Promise<Response> | undefined | Promise<undefined> | void | Promise<void>;

/** Loaded middleware module */
export interface MiddlewareModule {
	default?: NextMiddlewareHandler;
	proxy?: NextMiddlewareHandler;
	middleware?: NextMiddlewareHandler;
	config?: MiddlewareConfig;
}

/** Result from middleware execution */
export interface MiddlewareResult {
	/** Whether to continue to the route handler */
	continue: boolean;
	/** Response to return (if not continuing) */
	response?: Response;
	/** Modified request (if continuing) */
	request?: Request;
	/** Rewrite destination (internal rewrite) */
	rewriteTo?: string;
}

/** Loaded middleware configuration */
export interface LoadedMiddleware {
	handler: NextMiddlewareHandler;
	matchers: CompiledMatcher[];
	type: 'proxy' | 'middleware';
}

/** Compiled matcher for fast matching */
export interface CompiledMatcher {
	source: string;
	regex: RegExp;
	locale?: boolean;
	has?: MiddlewareMatcher['has'];
	missing?: MiddlewareMatcher['missing'];
}

// ============================================
// Loader
// ============================================

/**
 * Loads a Next.js middleware.ts or proxy.ts file.
 */
export async function loadMiddleware(
	middlewarePath?: string,
	projectRoot: string = process.cwd(),
): Promise<LoadedMiddleware | null> {
	let filePath: string | null = null;
	let type: 'proxy' | 'middleware' = 'middleware';

	if (middlewarePath) {
		filePath = resolve(projectRoot, middlewarePath);
		type = middlewarePath.includes('proxy') ? 'proxy' : 'middleware';
	} else {
		// Auto-detect middleware/proxy file
		const possibleFiles = [
			{ path: 'proxy.ts', type: 'proxy' as const },
			{ path: 'proxy.js', type: 'proxy' as const },
			{ path: 'src/proxy.ts', type: 'proxy' as const },
			{ path: 'src/proxy.js', type: 'proxy' as const },
			{ path: 'middleware.ts', type: 'middleware' as const },
			{ path: 'middleware.js', type: 'middleware' as const },
			{ path: 'src/middleware.ts', type: 'middleware' as const },
			{ path: 'src/middleware.js', type: 'middleware' as const },
		];

		for (const file of possibleFiles) {
			const fullPath = join(projectRoot, file.path);
			try {
				const fileHandle = Bun.file(fullPath);
				if (await fileHandle.exists()) {
					filePath = fullPath;
					type = file.type;
					break;
				}
			} catch {
				// File doesn't exist, continue
			}
		}
	}

	if (!filePath) {
		return null;
	}

	try {
		const module = (await import(filePath)) as MiddlewareModule;
		const handler = module.proxy || module.middleware || module.default;

		if (!handler || typeof handler !== 'function') {
			console.warn(`[foxen] No valid handler found in ${filePath}`);
			return null;
		}

		const matchers = compileMatchers(module.config);

		return {
			handler,
			matchers,
			type,
		};
	} catch (error) {
		console.error(`[foxen] Failed to load ${type}: ${filePath}`, error);
		return null;
	}
}

// ============================================
// Matcher Compilation
// ============================================

/**
 * Compiles matcher configuration into regex patterns.
 */
function compileMatchers(config?: MiddlewareConfig): CompiledMatcher[] {
	if (!config?.matcher) {
		return [
			{
				source: '/:path*',
				regex: /^.*$/,
			},
		];
	}

	const matchers: CompiledMatcher[] = [];
	const rawMatchers = Array.isArray(config.matcher) ? config.matcher : [config.matcher];

	for (const matcher of rawMatchers) {
		if (typeof matcher === 'string') {
			matchers.push({
				source: matcher,
				regex: pathToRegex(matcher),
			});
		} else {
			matchers.push({
				source: matcher.source,
				regex: pathToRegex(matcher.source),
				locale: matcher.locale,
				has: matcher.has,
				missing: matcher.missing,
			});
		}
	}

	return matchers;
}

/**
 * Converts a Next.js path pattern to a regex.
 */
function pathToRegex(pattern: string): RegExp {
	const regexStr = pattern
		.replace(/[.+^${}|[\]\\]/g, '\\$&')
		.replace(/\(\(\?!([^)]+)\)\.\*\)/g, '((?!$1).*)')
		.replace(/:(\w+)\*/g, '(.*)')
		.replace(/:(\w+)\+/g, '(.+)')
		.replace(/:(\w+)\?/g, '([^/]*)?')
		.replace(/:(\w+)/g, '([^/]+)');

	return new RegExp(`^${regexStr}$`);
}

// ============================================
// Matching
// ============================================

/**
 * Checks if a request matches any of the middleware matchers.
 */
export function shouldRunMiddleware(request: Request, matchers: CompiledMatcher[]): boolean {
	const url = new URL(request.url);
	const pathname = url.pathname;

	for (const matcher of matchers) {
		if (!matcher.regex.test(pathname)) {
			continue;
		}

		if (!matchesConditions(request, matcher.has, matcher.missing)) {
			continue;
		}

		return true;
	}

	return false;
}

/**
 * Check if request matches has/missing conditions.
 */
export function matchesConditions(
	request: Request,
	has?: RouteCondition[],
	missing?: RouteCondition[],
): boolean {
	const url = new URL(request.url);

	// Check 'has' conditions - all must match
	if (has) {
		for (const condition of has) {
			if (!checkCondition(request, url, condition, true)) {
				return false;
			}
		}
	}

	// Check 'missing' conditions - all must NOT match
	if (missing) {
		for (const condition of missing) {
			if (checkCondition(request, url, condition, true)) {
				return false;
			}
		}
	}

	return true;
}

function checkCondition(
	request: Request,
	url: URL,
	condition: RouteCondition,
	checkValue: boolean,
): boolean {
	let actualValue: string | null = null;

	switch (condition.type) {
		case 'header':
			actualValue = request.headers.get(condition.key);
			break;
		case 'cookie': {
			const cookies = request.headers.get('cookie') || '';
			const match = cookies.match(new RegExp(`(?:^|;\\s*)${condition.key}=([^;]*)`));
			actualValue = match ? (match[1] ?? null) : null;
			break;
		}
		case 'host':
			actualValue = url.hostname;
			break;
		case 'query':
			actualValue = url.searchParams.get(condition.key);
			break;
	}

	// If no value specified, just check existence
	if (!condition.value) {
		return actualValue !== null;
	}

	if (!checkValue || !actualValue) {
		return actualValue !== null;
	}

	// Check if value matches (supports regex)
	try {
		const regex = new RegExp(`^${condition.value}$`);
		return regex.test(actualValue);
	} catch {
		return actualValue === condition.value;
	}
}

// ============================================
// Execution
// ============================================

/**
 * Executes middleware and processes the result.
 */
export async function executeMiddleware(
	request: Request,
	handler: NextMiddlewareHandler,
	options?: {
		basePath?: string;
		locale?: string;
		defaultLocale?: string;
		locales?: string[];
	},
): Promise<MiddlewareResult> {
	try {
		const nextRequest = createNextRequest(request, {
			nextConfig: {
				basePath: options?.basePath,
				i18n: options?.locales
					? {
							locales: options.locales,
							defaultLocale: options.defaultLocale ?? options.locales[0] ?? 'en',
						}
					: undefined,
			},
		});

		const result = await handler(nextRequest as unknown as Request);

		if (result === undefined || result === null) {
			return { continue: true };
		}

		if (result instanceof Response) {
			return processMiddlewareResponse(result, request);
		}

		return { continue: true };
	} catch (error) {
		console.error('[foxen] Middleware error:', error);
		return {
			continue: false,
			response: new Response(JSON.stringify({ error: 'Middleware Error' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			}),
		};
	}
}

/**
 * Processes a Response from middleware.
 */
function processMiddlewareResponse(response: Response, originalRequest: Request): MiddlewareResult {
	const rewriteUrl = response.headers.get('x-middleware-rewrite');
	const nextHeader = response.headers.get('x-middleware-next');

	const responseCookies: string[] = [];
	const setCookies = response.headers.getSetCookie?.() || [];
	responseCookies.push(...setCookies);

	// Rewrite
	if (rewriteUrl) {
		return {
			continue: true,
			rewriteTo: rewriteUrl,
			response: responseCookies.length > 0 ? createCookieResponse(responseCookies) : undefined,
		};
	}

	// NextResponse.next()
	if (nextHeader === '1') {
		const modifiedHeaders = new Headers(originalRequest.headers);

		for (const [key, value] of response.headers) {
			if (key.toLowerCase().startsWith('x-middleware-request-')) {
				const headerName = key.slice('x-middleware-request-'.length);
				modifiedHeaders.set(headerName, value);
			}
		}

		const newRequest = new Request(originalRequest.url, {
			method: originalRequest.method,
			headers: modifiedHeaders,
			body: originalRequest.body,
			// @ts-ignore - duplex is required for streaming bodies
			duplex: 'half',
		});

		return {
			continue: true,
			request: newRequest,
			response: responseCookies.length > 0 ? createCookieResponse(responseCookies) : undefined,
		};
	}

	// Redirect
	if (response.status >= 300 && response.status < 400) {
		const location = response.headers.get('location');
		if (location) {
			const redirectResponse = new Response(null, {
				status: response.status,
				headers: { location },
			});

			for (const cookie of responseCookies) {
				redirectResponse.headers.append('set-cookie', cookie);
			}

			return {
				continue: false,
				response: redirectResponse,
			};
		}
	}

	// Regular response
	return {
		continue: false,
		response,
	};
}

function createCookieResponse(cookies: string[]): Response {
	const response = new Response(null, { status: 200 });
	for (const cookie of cookies) {
		response.headers.append('set-cookie', cookie);
	}
	return response;
}
