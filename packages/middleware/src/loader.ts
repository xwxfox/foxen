import { join, resolve } from 'node:path';
import { pathToRegex } from './matcher.js';
import type {
	LoadedMiddleware,
	MiddlewareConfig,
	MiddlewareLoaderOptions,
	MiddlewareMatcher,
	MiddlewareModule,
	MiddlewareType,
	NormalizedMatcher,
} from './types.js';

/**
 * Default file search order for middleware detection
 */
const MIDDLEWARE_FILES = [
	// Next.js 16+ proxy files (checked first)
	{ path: 'proxy.ts', type: 'proxy' as const },
	{ path: 'proxy.js', type: 'proxy' as const },
	{ path: 'src/proxy.ts', type: 'proxy' as const },
	{ path: 'src/proxy.js', type: 'proxy' as const },
	// Next.js 15 and below middleware files
	{ path: 'middleware.ts', type: 'middleware' as const },
	{ path: 'middleware.js', type: 'middleware' as const },
	{ path: 'src/middleware.ts', type: 'middleware' as const },
	{ path: 'src/middleware.js', type: 'middleware' as const },
];

/**
 * Loads a Next.js middleware.ts or proxy.ts file
 *
 * @param options - Loader options
 * @returns Loaded middleware or null if not found
 *
 * @example
 * ```ts
 * // Auto-detect middleware file
 * const middleware = await loadMiddleware({ projectRoot: process.cwd() });
 *
 * // Load specific file
 * const middleware = await loadMiddleware({
 *   middlewarePath: './src/middleware.ts',
 *   projectRoot: process.cwd(),
 * });
 * ```
 */
export async function loadMiddleware(
	options: MiddlewareLoaderOptions = {},
): Promise<LoadedMiddleware | null> {
	const {
		projectRoot = process.cwd(),
		middlewarePath,
		includeProxy = true,
		verbose = false,
	} = options;

	let filePath: string | null = null;
	let type: MiddlewareType = 'middleware';

	if (middlewarePath) {
		// Use provided path
		filePath = resolve(projectRoot, middlewarePath);
		type = middlewarePath.includes('proxy') ? 'proxy' : 'middleware';
		if (verbose) {
			console.log(`[foxen:middleware] Using provided path: ${filePath}`);
		}
	} else {
		// Auto-detect middleware/proxy file
		const files = includeProxy
			? MIDDLEWARE_FILES
			: MIDDLEWARE_FILES.filter((f) => f.type === 'middleware');

		for (const file of files) {
			const fullPath = join(projectRoot, file.path);
			try {
				const fileHandle = Bun.file(fullPath);
				if (await fileHandle.exists()) {
					filePath = fullPath;
					type = file.type;
					if (verbose) {
						console.log(`[foxen:middleware] Found ${type}: ${filePath}`);
					}
					break;
				}
			} catch {
				// File doesn't exist, continue
			}
		}
	}

	if (!filePath) {
		if (verbose) {
			console.log('[foxen:middleware] No middleware file found');
		}
		return null;
	}

	try {
		const module = (await import(filePath)) as MiddlewareModule;

		// Detect handler and type
		const { handler, detectedType } = detectHandler(module, type);

		if (!handler) {
			if (verbose) {
				console.warn(`[foxen:middleware] No valid handler found in ${filePath}`);
			}
			return null;
		}

		// Compile matchers
		const matchers = normalizeMatchers(module.config);

		if (verbose) {
			console.log(`[foxen:middleware] Loaded ${detectedType} with ${matchers.length} matcher(s)`);
		}

		return {
			type: detectedType,
			filePath,
			handler,
			matchers,
		};
	} catch (error) {
		console.error(`[foxen:middleware] Failed to load ${type}: ${filePath}`, error);
		return null;
	}
}

/**
 * Detect the middleware handler and type from a module
 */
function detectHandler(
	module: MiddlewareModule,
	defaultType: MiddlewareType,
): { handler: MiddlewareModule['middleware']; detectedType: MiddlewareType } {
	// Check for proxy export first (Next.js 16+)
	if (module.proxy && typeof module.proxy === 'function') {
		return { handler: module.proxy, detectedType: 'proxy' };
	}

	// Check for middleware export
	if (module.middleware && typeof module.middleware === 'function') {
		return { handler: module.middleware, detectedType: 'middleware' };
	}

	// Check for default export
	if (module.default && typeof module.default === 'function') {
		return { handler: module.default, detectedType: defaultType };
	}

	return { handler: undefined, detectedType: defaultType };
}

/**
 * Normalize middleware config matchers to internal format
 *
 * @param config - Middleware configuration
 * @returns Array of normalized matchers
 */
export function normalizeMatchers(config?: MiddlewareConfig): NormalizedMatcher[] {
	if (!config?.matcher) {
		// Default matcher: match everything except static files
		return [
			{
				source: '/((?!_next/static|_next/image|favicon.ico).*)',
				regex: /^\/(?!_next\/static|_next\/image|favicon\.ico).*$/,
			},
		];
	}

	const rawMatchers = Array.isArray(config.matcher) ? config.matcher : [config.matcher];
	const matchers: NormalizedMatcher[] = [];

	for (const matcher of rawMatchers) {
		if (typeof matcher === 'string') {
			matchers.push({
				source: matcher,
				regex: pathToRegex(matcher),
			});
		} else {
			matchers.push(normalizeMatcher(matcher));
		}
	}

	return matchers;
}

/**
 * Normalize a single matcher object
 */
function normalizeMatcher(matcher: MiddlewareMatcher): NormalizedMatcher {
	return {
		source: matcher.source,
		regex: matcher.regexp ? new RegExp(matcher.regexp) : pathToRegex(matcher.source),
		has: matcher.has,
		missing: matcher.missing,
		locale: matcher.locale,
	};
}

/**
 * Check if a file exists at the given path
 * Useful for testing or manual file checks
 */
export async function middlewareFileExists(
	projectRoot: string,
	options: { includeProxy?: boolean } = {},
): Promise<{ exists: boolean; path?: string; type?: MiddlewareType }> {
	const { includeProxy = true } = options;
	const files = includeProxy
		? MIDDLEWARE_FILES
		: MIDDLEWARE_FILES.filter((f) => f.type === 'middleware');

	for (const file of files) {
		const fullPath = join(projectRoot, file.path);
		try {
			const fileHandle = Bun.file(fullPath);
			if (await fileHandle.exists()) {
				return { exists: true, path: fullPath, type: file.type };
			}
		} catch {
			// Continue
		}
	}

	return { exists: false };
}
