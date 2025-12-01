import type { RouteCondition } from '@foxen/config';
import type { NextRequest, NextResponse } from '@foxen/core';

// =============================================================================
// Handler Types
// =============================================================================

/**
 * Middleware function signature (Next.js compatible)
 * Can return Response, NextResponse, void, or Promise of any of these
 */
export type MiddlewareHandler = (
	request: NextRequest,
	event?: NextFetchEvent,
) => NextResponse | Response | Promise<NextResponse | Response> | void | Promise<void>;

/**
 * NextFetchEvent interface for middleware
 * Provides waitUntil for background tasks
 */
export interface NextFetchEvent {
	/** Wait for a promise to complete (for background tasks) */
	waitUntil(promise: Promise<unknown>): void;
	/** Source page (empty in Foxen context) */
	readonly sourcePage: string;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Middleware configuration exported from middleware.ts
 */
export interface MiddlewareConfig {
	/** Path matcher patterns */
	matcher?: string | string[] | MiddlewareMatcher[];
	/** Runtime environment (not used in Foxen, for compatibility) */
	runtime?: 'edge' | 'nodejs';
}

/**
 * Advanced matcher configuration with conditions
 */
export interface MiddlewareMatcher {
	/** The path pattern to match */
	source: string;
	/** Conditions that must be present */
	has?: RouteCondition[];
	/** Conditions that must be absent */
	missing?: RouteCondition[];
	/** Whether to include locale prefix (default: true) */
	locale?: false;
	/** Custom regex pattern */
	regexp?: string;
}

// =============================================================================
// Module Types
// =============================================================================

/**
 * Middleware module structure (loaded from file)
 */
export interface MiddlewareModule {
	/** Named middleware export */
	middleware?: MiddlewareHandler;
	/** Named proxy export (Next.js 16+) */
	proxy?: MiddlewareHandler;
	/** Default export (alternative) */
	default?: MiddlewareHandler;
	/** Middleware configuration */
	config?: MiddlewareConfig;
}

/**
 * Type of middleware file
 */
export type MiddlewareType = 'middleware' | 'proxy';

// =============================================================================
// Loaded Middleware Types
// =============================================================================

/**
 * Normalized matcher for internal use
 */
export interface NormalizedMatcher {
	/** Original source pattern */
	source: string;
	/** Compiled regex */
	regex: RegExp;
	/** Has conditions */
	has?: RouteCondition[];
	/** Missing conditions */
	missing?: RouteCondition[];
	/** Locale configuration */
	locale?: false;
}

/**
 * Loaded middleware with resolved config
 */
export interface LoadedMiddleware {
	/** Type of middleware (middleware.ts or proxy.ts) */
	type: MiddlewareType;
	/** Absolute file path */
	filePath: string;
	/** The middleware handler function */
	handler: MiddlewareHandler;
	/** Compiled matchers */
	matchers: NormalizedMatcher[];
}

// =============================================================================
// Execution Types
// =============================================================================

/**
 * Result of middleware execution
 */
export interface MiddlewareResult {
	/** Whether to continue to route handler */
	continue: boolean;
	/** Response if middleware returned one (redirect, error, etc.) */
	response?: Response;
	/** Internal rewrite destination */
	rewriteTo?: string;
	/** Modified request (with updated headers) */
	request?: Request;
	/** Headers to add to the final response */
	responseHeaders?: Headers;
}

// =============================================================================
// Options Types
// =============================================================================

/**
 * Options for middleware loading
 */
export interface MiddlewareLoaderOptions {
	/** Project root directory */
	projectRoot?: string;
	/** Specific middleware file path (overrides auto-detection) */
	middlewarePath?: string;
	/** Whether to also look for proxy.ts (default: true) */
	includeProxy?: boolean;
	/** Verbose logging */
	verbose?: boolean;
}

/**
 * Options for middleware execution
 */
export interface MiddlewareExecutorOptions {
	/** Base path for URL resolution */
	basePath?: string;
	/** i18n configuration */
	i18n?: {
		locales: string[];
		defaultLocale: string;
	};
	/** Whether to continue on error (default: false) */
	continueOnError?: boolean;
	/** Verbose logging */
	verbose?: boolean;
}
