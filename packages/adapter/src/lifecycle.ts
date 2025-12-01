import {
	applyHeadersToResponse,
	processHeaders,
	processRedirects,
	processRewrites,
} from '@foxen/config';
import { executeMiddleware, shouldRunMiddleware } from '@foxen/middleware';
import { getFoxenContext, updateFoxenContext } from './context.js';
import type { LifecycleOptions, RuntimeContext } from './types.js';

/**
 * Log helper for verbose mode
 */
function log(verbose: boolean | undefined, message: string): void {
	if (verbose) {
		console.log(`[foxen:lifecycle] ${message}`);
	}
}

// =============================================================================
// onRequest Handler
// =============================================================================

/**
 * Create the onRequest lifecycle handler.
 *
 * This runs earliest, before route matching. It handles:
 * - Processing redirects from next.config (return redirect response)
 * - Processing beforeFiles rewrites
 * - Executing middleware if path matches
 * - Storing results in context for later hooks
 *
 * @param options - Lifecycle options including middleware, config, etc.
 * @returns Elysia onRequest handler function
 */
export function createOnRequestHandler(options: LifecycleOptions) {
	const { middleware, nextConfig, config } = options;
	const verbose = config.verbose;
	const features = config.features ?? {};
	const basePath = config.basePath ?? nextConfig?.basePath;

	return async (ctx: {
		request: Request;
		set: { headers: Record<string, string>; status?: number };
	}) => {
		const request = ctx.request;
		const url = new URL(request.url);

		log(verbose, `onRequest: ${request.method} ${url.pathname}`);

		// Initialize Foxen context
		const foxenCtx: RuntimeContext = {
			_basePath: basePath,
			_middlewareRan: false,
		};
		updateFoxenContext(ctx, foxenCtx);

		// 1. Process redirects (if enabled)
		if (nextConfig && features.redirects !== false && nextConfig.redirects.length > 0) {
			const redirectResult = processRedirects(request, nextConfig.redirects, {
				basePath,
			});

			if (redirectResult.matched && redirectResult.response) {
				log(
					verbose,
					`Redirect matched: ${redirectResult.rule?.source} -> ${redirectResult.rule?.destination}`,
				);
				return redirectResult.response;
			}
		}

		// 2. Process beforeFiles rewrites (if enabled)
		if (nextConfig && features.rewrites !== false) {
			const beforeFilesRewrites = nextConfig.rewrites.beforeFiles ?? [];
			if (beforeFilesRewrites.length > 0) {
				const rewriteResult = processRewrites(request, nextConfig.rewrites, 'beforeFiles', {
					basePath,
				});

				if (rewriteResult.matched) {
					log(
						verbose,
						`beforeFiles rewrite matched: ${rewriteResult.rule?.source} -> ${rewriteResult.pathname || rewriteResult.externalUrl}`,
					);

					if (rewriteResult.isExternal && rewriteResult.externalUrl) {
						// External rewrite - proxy to external URL
						updateFoxenContext(ctx, { _rewriteTo: rewriteResult.externalUrl });
					} else if (rewriteResult.pathname) {
						// Internal rewrite - modify the request path
						updateFoxenContext(ctx, { _rewriteTo: rewriteResult.pathname });
					}
				}
			}
		}

		// 3. Process response headers (collect for later application)
		if (nextConfig && features.headers !== false && nextConfig.headers.length > 0) {
			const headersResult = processHeaders(request, nextConfig.headers, {
				basePath,
			});

			if (headersResult.headers.length > 0) {
				log(verbose, `Headers matched: ${headersResult.matchedRules.length} rules`);
				updateFoxenContext(ctx, { _nextHeaders: headersResult.headers });
			}
		}

		// 4. Execute middleware (if enabled and matches)
		if (middleware && features.middleware !== false) {
			if (shouldRunMiddleware(request, middleware.matchers)) {
				log(verbose, `Running middleware for ${url.pathname}`);

				const middlewareResult = await executeMiddleware(request, middleware.handler, {
					basePath,
					continueOnError: config.continueOnMiddlewareError ?? false,
					verbose,
				});

				updateFoxenContext(ctx, { _middlewareRan: true });

				// Handle middleware result
				if (!middlewareResult.continue) {
					// Middleware returned a response (redirect, error, etc.)
					log(
						verbose,
						`Middleware returned response with status ${middlewareResult.response?.status}`,
					);
					return middlewareResult.response;
				}

				// Store middleware modifications
				if (middlewareResult.rewriteTo) {
					log(verbose, `Middleware rewrite to: ${middlewareResult.rewriteTo}`);
					updateFoxenContext(ctx, { _rewriteTo: middlewareResult.rewriteTo });
				}

				if (middlewareResult.request) {
					log(verbose, 'Middleware modified request');
					updateFoxenContext(ctx, { _modifiedRequest: middlewareResult.request });
				}

				// Collect response headers from middleware
				if (middlewareResult.responseHeaders) {
					const existing = getFoxenContext(ctx)._nextHeaders ?? [];
					const middlewareHeaders: Array<{ key: string; value: string }> = [];
					for (const [key, value] of middlewareResult.responseHeaders) {
						middlewareHeaders.push({ key, value });
					}
					updateFoxenContext(ctx, {
						_nextHeaders: [...existing, ...middlewareHeaders],
					});
				}
			}
		}

		// Continue to routing
		return;
	};
}

