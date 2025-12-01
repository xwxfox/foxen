// ============================================================================
// Error Phases
// ============================================================================

/**
 * Phase in which an error occurred
 */
export type ErrorPhase =
	| 'config'
	| 'middleware'
	| 'route'
	| 'compile'
	| 'runtime'
	| 'init'
	| 'scan'
	| 'generate';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * All possible error codes
 */
export type ErrorCode =
	// Config errors
	| 'CONFIG_NOT_FOUND'
	| 'CONFIG_PARSE_ERROR'
	| 'CONFIG_INVALID'
	| 'CONFIG_VALIDATION_FAILED'
	// Route errors
	| 'ROUTE_NOT_FOUND'
	| 'ROUTE_INVALID'
	| 'ROUTE_NO_HANDLERS'
	| 'ROUTE_DUPLICATE'
	| 'ROUTE_LOAD_FAILED'
	// Middleware errors
	| 'MIDDLEWARE_NOT_FOUND'
	| 'MIDDLEWARE_INVALID'
	| 'MIDDLEWARE_FAILED'
	| 'MIDDLEWARE_MATCHER_INVALID'
	// Schema errors
	| 'SCHEMA_INVALID'
	| 'SCHEMA_VALIDATION_FAILED'
	| 'SCHEMA_PARSE_ERROR'
	// Compilation errors
	| 'COMPILE_FAILED'
	| 'COMPILE_FILE_ERROR'
	| 'COMPILE_PARSE_ERROR'
	| 'COMPILE_TRANSFORM_ERROR'
	// Runtime errors
	| 'RUNTIME_ERROR'
	| 'RUNTIME_HANDLER_ERROR'
	| 'RUNTIME_RESPONSE_ERROR'
	// Scanner errors
	| 'SCAN_FAILED'
	| 'SCAN_DIRECTORY_NOT_FOUND'
	| 'SCAN_FILE_ERROR'
	// Generator errors
	| 'GENERATE_FAILED'
	| 'GENERATE_OUTPUT_ERROR'
	| 'GENERATE_TEMPLATE_ERROR'
	// Legacy Next.js errors
	| 'REMOVED_PAGE'
	| 'REMOVED_UA'
	| 'INVALID_URL';

// ============================================================================
// Error Suggestions
// ============================================================================

/**
 * Helpful suggestions for each error code
 */
export const errorSuggestions: Partial<Record<ErrorCode, string>> = {
	// Config
	CONFIG_NOT_FOUND: "Create a foxen.config.ts file in your project root, or run 'foxen init'",
	CONFIG_PARSE_ERROR:
		'Ensure your config file exports a valid configuration object using defineConfig()',
	CONFIG_INVALID: 'Check that all required fields are provided and have valid values',
	CONFIG_VALIDATION_FAILED: 'Review the validation errors and fix each issue in your config',

	// Routes
	ROUTE_NOT_FOUND:
		'Check that the route file exists and exports HTTP method handlers (GET, POST, etc.)',
	ROUTE_INVALID: "Route files must be named 'route.ts' or 'route.js' and export handler functions",
	ROUTE_NO_HANDLERS: 'Add at least one HTTP method handler: export async function GET() { ... }',
	ROUTE_DUPLICATE: 'Each route path can only be defined once. Check for duplicate route files',
	ROUTE_LOAD_FAILED: 'Verify the route file has valid TypeScript/JavaScript syntax',

	// Middleware
	MIDDLEWARE_NOT_FOUND:
		'Create a middleware.ts file in your project root with an exported middleware function',
	MIDDLEWARE_INVALID:
		"Middleware must export a 'middleware' function and optionally a 'config' object",
	MIDDLEWARE_FAILED: 'Check middleware.ts for errors. Try running with --verbose for more details',
	MIDDLEWARE_MATCHER_INVALID:
		"Middleware matchers must be valid path patterns (e.g., '/api/:path*')",

	// Schema
	SCHEMA_INVALID:
		"Verify your schema uses valid TypeBox types from 'elysia' or '@sinclair/typebox'",
	SCHEMA_VALIDATION_FAILED:
		'The request/response does not match the defined schema. Check your data types',
	SCHEMA_PARSE_ERROR: 'Schema definition has syntax errors. Review the TypeBox type definitions',

	// Compilation
	COMPILE_FAILED: "Check for TypeScript errors in your route files. Run 'tsc --noEmit' for details",
	COMPILE_FILE_ERROR: 'Ensure the file exists and is readable',
	COMPILE_PARSE_ERROR: 'The file contains syntax errors. Fix them before compiling',
	COMPILE_TRANSFORM_ERROR:
		'An error occurred during code transformation. Try simplifying the route',

	// Runtime
	RUNTIME_ERROR: 'An unexpected error occurred. Check the server logs for details',
	RUNTIME_HANDLER_ERROR:
		'The route handler threw an error. Add try/catch to handle errors gracefully',
	RUNTIME_RESPONSE_ERROR:
		'Failed to create response. Ensure you return NextResponse or a valid response object',

	// Scanner
	SCAN_FAILED: 'Failed to scan routes directory. Check file permissions',
	SCAN_DIRECTORY_NOT_FOUND:
		'The routes directory does not exist. Check your config.routesDir setting',
	SCAN_FILE_ERROR: 'Could not read a file in the routes directory. Check file permissions',

	// Generator
	GENERATE_FAILED: 'Code generation failed. Check the analysis output for errors',
	GENERATE_OUTPUT_ERROR:
		'Could not write output files. Check that the output directory is writable',
	GENERATE_TEMPLATE_ERROR: 'Template rendering failed. This is likely a bug',

	// Legacy
	REMOVED_PAGE: '`page` has been deprecated. Use URLPattern for path matching instead',
	REMOVED_UA: "`ua` has been removed. Import userAgent from '@foxen/helpers' instead",
	INVALID_URL: 'Check that the URL is properly formatted with a valid protocol',
};

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all Foxen errors
 *
 * Provides:
 * - Error code for programmatic handling
 * - Phase for context on where the error occurred
 * - Details object for additional context
 * - Suggestion for how to fix the error
 * - JSON serialization for logging
 *
 * @example
 * ```ts
 * throw new FoxenError(
 *   'Route file not found',
 *   'ROUTE_NOT_FOUND',
 *   'scan',
 *   { filePath: '/app/api/users/route.ts' }
 * );
 * ```
 */
