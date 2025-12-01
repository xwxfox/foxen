// Core - NextRequest, NextResponse, cookies, headers
export {
	NextRequest,
	NextResponse,
	NextURL,
	RequestCookies,
	ResponseCookies,
	type HttpMethod,
	type NextRouteHandler,
	type RouteModule,
	type NextRequestInit,
} from '@foxen/core';

// Helpers - userAgent, matchers, geo
export {
	userAgent,
	type UserAgent,
} from '@foxen/helpers';

// Config - Configuration loading, redirects, rewrites, headers
export {
	// Config loading
	loadFoxenConfig,
	defineConfig as defineFoxenConfig,
	loadNextConfig,
	loadNextConfigWithDefaults,
	resolveNextConfig,
	DEFAULT_CONFIG,
	// Path matching
	matchPath,
	matchConditions,
	applyParams,
	parsePath,
	// Redirects
	processRedirects,
	processRedirect,
	createRedirectResponse,
	// Rewrites
	processRewrites,
	processRewrite,
	createRewrittenRequest,
	// Headers
	processHeaders,
	applyHeadersToResponse,
	SECURITY_HEADERS,
	createCorsHeaders,
	// Types
	type FoxenConfig,
	type ResolvedNextConfig,
	type NextRedirect,
	type NextRewrite,
	type NextRewritesConfig,
	type NextHeader,
	type RouteCondition,
	type PathMatchResult,
	type PathMatchOptions,
	type RedirectResult,
	type RewriteResult,
	type HeadersResult,
} from '@foxen/config';

// Adapter - Elysia plugin, route scanning
export {
	appRouter,
	createApp,
	defaultAdapter,
	simpleAdapter,
	scanDirectory,
	convertPathToElysia,
	type AppRouterConfig,
	type RouteInfo,
} from '@foxen/adapter';

// CLI - defineConfig for config files
export {
	defineConfig,
	loadConfig,
	findConfigFile,
	type Config,
} from '@foxen/cli';

// Middleware - middleware.ts/proxy.ts support
export {
	// Loading
	loadMiddleware,
	normalizeMatchers,
	middlewareFileExists,
	// Matching
	pathToRegex,
	shouldRunMiddleware,
	compileMatchers,
	testPathMatch,
	// Event
	NextFetchEvent,
	createNextFetchEvent,
	// Execution
	executeMiddleware,
	parseMiddlewareResponse,
	applyMiddlewareHeaders,
	createRewrittenRequest as createMiddlewareRewrittenRequest,
	// Types
	type MiddlewareHandler,
	type MiddlewareConfig,
	type MiddlewareMatcher,
	type MiddlewareModule,
	type MiddlewareType,
	type NormalizedMatcher,
	type LoadedMiddleware,
	type MiddlewareResult,
	type MiddlewareLoaderOptions,
	type MiddlewareExecutorOptions,
} from '@foxen/middleware';

// Env - Environment variable management
export {
	// Bootstrap & runtime
	bootstrapEnv,
	resetEnv,
	isEnvLoaded,
	getEnv,
	getAllEnv,
	getRawEnv,
	validateEnv,
	env,
	// Config helpers
	defineEnvConfig,
	setupEnv,
	// Loader
	loadEnvFiles,
	resolveConfig as resolveEnvConfig,
	getEnvFileHierarchy,
	getExistingEnvFiles,
	validateAgainstExample,
	getWatchPaths,
	// Parser
	parseEnvFile,
	parseEnvLine,
	stringifyEnvFile,
	// Inference
	inferType,
	inferTypes,
	toTypeScriptType,
	toTypeBoxMethod,
	decodeValue,
	encodeValue,
	decodeEnv,
	validateType,
	canDecode,
	// Generator
	generateEnvFiles,
	generateAndWriteEnvFiles,
	needsRegeneration,
	// Errors
	EnvError,
	EnvParseError,
	EnvFileNotFoundError,
	EnvValidationError,
	EnvNotLoadedError,
	EnvGenerateError,
	// Types
	type EnvMode,
	type InferredType,
	type EnvVariable,
	type EnvVariableMap,
	type EnvConfig,
	type ResolvedEnvConfig,
	type GeneratedFile,
	type GenerationResult,
	type BootstrapOptions,
	type ValidationResult,
	type EnvErrorCode,
} from '@foxen/env';

// Re-export Elysia's t for convenience
export { t } from 'elysia';
