// Plugin
export { appRouter, createApp } from './plugin.js';

// Adapters
export { defaultAdapter, simpleAdapter, createMiddlewareAdapter } from './adapter.js';

// Scanner
export {
	scanDirectory,
	scanDirectoryStructure,
	convertPathToElysia,
	extractExportedMethods,
	getRouteMethods,
	extractHandlerSignatures,
} from './scanner.js';
export type { HandlerSignature } from './scanner.js';

// Context utilities
export {
	createNextRequest,
	createParamsPromise,
	normalizeParams,
	extractIPFromHeaders,
	extractGeoFromHeaders,
	getFoxenContext,
	setFoxenContext,
	updateFoxenContext,
	type CreateNextRequestOptions,
} from './context.js';

// Lifecycle handlers
export {
	createOnRequestHandler,
	createOnBeforeHandleHandler,
	createOnAfterHandleHandler,
	createOnErrorHandler,
	registerLifecycleHooks,
} from './lifecycle.js';

// Types
export type {
	AppRouterConfig,
	RouteInfo,
	ParamInfo,
	ElysiaContext,
	ElysiaHandler,
	HandlerAdapter,
	GeneratedRoute,
	FeatureFlags,
	RuntimeContext,
	GeoData,
	LifecycleOptions,
	LifecycleResult,
} from './types.js';

// Re-export core types for convenience
export type {
	HttpMethod,
	NextRouteHandler,
	RouteModule,
} from '@foxen/core';

// Re-export NextRequest and NextResponse for convenience
export { NextRequest, NextResponse } from '@foxen/core';

// Re-export Elysia's t for convenience
export { t } from 'elysia';