export class FoxenError<TCode extends string = ErrorCode> extends Error {
	/** Unique error code for programmatic handling */
	public readonly code: TCode;

	/** Phase in which the error occurred */
	public readonly phase: ErrorPhase;

	/** Additional details about the error */
	public readonly details?: Record<string, unknown>;

	/** Suggested fix for the error */
	public suggestion?: string;

	constructor(
		message: string,
		code: TCode,
		phase: ErrorPhase,
		details?: Record<string, unknown>,
		suggestion?: string,
	) {
		super(message);
		this.name = 'FoxenError';
		this.code = code;
		this.phase = phase;
		this.details = details;
		this.suggestion = suggestion ?? (errorSuggestions as Record<string, string | undefined>)[code];

		// Maintain proper stack trace for V8
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	/**
	 * Convert error to JSON for logging/serialization
	 */
	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			code: this.code,
			phase: this.phase,
			message: this.message,
			details: this.details,
			suggestion: this.suggestion,
			stack: this.stack,
		};
	}

	/**
	 * Format error for display in terminal
	 */
	format(): string {
		const lines = [`Error: ${this.message}`, `   Code: ${this.code}`, `   Phase: ${this.phase}`];

		if (this.details && Object.keys(this.details).length > 0) {
			lines.push('   Details:');
			for (const [key, value] of Object.entries(this.details)) {
				lines.push(`     ${key}: ${JSON.stringify(value)}`);
			}
		}

		if (this.suggestion) {
			lines.push('');
			lines.push(`Suggestion: ${this.suggestion}`);
		}

		return lines.join('\n');
	}
}

// ============================================================================
// Specific Error Classes
// ============================================================================

/**
 * Error thrown when a configuration file is not found or invalid
 */
export class ConfigError extends FoxenError {
	constructor(
		message: string,
		code:
			| 'CONFIG_NOT_FOUND'
			| 'CONFIG_PARSE_ERROR'
			| 'CONFIG_INVALID'
			| 'CONFIG_VALIDATION_FAILED' = 'CONFIG_INVALID',
		details?: Record<string, unknown>,
	) {
		super(message, code, 'config', details);
		this.name = 'ConfigError';
	}
}

/**
 * Error thrown when a route is not found or invalid
 */
export class RouteError extends FoxenError {
	constructor(
		message: string,
		code:
			| 'ROUTE_NOT_FOUND'
			| 'ROUTE_INVALID'
			| 'ROUTE_NO_HANDLERS'
			| 'ROUTE_DUPLICATE'
			| 'ROUTE_LOAD_FAILED' = 'ROUTE_INVALID',
		details?: Record<string, unknown>,
	) {
		super(message, code, 'route', details);
		this.name = 'RouteError';
	}
}

/**
 * Error thrown when middleware fails
 */
export class MiddlewareError extends FoxenError {
	constructor(
		message: string,
		code:
			| 'MIDDLEWARE_NOT_FOUND'
			| 'MIDDLEWARE_INVALID'
			| 'MIDDLEWARE_FAILED'
			| 'MIDDLEWARE_MATCHER_INVALID' = 'MIDDLEWARE_FAILED',
		details?: Record<string, unknown>,
	) {
		super(message, code, 'middleware', details);
		this.name = 'MiddlewareError';
	}
}

