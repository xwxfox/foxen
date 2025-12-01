import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TObject, type TProperties, Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { EnvError, EnvNotLoadedError, EnvValidationError } from './errors.js';
import { decodeValue, inferType } from './inference.js';
import { getEnvFileHierarchy } from './loader.js';
import { parseEnvFile } from './parser.js';
import type {
	BootstrapOptions,
	EnvMode,
	InferredType,
	ParsedEnv,
	ValidationError,
	ValidationResult,
} from './types.js';

// ============================================================================
// Internal State
// ============================================================================

interface EnvState {
	/** Whether env has been bootstrapped */
	loaded: boolean;
	/** Raw string values from .env files */
	raw: ParsedEnv;
	/** Decoded values with proper types */
	decoded: Record<string, unknown>;
	/** Inferred types for each variable */
	types: Map<string, InferredType>;
	/** Files that were loaded */
	files: string[];
	/** Bootstrap options used */
	options: BootstrapOptions | null;
}

/**
 * Global state for the environment.
 * Using a module-level state allows for singleton behavior.
 */
const state: EnvState = {
	loaded: false,
	raw: {},
	decoded: {},
	types: new Map(),
	files: [],
	options: null,
};

// ============================================================================
// Bootstrap
// ============================================================================

/**
 * Bootstrap the environment by loading .env files and injecting into process.env.
 *
 * This should be called once at application startup, before accessing env vars.
 * If a schema is provided (from generated files), values will be validated.
 *
 * @param options - Bootstrap options
 * @param schema - Optional TypeBox schema for validation
 *
 * @example
 * ```ts
 * // Simple bootstrap
 * bootstrapEnv();
 *
 * // With custom options
 * bootstrapEnv({ mode: 'production', strict: true });
 *
 * // With schema validation (from generated files)
 * import { EnvSchema } from './.foxen/env.schema';
 * bootstrapEnv({}, EnvSchema);
 * ```
 */
export function bootstrapEnv(options: BootstrapOptions = {}, schema?: TObject<TProperties>): void {
	if (state.loaded) {
		// Already loaded, skip
		return;
	}

	const rootDir = options.rootDir ?? process.cwd();
	const mode = options.mode ?? (process.env.NODE_ENV as EnvMode) ?? 'development';
	const validate = options.validate ?? true;
	const strict = options.strict ?? mode === 'production';
	const injectToProcessEnv = options.injectToProcessEnv ?? true;

	// Load env files
	const hierarchy = getEnvFileHierarchy(mode);
	const loadedFiles: string[] = [];
	const raw: ParsedEnv = {};

	for (const file of hierarchy) {
		const filePath = join(rootDir, file);
		if (existsSync(filePath)) {
			const content = readFileSync(filePath, 'utf-8');
			const parsed = parseEnvFile(content, filePath);
			Object.assign(raw, parsed);
			loadedFiles.push(filePath);
		}
	}

	// Infer types for all variables
	const types = new Map<string, InferredType>();
	for (const [key, value] of Object.entries(raw)) {
		types.set(key, inferType(value));
	}

	// Decode values
	let decoded: Record<string, unknown>;

	if (schema && validate) {
		// Use schema for validation and decoding
		try {
			decoded = Value.Decode(schema, raw) as Record<string, unknown>;
		} catch (error) {
			const validationErrors = extractValidationErrors(error, raw);

			if (strict) {
				throw new EnvValidationError(validationErrors);
			}

			// Non-strict: log warning and decode without validation
			console.warn('[foxen/env] Validation warnings:', validationErrors);
			decoded = decodeWithoutSchema(raw, types);
		}
	} else {
		// No schema, decode based on inferred types
		decoded = decodeWithoutSchema(raw, types);
	}

	// Inject into process.env
	if (injectToProcessEnv) {
		for (const [key, value] of Object.entries(raw)) {
			if (process.env[key] === undefined) {
				process.env[key] = value;
			}
		}
	}

	// Update state
	state.loaded = true;
	state.raw = raw;
	state.decoded = decoded;
	state.types = types;
	state.files = loadedFiles;
	state.options = options;
}

/**
 * Decode values without a schema, using inferred types.
 */
function decodeWithoutSchema(
	raw: ParsedEnv,
	types: Map<string, InferredType>,
): Record<string, unknown> {
	const decoded: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(raw)) {
		const type = types.get(key) ?? 'string';
		decoded[key] = decodeValue(value, type);
	}

	return decoded;
}

/**
 * Extract validation errors from a TypeBox validation error.
 */
function extractValidationErrors(error: unknown, _raw: ParsedEnv): ValidationError[] {
	const errors: ValidationError[] = [];

	if (error && typeof error === 'object' && 'message' in error) {
		// Simple error format
		errors.push({
			variable: 'unknown',
			message: String((error as Error).message),
		});
	}

	// If no specific errors found, create a generic one
	if (errors.length === 0) {
		errors.push({
			variable: 'unknown',
			message: 'Environment validation failed',
		});
	}

	return errors;
}

// ============================================================================
// Reset (for testing)
// ============================================================================

/**
 * Reset the environment state.
 *
 * Useful for testing or reloading configuration.
 * Does NOT remove variables from process.env.
 */
export function resetEnv(): void {
	state.loaded = false;
	state.raw = {};
	state.decoded = {};
	state.types = new Map();
	state.files = [];
	state.options = null;
}

/**
 * Check if the environment has been bootstrapped.
 */
