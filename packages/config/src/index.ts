// Type exports
export * from './types.js';

// Matcher exports
export {
	matchPath,
	matchConditions,
	applyParams,
	parsePath,
	type PathMatchResult,
	type PathMatchOptions,
	type ConditionMatchResult,
} from './matcher.js';

// Config loader exports
export {
	loadFoxenConfig,
	defineConfig,
	findConfigFile,
	validateConfig,
	DEFAULT_CONFIG,
} from './loader.js';

// Next.js config loader exports
export {
	loadNextConfig,
	loadNextConfigWithDefaults,
	resolveNextConfig,
	findNextConfigFile,
} from './next-config.js';

// Redirect processor exports
export {
	processRedirect,
	processRedirects,
	createRedirectResponse,
	isExternalUrl,
	type RedirectProcessOptions,
	type RedirectResult,
} from './redirects.js';

// Rewrite processor exports
export {
	processRewrite,
	processRewriteArray,
	processRewrites,
	createRewrittenRequest,
	type RewriteProcessOptions,
	type RewriteResult,
	type FullRewriteResult,
} from './rewrites.js';

// Header processor exports
export {
	processHeaders,
	applyHeadersToResponse,
	createHeadersObject,
	mergeHeaderResults,
	SECURITY_HEADERS,
	createCorsHeaders,
	type HeaderProcessOptions,
	type HeadersResult,
} from './headers.js';