/**
 * Error thrown when schema validation fails
 */
export class SchemaError extends FoxenError {
	constructor(
		message: string,
		code: 'SCHEMA_INVALID' | 'SCHEMA_VALIDATION_FAILED' | 'SCHEMA_PARSE_ERROR' = 'SCHEMA_INVALID',
		details?: Record<string, unknown>,
	) {
		super(message, code, 'route', details);
		this.name = 'SchemaError';
	}
}

/**
 * Error thrown during compilation
 */
export class CompileError extends FoxenError {
	constructor(
		message: string,
		code:
			| 'COMPILE_FAILED'
			| 'COMPILE_FILE_ERROR'
			| 'COMPILE_PARSE_ERROR'
			| 'COMPILE_TRANSFORM_ERROR' = 'COMPILE_FAILED',
		details?: Record<string, unknown>,
	) {
		super(message, code, 'compile', details);
		this.name = 'CompileError';
	}
}

/**
 * Error thrown at runtime
 */
export class RuntimeError extends FoxenError {
	constructor(
		message: string,
		code: 'RUNTIME_ERROR' | 'RUNTIME_HANDLER_ERROR' | 'RUNTIME_RESPONSE_ERROR' = 'RUNTIME_ERROR',
		details?: Record<string, unknown>,
	) {
		super(message, code, 'runtime', details);
		this.name = 'RuntimeError';
	}
}

/**
 * Error thrown during route scanning
 */
export class ScanError extends FoxenError {
	constructor(
		message: string,
		code: 'SCAN_FAILED' | 'SCAN_DIRECTORY_NOT_FOUND' | 'SCAN_FILE_ERROR' = 'SCAN_FAILED',
		details?: Record<string, unknown>,
	) {
		super(message, code, 'scan', details);
		this.name = 'ScanError';
	}
}

/**
 * Error thrown during code generation
 */
export class GenerateError extends FoxenError {
	constructor(
		message: string,
		code:
			| 'GENERATE_FAILED'
			| 'GENERATE_OUTPUT_ERROR'
			| 'GENERATE_TEMPLATE_ERROR' = 'GENERATE_FAILED',
		details?: Record<string, unknown>,
	) {
		super(message, code, 'generate', details);
		this.name = 'GenerateError';
	}
}

// ============================================================================
// Legacy Next.js Compatibility Errors
// ============================================================================

/**
 * Error thrown when accessing the deprecated `page` property on NextRequest.
 */
export class RemovedPageError extends FoxenError {
	constructor() {
		super(
			'`page` has been deprecated in favour of `URLPattern`. ' +
				'Read more: https://nextjs.org/docs/messages/middleware-request-page',
			'REMOVED_PAGE',
			'runtime',
		);
		this.name = 'RemovedPageError';
	}
}

/**
 * Error thrown when accessing the deprecated `ua` property on NextRequest.
 */
export class RemovedUAError extends FoxenError {
	constructor() {
		super(
			'`ua` has been removed in favour of `userAgent` function. ' +
				'Read more: https://nextjs.org/docs/messages/middleware-parse-user-agent',
			'REMOVED_UA',
			'runtime',
		);
		this.name = 'RemovedUAError';
	}
}

/**
 * Error thrown for invalid URL.
 */
export class InvalidURLError extends FoxenError {
	constructor(url: string) {
		super(`Invalid URL: ${url}`, 'INVALID_URL', 'runtime', { url });
		this.name = 'InvalidURLError';
	}
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Check if an error is a FoxenError
 */
export function isFoxenError(error: unknown): error is FoxenError {
	return error instanceof FoxenError;
}

/**
 * Wrap an unknown error as a FoxenError
 */
export function wrapError(
	error: unknown,
	phase: ErrorPhase,
	code: ErrorCode = 'RUNTIME_ERROR',
): FoxenError {
	if (isFoxenError(error)) {
		return error;
	}

	const message = error instanceof Error ? error.message : String(error);
	const foxenError = new FoxenError(message, code, phase, {
		originalError: error instanceof Error ? error.name : typeof error,
	});

	// Preserve original stack if available
	if (error instanceof Error && error.stack) {
		foxenError.stack = error.stack;
	}

	return foxenError;
}

/**
 * Get suggestion for an error code
 */
export function getSuggestion(code: ErrorCode): string | undefined {
	return errorSuggestions[code];
}

/**
 * Format any error for CLI display
 */
export function formatError(error: unknown): string {
	if (isFoxenError(error)) {
		return error.format();
	}

	if (error instanceof Error) {
		return `Error: ${error.message}`;
	}

	return `Error: ${String(error)}`;
}
