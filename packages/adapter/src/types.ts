import type { HttpMethod, NextRouteHandler } from '@foxen/core';

// ============================================
// Route Information
// ============================================

/** Information about a dynamic segment */
export interface ParamInfo {
	/** Name of the parameter */
	name: string;
	/** Whether this is a catch-all param */
	isCatchAll: boolean;
	/** Whether this is optional */
	isOptional: boolean;
}

/** Route information extracted from a route.ts file */
export interface RouteInfo {
	/** Original file path */
	filePath: string;
	/** Next.js style path (e.g., /api/users/[id]) */
	nextPath: string;
	/** Elysia style path (e.g., /api/users/:id) */
	elysiaPath: string;
	/** HTTP methods exported from the route file */
	methods: HttpMethod[];
	/** Dynamic segments in the path */
	params: ParamInfo[];
	/** Whether this is a catch-all route */
	isCatchAll: boolean;
	/** Whether this is an optional catch-all route */
	isOptionalCatchAll: boolean;
	/** Path to schema.ts file if exists */
	schemaPath?: string;
}

// ============================================
// Plugin Configuration
// ============================================

/** Feature flags for optional functionality */
export interface FeatureFlags {
	/** Enable redirects from next.config */
	redirects?: boolean;
	/** Enable rewrites from next.config */
	rewrites?: boolean;
	/** Enable custom headers from next.config */
	headers?: boolean;
	/** Enable middleware.ts support */
	middleware?: boolean;
}

/** Configuration options for the app router plugin */
export interface AppRouterConfig {
	/**
	 * Path to the API directory to scan
	 * @default './src/app/api'
	 */
	apiDir: string;

	/**
	 * Base path prefix for all routes
	 * @default ''
	 */
	basePath?: string;

	/**
	 * Whether to strip '/api' prefix from routes
	 * @default false
	 */
	stripApiPrefix?: boolean;

	/**
	 * Custom handler adapter function
	 */
	adapter?: HandlerAdapter;

	/**
	 * Enable verbose logging
	 * @default false
	 */
	verbose?: boolean;

	/**
	 * Path to middleware.ts file
	 * Set to false to disable middleware loading
	 */
	middlewarePath?: string | false;

	/**
	 * Path to next.config.js/ts file
	 * Set to false to disable config loading
	 */
	nextConfigPath?: string | false;

	/**
	 * Project root directory
	 * @default process.cwd()
	 */
	projectRoot?: string;

	/**
	 * Feature flags to enable/disable specific functionality
	 */
	features?: FeatureFlags;

	/**
	 * Continue processing on middleware errors
	 * @default false
	 */
	continueOnMiddlewareError?: boolean;
}

// ============================================
// Runtime Context
// ============================================

/** Internal context passed through Elysia lifecycle hooks */
export interface RuntimeContext {
	/** Headers to add to response */
	_nextHeaders?: Array<{ key: string; value: string }>;
	/** URL to rewrite to */
	_rewriteTo?: string;
	/** Modified request from middleware */
	_modifiedRequest?: Request;
	/** Whether middleware has already run */
	_middlewareRan?: boolean;
	/** Base path for URL resolution */
	_basePath?: string;
	/** Geo data extracted from headers */
	_geo?: GeoData;
	/** Client IP */
	_ip?: string;
}

/** Geo data extracted from request headers */
export interface GeoData {
	city?: string;
	country?: string;
	region?: string;
	latitude?: string;
	longitude?: string;
}

// ============================================
// Handler Types
// ============================================

/** Elysia context (simplified) */
export interface ElysiaContext {
	request: Request;
	params: Record<string, string | string[]>;
	query: Record<string, string>;
	body: unknown;
	headers: Record<string, string | undefined>;
	set: {
		headers: Record<string, string>;
		status?: number;
	};
	path: string;
	store: Record<string, unknown>;
}

/** Elysia style route handler */
export type ElysiaHandler = (context: ElysiaContext) => Response | Promise<Response> | unknown;

/**
 * Adapter function type for transforming handlers
 */
export type HandlerAdapter = (
	handler: NextRouteHandler,
	routeInfo: RouteInfo,
	method: HttpMethod,
) => ElysiaHandler;

// ============================================
// Generated Route Types
// ============================================

/** Generated route for code generation output */
export interface GeneratedRoute {
	/** Import path relative to output file */
	importPath: string;
	/** Variable name for the import */
	importName: string;
	/** Elysia path */
	path: string;
	/** HTTP method */
	method: Lowercase<HttpMethod>;
	/** Handler function name in the module */
	handlerName: HttpMethod;
	/** Whether route has manual schema */
	hasSchema?: boolean;
	/** Path params extracted from route */
	pathParams: string[];
}

// ============================================
// Lifecycle Handler Types
// ============================================

/** Options for creating lifecycle handlers */
export interface LifecycleOptions {
	/** Loaded middleware handler and matchers */
	middleware?: import('@foxen/middleware').LoadedMiddleware | null;
	/** Resolved next.config */
	nextConfig?: import('@foxen/config').ResolvedNextConfig | null;
	/** Plugin configuration */
	config: AppRouterConfig;
}

/** Result of processing redirects/rewrites in lifecycle */
export interface LifecycleResult {
	/** Should continue processing */
	continue: boolean;
	/** Response to return (for redirects/errors) */
	response?: Response;
	/** URL to rewrite to */
	rewriteTo?: string;
	/** Modified request */
	request?: Request;
	/** Headers to add to response */
	headers?: Array<{ key: string; value: string }>;
}