// =============================================================================
// onBeforeHandle Handler
// =============================================================================

/**
 * Create the onBeforeHandle lifecycle handler.
 *
 * This runs after route matching, before the handler. It handles:
 * - Processing afterFiles rewrites (if no rewrite yet and route matched)
 * - Applying request modifications from middleware
 *
 * @param options - Lifecycle options
 * @returns Elysia onBeforeHandle handler function
 */
export function createOnBeforeHandleHandler(options: LifecycleOptions) {
	const { nextConfig, config } = options;
	const verbose = config.verbose;
	const features = config.features ?? {};
	const basePath = config.basePath ?? nextConfig?.basePath;

	return async (ctx: { request: Request }) => {
		const foxenCtx = getFoxenContext(ctx);

		// If there's already a rewrite, we don't need afterFiles
		if (foxenCtx._rewriteTo) {
			log(verbose, `onBeforeHandle: Already rewritten to ${foxenCtx._rewriteTo}`);
			return;
		}

		// Process afterFiles rewrites (only if a route matched)
		if (nextConfig && features.rewrites !== false) {
			const afterFilesRewrites = nextConfig.rewrites.afterFiles ?? [];
			if (afterFilesRewrites.length > 0) {
				const request = foxenCtx._modifiedRequest ?? ctx.request;
				const rewriteResult = processRewrites(request, nextConfig.rewrites, 'afterFiles', {
					basePath,
				});

				if (rewriteResult.matched) {
					log(
						verbose,
						`afterFiles rewrite matched: ${rewriteResult.rule?.source} -> ${rewriteResult.pathname || rewriteResult.externalUrl}`,
					);

					if (rewriteResult.isExternal && rewriteResult.externalUrl) {
						updateFoxenContext(ctx, { _rewriteTo: rewriteResult.externalUrl });
					} else if (rewriteResult.pathname) {
						updateFoxenContext(ctx, { _rewriteTo: rewriteResult.pathname });
					}
				}
			}
		}

		return;
	};
}

// =============================================================================
// onAfterHandle Handler
// =============================================================================

/**
 * Create the onAfterHandle lifecycle handler.
 *
 * This runs after the handler returns, before the response is sent.
 * It applies collected headers to the response.
 *
 * @param _options - Lifecycle options
 * @returns Elysia onAfterHandle handler function
 */
export function createOnAfterHandleHandler(_options: LifecycleOptions) {
	return async (ctx: { response: Response | unknown }) => {
		const foxenCtx = getFoxenContext(ctx);

		// Only apply headers if response is a Response object
		if (!(ctx.response instanceof Response)) {
			return ctx.response;
		}

		let response = ctx.response;

		// Apply collected headers
		if (foxenCtx._nextHeaders && foxenCtx._nextHeaders.length > 0) {
			response = applyHeadersToResponse(response, foxenCtx._nextHeaders);
		}

		return response;
	};
}

// =============================================================================
// onError Handler
// =============================================================================

/**
 * Create the onError lifecycle handler.
 *
 * This runs on any error, including 404s. It handles:
 * - Processing fallback rewrites for 404s
 * - External proxy for fallback destinations
 *
 * @param options - Lifecycle options
 * @returns Elysia onError handler function
 */