export function isEnvLoaded(): boolean {
	return state.loaded;
}

/**
 * Get the list of loaded .env files.
 */
export function getLoadedFiles(): readonly string[] {
	return state.files;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate the current environment against a schema.
 *
 * @param schema - TypeBox schema to validate against
 * @returns Validation result
 */
export function validateEnv(schema: TObject<TProperties>): ValidationResult {
	const _errors: ValidationError[] = [];
	const warnings: string[] = [];

	if (!state.loaded) {
		return {
			valid: false,
			errors: [{ variable: 'N/A', message: 'Environment not loaded' }],
			warnings: [],
		};
	}

	try {
		Value.Decode(schema, state.raw);
		return { valid: true, errors: [], warnings };
	} catch (error) {
		const validationErrors = extractValidationErrors(error, state.raw);
		return { valid: false, errors: validationErrors, warnings };
	}
}

/**
 * Check if all required variables are present.
 *
 * @param required - List of required variable names
 * @returns Validation result
 */
export function checkRequired(required: readonly string[]): ValidationResult {
	const errors: ValidationError[] = [];

	for (const name of required) {
		if (!(name in state.raw)) {
			errors.push({
				variable: name,
				message: `Required environment variable '${name}' is missing`,
			});
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings: [],
	};
}

// ============================================================================
// Typed Access
// ============================================================================

/**
 * Get a typed environment value.
 *
 * @param key - Variable name
 * @param defaultValue - Default value if not set
 * @returns The decoded value
 */
export function getEnv<T = unknown>(key: string, defaultValue?: T): T {
	if (!state.loaded) {
		throw new EnvNotLoadedError();
	}

	const value = state.decoded[key];
	if (value === undefined) {
		if (defaultValue !== undefined) {
			return defaultValue;
		}
		throw new EnvError(`Environment variable '${key}' is not defined`, 'ENV_MISSING_VARIABLE', {
			variable: key,
		});
	}

	return value as T;
}

/**
 * Get all environment variables as a typed object.
 *
 * @returns All decoded environment variables
 */
export function getAllEnv(): Readonly<Record<string, unknown>> {
	if (!state.loaded) {
		throw new EnvNotLoadedError();
	}

	return Object.freeze({ ...state.decoded });
}

/**
 * Get all raw (string) environment variables.
 *
 * @returns All raw environment variables
 */
export function getRawEnv(): Readonly<ParsedEnv> {
	if (!state.loaded) {
		throw new EnvNotLoadedError();
	}

	return Object.freeze({ ...state.raw });
}

// ============================================================================
// Environment Proxy
// ============================================================================

/**
 * Create a type-safe environment proxy.
 *
 * The proxy provides convenient access to environment variables
 * with automatic initialization checking.
 *
 * @example
 * ```ts
 * const env = createEnvProxy();
 * console.log(env.DATABASE_URL);  // Type-safe access
 * console.log(env.PORT);          // Already decoded to number
 * ```
 */
export function createEnvProxy<T extends Record<string, unknown> = Record<string, unknown>>(): T {
	return new Proxy({} as T, {
		get(_target, prop: string | symbol) {
			if (typeof prop === 'symbol') {
				return undefined;
			}

			if (!state.loaded) {
				throw new EnvNotLoadedError();
			}

			return state.decoded[prop];
		},

		has(_target, prop: string | symbol) {
			if (typeof prop === 'symbol') {
				return false;
			}

			return state.loaded && prop in state.decoded;
		},

		ownKeys() {
			return state.loaded ? Object.keys(state.decoded) : [];
		},

		getOwnPropertyDescriptor(_target, prop: string | symbol) {
			if (typeof prop === 'symbol' || !state.loaded || !(prop in state.decoded)) {
				return undefined;
			}

			return {
				configurable: true,
				enumerable: true,
				value: state.decoded[prop as string],
			};
		},
	});
}

/**
 * Default environment proxy instance.
 *
 * This is the recommended way to access environment variables:
 * ```ts
 * import { env } from '@foxen/env';
 * bootstrapEnv();
 * console.log(env.DATABASE_URL);
 * ```
 */
export const env: Record<string, unknown> = createEnvProxy();

// ============================================================================
// Dynamic Schema Building
// ============================================================================

/**
 * Build a TypeBox schema from the current environment.
 *
 * This is useful for dynamic validation without code generation.
 *
 * @returns TypeBox schema
 */
export function buildEnvSchema(): TObject<TProperties> {
	if (!state.loaded) {
		throw new EnvNotLoadedError();
	}

	const properties: TProperties = {};

	for (const [key, type] of state.types) {
		switch (type) {
			case 'boolean':
				properties[key] = Type.Transform(Type.String())
					.Decode((v) => v === 'true' || v === '1' || v === 'yes' || v === 'on')
					.Encode((v) => String(v));
				break;

			case 'integer':
				properties[key] = Type.Transform(Type.String())
					.Decode((v) => Number.parseInt(v, 10))
					.Encode((v) => String(v));
				break;

			case 'number':
				properties[key] = Type.Transform(Type.String())
					.Decode((v) => Number.parseFloat(v))
					.Encode((v) => String(v));
				break;

			default:
				properties[key] = Type.String();
		}
	}

	return Type.Object(properties);
}

// ============================================================================
// Re-exports for Convenience
// ============================================================================

export { Type } from '@sinclair/typebox';
export type { TObject, TProperties } from '@sinclair/typebox';
