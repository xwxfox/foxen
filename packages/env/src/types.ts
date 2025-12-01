// ============================================================================
// Environment Mode
// ============================================================================

/**
 * Standard Node.js environment modes.
 * Used for selecting appropriate .env files.
 */
export type EnvMode = 'development' | 'test' | 'production';

// ============================================================================
// Inferred Types
// ============================================================================

/**
 * Types that can be inferred from environment variable values.
 */
export type InferredType = 'string' | 'boolean' | 'integer' | 'number';

/**
 * TypeScript type corresponding to an inferred type.
 */
export type InferredTsType<T extends InferredType> = T extends 'boolean'
	? boolean
	: T extends 'integer' | 'number'
		? number
		: string;

// ============================================================================
// Parsed Environment
// ============================================================================

/**
 * A single parsed environment variable with metadata.
 */
export interface EnvVariable {
	/** Variable name (key) */
	readonly name: string;
	/** Raw string value from .env file */
	readonly rawValue: string;
	/** Inferred type based on value pattern */
	readonly inferredType: InferredType;
	/** Source file where this variable was defined (last wins) */
	readonly source: string;
}

/**
 * Map of environment variable name to its metadata.
 */
export type EnvVariableMap = Map<string, EnvVariable>;

/**
 * Simple key-value representation of parsed environment.
 */
export type ParsedEnv = Record<string, string>;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for environment loading and generation.
 */
export interface EnvConfig {
	/**
	 * Root directory to search for .env files.
	 * @default process.cwd()
	 */
	rootDir?: string;

	/**
	 * Override NODE_ENV for file selection.
	 * @default process.env.NODE_ENV || "development"
	 */
	mode?: EnvMode;

	/**
	 * Output directory for generated files (relative to rootDir).
	 * @default ".foxen"
	 */
	outputDir?: string;

	/**
	 * Prefix for environment variables to include.
	 * Only variables starting with this prefix will be processed.
	 * @default undefined (all variables)
	 */
	prefix?: string;

	/**
	 * Whether to strip the prefix from variable names in the typed env object.
	 * @default false
	 */
	stripPrefix?: boolean;

	/**
	 * Additional .env files to load (relative to rootDir).
	 * These are loaded after the standard hierarchy.
	 */
	additionalFiles?: string[];

	/**
	 * Variables to explicitly exclude from processing.
	 */
	exclude?: string[];

	/**
	 * Custom type overrides for specific variables.
	 * Useful when automatic inference doesn't match your needs.
	 *
	 * @example
	 * { PORT: "integer", DEBUG: "boolean" }
	 */
	typeOverrides?: Record<string, InferredType>;

	/**
	 * Whether to validate that all variables from .env.example are present.
	 * @default false
	 */
	validateExample?: boolean;

	/**
	 * Whether to throw on validation errors during bootstrap.
	 * @default true in production, false otherwise
	 */
	strict?: boolean;
}

/**
 * Resolved configuration with all defaults applied.
 */
export interface ResolvedEnvConfig {
	readonly rootDir: string;
	readonly mode: EnvMode;
	readonly outputDir: string;
	readonly prefix: string | undefined;
	readonly stripPrefix: boolean;
	readonly additionalFiles: readonly string[];
	readonly exclude: readonly string[];
	readonly typeOverrides: Readonly<Record<string, InferredType>>;
	readonly validateExample: boolean;
	readonly strict: boolean;
}

// ============================================================================
// Generation Output
// ============================================================================

/**
 * Type of generated file.
 */
export type GeneratedFileType =
	| 'schema' // TypeBox schema file
	| 'declaration' // .d.ts process.env augmentation
	| 'runtime' // Runtime env accessor module
	| 'types'; // Type definitions

/**
 * A single generated file.
 */
export interface GeneratedFile {
	/** Relative path from output directory */
	readonly path: string;
	/** File content */
	readonly content: string;
	/** Type of generated file */
	readonly type: GeneratedFileType;
}

/**
 * Result of code generation.
 */
export interface GenerationResult {
	/** All generated files */
	readonly files: readonly GeneratedFile[];
	/** Absolute path to output directory */
	readonly outputDir: string;
	/** Number of environment variables processed */
	readonly variableCount: number;
	/** Any warnings during generation */
	readonly warnings: readonly string[];
}

// ============================================================================
// Runtime Types
// ============================================================================

/**
 * Options for bootstrapping environment at runtime.
 */
export interface BootstrapOptions {
	/**
	 * Root directory containing .env files.
	 * @default process.cwd()
	 */
	rootDir?: string;

	/**
	 * Environment mode override.
	 * @default process.env.NODE_ENV || "development"
	 */
	mode?: EnvMode;

	/**
	 * Whether to validate environment against schema.
	 * @default true
	 */
	validate?: boolean;

	/**
	 * Whether to throw on missing/invalid variables.
	 * @default true in production, false otherwise
	 */
	strict?: boolean;

	/**
	 * Whether to inject variables into process.env.
	 * @default true
	 */
	injectToProcessEnv?: boolean;
}

/**
 * Result of validation.
 */
export interface ValidationResult {
	/** Whether validation passed */
	readonly valid: boolean;
	/** Validation errors if any */
	readonly errors: readonly ValidationError[];
	/** Warnings (non-fatal issues) */
	readonly warnings: readonly string[];
}

/**
 * A single validation error.
 */
export interface ValidationError {
	/** Variable name */
	readonly variable: string;
	/** Error message */
	readonly message: string;
	/** Expected type */
	readonly expected?: InferredType;
	/** Actual value (sanitized) */
	readonly actual?: string;
}

// ============================================================================
// Internal Symbols
// ============================================================================

/**
 * Symbol for internal env state.
 */
export const ENV_INTERNAL = Symbol.for('foxen.env.internal');

/**
 * Symbol marking the env proxy.
 */
export const ENV_PROXY = Symbol.for('foxen.env.proxy');