export function createOnErrorHandler(options: LifecycleOptions) {
	const { nextConfig, config } = options;
	const verbose = config.verbose;
	const features = config.features ?? {};
	const basePath = config.basePath ?? nextConfig?.basePath;

	return async (ctx: {
		request: Request;
		code: string;
		error: Error;
		set: { status?: number };
	}) => {
		// Only handle NOT_FOUND errors for fallback rewrites
		if (ctx.code !== 'NOT_FOUND') {
			log(verbose, `onError: ${ctx.code} - ${ctx.error.message}`);
			return;
		}

		// Process fallback rewrites
		if (nextConfig && features.rewrites !== false) {
			const fallbackRewrites = nextConfig.rewrites.fallback ?? [];
			if (fallbackRewrites.length > 0) {
				const request = ctx.request;
				const rewriteResult = processRewrites(request, nextConfig.rewrites, 'fallback', {
					basePath,
				});

				if (rewriteResult.matched) {
					log(
						verbose,
						`fallback rewrite matched: ${rewriteResult.rule?.source} -> ${rewriteResult.pathname || rewriteResult.externalUrl}`,
					);

					if (rewriteResult.isExternal && rewriteResult.externalUrl) {
						// Proxy to external URL
						try {
							log(verbose, `Proxying to external: ${rewriteResult.externalUrl}`);
							const proxyResponse = await fetch(rewriteResult.externalUrl, {
								method: request.method,
								headers: request.headers,
								body: request.body,
								// @ts-expect-error - duplex required for streaming
								duplex: request.body ? 'half' : undefined,
							});
							return proxyResponse;
						} catch (error) {
							log(verbose, `Proxy error: ${error}`);
							// Fall through to default error handling
						}
					} else if (rewriteResult.pathname) {
						// Internal fallback - this is tricky as we can't re-route
						// Log for debugging, but let the 404 through
						log(
							verbose,
							`Internal fallback: ${rewriteResult.pathname} (cannot re-route in error handler)`,
						);
					}
				}
			}
		}

		// Let default error handling continue
		return;
	};
}

// =============================================================================
// Register All Hooks
// =============================================================================

/**
 * Register all Foxen lifecycle hooks on an Elysia app.
 *
 * @param app - The Elysia app instance
 * @param options - Lifecycle options
 */
export function registerLifecycleHooks(
	app: {
		onRequest: (fn: ReturnType<typeof createOnRequestHandler>) => unknown;
		onBeforeHandle: (fn: ReturnType<typeof createOnBeforeHandleHandler>) => unknown;
		onAfterHandle: (fn: ReturnType<typeof createOnAfterHandleHandler>) => unknown;
		onError: (fn: ReturnType<typeof createOnErrorHandler>) => unknown;
	},
	options: LifecycleOptions,
): void {
	const { middleware, nextConfig, config } = options;
	const features = config.features ?? {};

	// Only register hooks if there's something to do
	const hasRedirects =
		nextConfig && features.redirects !== false && nextConfig.redirects.length > 0;
	const hasRewrites =
		nextConfig &&
		features.rewrites !== false &&
		((nextConfig.rewrites.beforeFiles?.length ?? 0) > 0 ||
			(nextConfig.rewrites.afterFiles?.length ?? 0) > 0 ||
			(nextConfig.rewrites.fallback?.length ?? 0) > 0);
	const hasHeaders = nextConfig && features.headers !== false && nextConfig.headers.length > 0;
	const hasMiddleware = middleware && features.middleware !== false;

	// onRequest - redirects, beforeFiles rewrites, middleware
	if (hasRedirects || hasRewrites || hasMiddleware || hasHeaders) {
		app.onRequest(createOnRequestHandler(options));
	}

	// onBeforeHandle - afterFiles rewrites
	if (hasRewrites) {
		app.onBeforeHandle(createOnBeforeHandleHandler(options));
	}

	// onAfterHandle - apply headers
	if (hasHeaders || hasMiddleware) {
		app.onAfterHandle(createOnAfterHandleHandler(options));
	}

	// onError - fallback rewrites
	if (hasRewrites && (nextConfig?.rewrites.fallback?.length ?? 0) > 0) {
		app.onError(createOnErrorHandler(options));
	}
}
