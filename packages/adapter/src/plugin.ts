import { dirname, resolve } from 'node:path';
import { type ResolvedNextConfig, loadNextConfig } from '@foxen/config';
import type { HttpMethod, RouteModule } from '@foxen/core';
import { type LoadedMiddleware, loadMiddleware } from '@foxen/middleware';
import { Elysia, t } from 'elysia';
import { defaultAdapter } from './adapter.js';
import { registerLifecycleHooks } from './lifecycle.js';
import { scanDirectory } from './scanner.js';
import type { AppRouterConfig, ParamInfo, RouteInfo } from './types.js';

// ============================================
// Default Configuration
// ============================================

const defaultConfig = {
	apiDir: './src/app/api',
	basePath: '',
	stripApiPrefix: false,
	adapter: defaultAdapter,
	verbose: false,
	middlewarePath: undefined as string | false | undefined,
	nextConfigPath: undefined as string | false | undefined,
	projectRoot: undefined as string | undefined,
	features: {
		redirects: true,
		rewrites: true,
		headers: true,
		middleware: true,
	},
	continueOnMiddlewareError: false,
};

/**
 * Log helper
 */
function log(verbose: boolean | undefined, message: string): void {
	if (verbose) {
		console.log(`[foxen] ${message}`);
	}
}

// ============================================
// Plugin Factory
// ============================================

/**
 * Creates an Elysia plugin that loads Next.js App Router API routes.
 *
 * @example
 * ```ts
 * import { Elysia } from 'elysia';
 * import { appRouter } from '@foxen/adapter';
 *
 * const app = new Elysia()
 *   .use(await appRouter({ apiDir: './src/app/api' }))
 *   .listen(3000);
 * ```
 *
 * @example With next.config features
 * ```ts
 * const app = new Elysia()
 *   .use(await appRouter({
 *     apiDir: './src/app/api',
 *     nextConfigPath: './next.config.ts',
 *     middlewarePath: './middleware.ts',
 *     features: {
 *       redirects: true,
 *       rewrites: true,
 *       headers: true,
 *       middleware: true,
 *     }
 *   }))
 *   .listen(3000);
 * ```
 */
export async function appRouter(config: Partial<AppRouterConfig> = {}) {
	const cfg = { ...defaultConfig, ...config };
	const projectRoot = cfg.projectRoot || process.cwd();
	const absoluteApiDir = resolve(projectRoot, cfg.apiDir);

	log(cfg.verbose, `Scanning directory: ${absoluteApiDir}`);
	log(cfg.verbose, `Project root: ${projectRoot}`);

	// Load next.config.ts if not disabled
	let nextConfig: ResolvedNextConfig | null = null;
	if (cfg.nextConfigPath !== false) {
		nextConfig = await loadNextConfig(
			typeof cfg.nextConfigPath === 'string' ? cfg.nextConfigPath : undefined,
			projectRoot,
		);

		if (nextConfig && cfg.verbose) {
			log(
				true,
				`Loaded next.config: basePath="${nextConfig.basePath}", ` +
					`${nextConfig.redirects.length} redirects, ` +
					`${(nextConfig.rewrites.beforeFiles?.length ?? 0) + (nextConfig.rewrites.afterFiles?.length ?? 0) + (nextConfig.rewrites.fallback?.length ?? 0)} rewrites, ` +
					`${nextConfig.headers.length} header rules`,
			);
		}
	}

	// Merge basePath from next.config if not explicitly set
	if (!cfg.basePath && nextConfig?.basePath) {
		cfg.basePath = nextConfig.basePath;
	}

	// Load middleware if not disabled
	let middleware: LoadedMiddleware | null = null;
	if (cfg.middlewarePath !== false) {
		middleware = await loadMiddleware({
			projectRoot,
			middlewarePath: typeof cfg.middlewarePath === 'string' ? cfg.middlewarePath : undefined,
			verbose: cfg.verbose,
		});

		if (middleware && cfg.verbose) {
			log(true, `Loaded ${middleware.type} with ${middleware.matchers.length} matchers`);
		}
	}

	// Scan for routes
	const routes = await scanDirectory(absoluteApiDir);

	log(cfg.verbose, `Found ${routes.length} route files`);

	// Create the plugin
	const plugin = new Elysia({ name: 'foxen' });

	// Register lifecycle hooks for middleware and config features
	const hasFeatures = middleware !== null || nextConfig !== null;
	if (hasFeatures) {
		registerLifecycleHooks(plugin as unknown as Parameters<typeof registerLifecycleHooks>[0], {
			middleware,
			nextConfig,
			config: cfg as AppRouterConfig,
		});
	}

	// Register each route
	for (const route of routes) {
		await registerRoute(plugin, route, {
			...cfg,
			basePath: cfg.basePath || '',
			stripApiPrefix: cfg.stripApiPrefix || false,
			adapter: cfg.adapter || defaultAdapter,
			verbose: cfg.verbose || false,
		} as Required<AppRouterConfig>);
	}

	return plugin;
}

/**
 * Registers a single route with Elysia.
 */
