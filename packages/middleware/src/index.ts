// =============================================================================
// Type Exports
// =============================================================================

export type {
	// Handler types
	MiddlewareHandler,
	NextFetchEvent as NextFetchEventInterface,
	// Configuration types
	MiddlewareConfig,
	MiddlewareMatcher,
	// Module types
	MiddlewareModule,
	MiddlewareType,
	// Loaded middleware types
	NormalizedMatcher,
	LoadedMiddleware,
	// Execution types
	MiddlewareResult,
	// Options types
	MiddlewareLoaderOptions,
	MiddlewareExecutorOptions,
} from './types.js';

// =============================================================================
// Loader Exports
// =============================================================================

export {
	loadMiddleware,
	normalizeMatchers,
	middlewareFileExists,
} from './loader.js';

// =============================================================================
// Matcher Exports
// =============================================================================

export {
	pathToRegex,
	shouldRunMiddleware,
	compileMatchers,
	testPathMatch,
} from './matcher.js';

// =============================================================================
// Event Exports
// =============================================================================

export { NextFetchEvent, createNextFetchEvent } from './event.js';

// =============================================================================
// Executor Exports
// =============================================================================

export {
	executeMiddleware,
	parseMiddlewareResponse,
	applyMiddlewareHeaders,
	createRewrittenRequest,
} from './executor.js';
