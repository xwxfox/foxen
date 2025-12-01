import { type ErrorPhase, FoxenError } from '@foxen/core';
import type { ValidationError } from './types.js';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Error codes specific to environment handling.
 */
export type EnvErrorCode =
	// Parsing errors
	| 'ENV_PARSE_ERROR'
	| 'ENV_SYNTAX_ERROR'
	| 'ENV_ENCODING_ERROR'
	// Loading errors
	| 'ENV_FILE_NOT_FOUND'
	| 'ENV_FILE_READ_ERROR'
	| 'ENV_NO_FILES_FOUND'
	// Validation errors
	| 'ENV_VALIDATION_FAILED'
	| 'ENV_MISSING_VARIABLE'
	| 'ENV_INVALID_TYPE'
	| 'ENV_INVALID_VALUE'
	// Runtime errors
	| 'ENV_NOT_LOADED'
	| 'ENV_ALREADY_LOADED'
	| 'ENV_ACCESS_ERROR'
	// Generation errors
	| 'ENV_GENERATE_FAILED'
	| 'ENV_OUTPUT_ERROR';

/**
 * Error suggestions for env-specific codes.
 */
export const envErrorSuggestions: Record<EnvErrorCode, string> = {
	// Parsing
	ENV_PARSE_ERROR: 'Check your .env file syntax. Ensure each line follows KEY=value format.',
	ENV_SYNTAX_ERROR:
		'The .env file contains invalid syntax. Check for unclosed quotes or invalid characters.',
	ENV_ENCODING_ERROR: 'The .env file contains invalid encoding. Ensure the file is UTF-8 encoded.',

	// Loading
	ENV_FILE_NOT_FOUND:
		'The specified .env file does not exist. Check the file path and ensure the file exists.',
	ENV_FILE_READ_ERROR: 'Could not read the .env file. Check file permissions.',
	ENV_NO_FILES_FOUND:
		'No .env files found in the specified directory. Create a .env file or check your configuration.',

	// Validation
	ENV_VALIDATION_FAILED:
		'Environment validation failed. Check that all required variables are set with correct types.',
	ENV_MISSING_VARIABLE:
		'A required environment variable is missing. Add it to your .env file or set it in your environment.',
	ENV_INVALID_TYPE:
		'An environment variable has an invalid type. Check the expected type in your schema.',
	ENV_INVALID_VALUE: 'An environment variable has an invalid value. Check the value format.',

	// Runtime
	ENV_NOT_LOADED:
		'Environment has not been loaded. Call bootstrapEnv() before accessing env variables.',
	ENV_ALREADY_LOADED:
		'Environment has already been loaded. Reset with resetEnv() if you need to reload.',
	ENV_ACCESS_ERROR:
		'Failed to access environment variable. Ensure bootstrapEnv() was called successfully.',

	// Generation
	ENV_GENERATE_FAILED:
		'Failed to generate environment files. Check the console for detailed errors.',
	ENV_OUTPUT_ERROR: 'Could not write generated files. Check that the output directory is writable.',
};

// ============================================================================
// Base Environment Error
// ============================================================================

/**
 * Base error class for all environment-related errors.
 *
 * @example
 * ```ts
 * throw new EnvError(
 *   'Failed to parse .env file',
 *   'ENV_PARSE_ERROR',
 *   { filePath: '.env', line: 5 }
 * );
 * ```
 */
export class EnvError extends FoxenError<EnvErrorCode> {
	constructor(message: string, code: EnvErrorCode, details?: Record<string, unknown>) {
		// Map env errors to appropriate phases
		const phase = getPhaseForCode(code);
		super(message, code, phase, details, envErrorSuggestions[code]);
		this.name = 'EnvError';
	}
}

/**
 * Get the appropriate error phase for an env error code.
 */
function getPhaseForCode(code: EnvErrorCode): ErrorPhase {
	if (
		code.startsWith('ENV_PARSE') ||
		code.startsWith('ENV_SYNTAX') ||
		code.startsWith('ENV_ENCODING')
	) {
		return 'compile';
	}
	if (code.startsWith('ENV_FILE') || code.startsWith('ENV_NO_FILES')) {
		return 'scan';
	}
	if (
		code.startsWith('ENV_VALIDATION') ||
		code.startsWith('ENV_MISSING') ||
		code.startsWith('ENV_INVALID')
	) {
		return 'config';
	}
	if (code.startsWith('ENV_GENERATE') || code.startsWith('ENV_OUTPUT')) {
		return 'generate';
	}
	return 'runtime';
}

// ============================================================================
// Specific Error Classes
// ============================================================================

/**
 * Error thrown when parsing .env files fails.
 */
export class EnvParseError extends EnvError {
	constructor(
		message: string,
		details?: {
			filePath?: string;
			line?: number;
			column?: number;
			content?: string;
		},
	) {
		super(message, 'ENV_PARSE_ERROR', details);
		this.name = 'EnvParseError';
	}
}

/**
 * Error thrown when a required .env file is not found.
 */
export class EnvFileNotFoundError extends EnvError {
	constructor(filePath: string) {
		super(`Environment file not found: ${filePath}`, 'ENV_FILE_NOT_FOUND', { filePath });
		this.name = 'EnvFileNotFoundError';
	}
}

/**
 * Error thrown when environment validation fails.
 */
export class EnvValidationError extends EnvError {
	/** Individual validation errors */
	public readonly validationErrors: readonly ValidationError[];

	constructor(errors: readonly ValidationError[], details?: Record<string, unknown>) {
		const message = formatValidationErrors(errors);
		super(message, 'ENV_VALIDATION_FAILED', {
			...details,
			errorCount: errors.length,
		});
		this.name = 'EnvValidationError';
		this.validationErrors = errors;
	}
}

/**
 * Error thrown when accessing env before loading.
 */
export class EnvNotLoadedError extends EnvError {
	constructor() {
		super('Environment has not been loaded. Call bootstrapEnv() first.', 'ENV_NOT_LOADED');
		this.name = 'EnvNotLoadedError';
	}
}

/**
 * Error thrown when code generation fails.
 */
export class EnvGenerateError extends EnvError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 'ENV_GENERATE_FAILED', details);
		this.name = 'EnvGenerateError';
	}
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format validation errors into a readable message.
 */
function formatValidationErrors(errors: readonly ValidationError[]): string {
	if (errors.length === 0) {
		return 'Environment validation failed';
	}

	const firstError = errors[0];
	if (errors.length === 1 && firstError) {
		return `Environment validation failed: ${firstError.variable} - ${firstError.message}`;
	}

	const lines = [`Environment validation failed with ${errors.length} errors:`];
	for (const err of errors) {
		lines.push(`  - ${err.variable}: ${err.message}`);
	}
	return lines.join('\n');
}

/**
 * Check if an error is an EnvError.
 */
export function isEnvError(error: unknown): error is EnvError {
	return error instanceof EnvError;
}

/**
 * Wrap an unknown error as an EnvError.
 */
export function wrapEnvError(error: unknown, code: EnvErrorCode = 'ENV_PARSE_ERROR'): EnvError {
	if (isEnvError(error)) {
		return error;
	}

	const message = error instanceof Error ? error.message : String(error);
	return new EnvError(message, code, {
		originalError: error instanceof Error ? error.name : typeof error,
	});
}
