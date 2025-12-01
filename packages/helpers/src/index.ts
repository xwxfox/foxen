// User agent parsing
export {
	userAgent,
	parseUserAgent,
	isMobile,
	isTablet,
	isDesktop,
	isBot,
	type UserAgent,
} from './user-agent.js';

// Middleware matchers
export {
	compileMatcher,
	compileMatchers,
	createExcludeMatcher,
	createMiddlewareMatcher,
	defaultExcludePatterns,
	type MatcherPattern,
	type MatcherConfig,
	type CompiledMatcher,
} from './matchers.js';

// Header utilities
export {
	getIP,
	getIPInfo,
	isValidIP,
	getGeo,
	getProtocol,
	getHost,
	getFullURL,
	getContentType,
	acceptsJSON,
	isAjax,
	isPrefetch,
	getBearerToken,
	getBasicAuth,
	type IPInfo,
	type GeoInfo,
} from './headers.js';
