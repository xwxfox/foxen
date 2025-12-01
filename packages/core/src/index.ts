// Main classes
export { NextRequest, createNextRequest, isNextRequest } from './request.ts';
export {
	NextResponse,
	isNextResponse,
	isRewriteResponse,
	isNextContinue,
	isRedirectResponse,
	getRewriteUrl,
	getRedirectUrl,
} from './response.ts';
export { NextURL } from './url.ts';
export {
	RequestCookies,
	ResponseCookies,
	stringifyCookie,
	parseCookie,
	parseSetCookie,
	splitCookiesString,
} from './cookies.ts';

// Errors
export {
	// Base error
	FoxenError,
	// Specific errors
	ConfigError,
	RouteError,
	MiddlewareError,
	SchemaError,
	CompileError,
	RuntimeError,
	ScanError,
	GenerateError,
	// Legacy Next.js errors
	RemovedPageError,
	RemovedUAError,
	InvalidURLError,
	// Utilities
	isFoxenError,
	wrapError,
	getSuggestion,
	formatError,
	// Suggestions map
	errorSuggestions,
} from './errors.ts';

// Error types
export type { ErrorPhase, ErrorCode } from './errors.ts';

// Types
export type {
	// Geo
	Geo,
	// i18n
	I18NConfig,
	DomainLocale,
	// Cookies
	CookieListItem,
	RequestCookie,
	ResponseCookie,
	// Request/Response
	NextConfig,
	NextRequestInit,
	NextResponseInit,
	ModifiedRequest,
	MiddlewareResponseInit,
	// Middleware
	MiddlewareMatcher,
	MiddlewareConfig,
	RouteCondition,
	// Routes
	HttpMethod,
	NextRouteHandler,
	RouteModule,
} from './types.ts';

export {
	HTTP_METHODS,
	NEXT_REQUEST_INTERNAL,
	NEXT_RESPONSE_INTERNAL,
	NEXT_URL_INTERNAL,
} from './types.ts';