async function registerRoute(
	app: Elysia,
	route: RouteInfo,
	config: Required<AppRouterConfig>,
): Promise<void> {
	// Load the route module
	let module: RouteModule;
	try {
		module = await import(route.filePath);
	} catch (error) {
		console.error(`[foxen] Failed to load route: ${route.filePath}`, error);
		return;
	}

	// Try to load schema.ts file if it exists
	let schemaModule: Record<string, unknown> | null = null;
	const routeDir = dirname(route.filePath);
	const schemaPath = resolve(routeDir, 'schema.ts');

	try {
		const schemaFile = Bun.file(schemaPath);
		if (await schemaFile.exists()) {
			schemaModule = await import(schemaPath);
		}
	} catch {
		// No schema file, that's ok
	}

	// Calculate the final path
	let finalPath = route.elysiaPath;

	if (config.basePath) {
		finalPath = config.basePath + finalPath;
	}

	if (config.stripApiPrefix && finalPath.startsWith('/api')) {
		finalPath = finalPath.slice(4) || '/';
	}

	if (!finalPath.startsWith('/')) {
		finalPath = `/${finalPath}`;
	}

	// Register each HTTP method
	for (const method of route.methods) {
		const handler = module[method];
		if (!handler || typeof handler !== 'function') continue;

		const elysiaHandler = config.adapter(handler, route, method);
		const routeOptions = buildRouteOptions(module, schemaModule, method, route);

		const methodLower = method.toLowerCase() as
			| 'get'
			| 'post'
			| 'put'
			| 'patch'
			| 'delete'
			| 'head'
			| 'options';

		if (config.verbose) {
			console.log(`[foxen] Registering ${method} ${finalPath}`);
		}

		// Use type assertion to call dynamic methods on Elysia
		// biome-ignore lint/suspicious/noExplicitAny: Dynamic method dispatch requires any
		const appAny = app as any;

		if (Object.keys(routeOptions).length > 0) {
			appAny[methodLower](finalPath, elysiaHandler, routeOptions);
		} else {
			appAny[methodLower](finalPath, elysiaHandler);
		}

		// For optional catch-all routes, also register the base path
		if (route.isOptionalCatchAll && finalPath.endsWith('/*')) {
			const basePath = finalPath.slice(0, -2) || '/';

			if (config.verbose) {
				console.log(`[foxen] Registering ${method} ${basePath} (optional catch-all base)`);
			}

			if (Object.keys(routeOptions).length > 0) {
				appAny[methodLower](basePath, elysiaHandler, routeOptions);
			} else {
				appAny[methodLower](basePath, elysiaHandler);
			}
		}
	}
}

/**
 * Generate TypeBox params schema from route param info.
 */
function generateParamsSchema(params: ParamInfo[]) {
	const paramsObj: Record<string, ReturnType<typeof t.String>> = {};
	for (const param of params) {
		if (param.name === '*' || param.isCatchAll) {
			paramsObj[param.name === '*' ? '*' : param.name] = t.Optional(
				t.Union([t.String(), t.Array(t.String())]),
			) as unknown as ReturnType<typeof t.String>;
		} else if (param.isOptional) {
			paramsObj[param.name] = t.Optional(t.String()) as unknown as ReturnType<typeof t.String>;
		} else {
			paramsObj[param.name] = t.String();
		}
	}
	return t.Object(paramsObj);
}

/**
 * Build Elysia route options from module schemas.
 */
function buildRouteOptions(
	routeModule: RouteModule,
	schemaModule: Record<string, unknown> | null,
	method: HttpMethod,
	routeInfo: RouteInfo,
): Record<string, unknown> {
	const options: Record<string, unknown> = {};
	const mod = routeModule as Record<string, unknown>;

	// Check for schema export in route module
	const schemaExport = mod.schema as Record<string, Record<string, unknown>> | undefined;
	if (schemaExport?.[method]) {
		const methodSchema = schemaExport[method];

		if (methodSchema.query) options.query = methodSchema.query;
		if (methodSchema.body) options.body = methodSchema.body;
		if (methodSchema.params) options.params = methodSchema.params;
		if (methodSchema.headers) options.headers = methodSchema.headers;
		if (methodSchema.response) options.response = methodSchema.response;

		const detail: Record<string, unknown> = {};
		if (methodSchema.tags) detail.tags = methodSchema.tags;
		if (methodSchema.summary) detail.summary = methodSchema.summary;
		if (methodSchema.description) detail.description = methodSchema.description;
		if (methodSchema.deprecated) detail.deprecated = methodSchema.deprecated;

		if (Object.keys(detail).length > 0) {
			options.detail = detail;
		}

		if (!options.params && routeInfo.params.length > 0) {
			options.params = generateParamsSchema(routeInfo.params);
		}

		return options;
	}

	// Check separate schema.ts file
	if (schemaModule) {
		const getSchemaFromFile = (key: string) => {
			if (schemaModule[`${method}_${key}`]) {
				return schemaModule[`${method}_${key}`];
			}
			if (schemaModule[key]) {
				return schemaModule[key];
			}
			return undefined;
		};

		const bodySchema = getSchemaFromFile('body');
		if (bodySchema) options.body = bodySchema;

		const querySchema = getSchemaFromFile('query');
		if (querySchema) options.query = querySchema;

		const paramsSchema = getSchemaFromFile('params');
		if (paramsSchema) options.params = paramsSchema;

		const responseSchema = getSchemaFromFile('response');
		if (responseSchema) options.response = responseSchema;

		const headersSchema = getSchemaFromFile('headers');
		if (headersSchema) options.headers = headersSchema;

		const detail = schemaModule[`${method}_detail`] || schemaModule.detail;
		if (detail) options.detail = detail;
	}

	// Auto-generate params schema
	if (!options.params && routeInfo.params.length > 0) {
		options.params = generateParamsSchema(routeInfo.params);
	}

	return options;
}

/**
 * Helper to create a standalone Elysia app with app router.
 *
 * @example
 * ```ts
 * import { createApp } from '@foxen/adapter';
 *
 * const app = await createApp({ apiDir: './src/app/api' });
 * app.listen(3000);
 * ```
 */
export async function createApp(config: Partial<AppRouterConfig> = {}) {
	const app = new Elysia();
	const routerPlugin = await appRouter(config);
	return app.use(routerPlugin);
}
