// ============================================================================
// Core Runtime
// ============================================================================

export {
	// Bootstrap & lifecycle
	bootstrapEnv,
	resetEnv,
	isEnvLoaded,
	getLoadedFiles,
	// Validation
	validateEnv,
	checkRequired,
	// Typed access
	getEnv,
	getAllEnv,
	getRawEnv,
	// Proxy
	createEnvProxy,
	env,
	// Schema building
	buildEnvSchema,
	// Re-exports
	Type,
} from './runtime.js';

export type { TObject, TProperties } from './runtime.js';

// ============================================================================
// Parser
// ============================================================================

export {
	parseEnvFile,
	parseEnvLine,
	stringifyEnvFile,
} from './parser.js';

// ============================================================================
// Loader
// ============================================================================

export {
	loadEnvFiles,
	resolveConfig,
	getEnvFileHierarchy,
	getExistingEnvFiles,
	validateAgainstExample,
	getWatchPaths,
	loadDevelopmentEnv,
	loadProductionEnv,
	loadTestEnv,
} from './loader.js';

export type { LoadResult } from './loader.js';

// ============================================================================
// Inference
// ============================================================================

export {
	inferType,
	toTypeScriptType,
	toTypeBoxMethod,
	decodeValue,
	encodeValue,
	inferTypes,
	decodeEnv,
	validateType,
	canDecode,
} from './inference.js';

// ============================================================================
// Generator
// ============================================================================

export {
	generateEnvFiles,
	generateAndWriteEnvFiles,
	needsRegeneration,
} from './generator.js';

// ============================================================================
// Errors
// ============================================================================

export {
	EnvError,
	EnvParseError,
	EnvFileNotFoundError,
	EnvValidationError,
	EnvNotLoadedError,
	EnvGenerateError,
	isEnvError,
	wrapEnvError,
	envErrorSuggestions,
} from './errors.js';

export type { EnvErrorCode } from './errors.js';

// ============================================================================
// Types
// ============================================================================

export type {
	// Mode
	EnvMode,
	// Inference
	InferredType,
	InferredTsType,
	// Variables
	EnvVariable,
	EnvVariableMap,
	ParsedEnv,
	// Configuration
	EnvConfig,
	ResolvedEnvConfig,
	// Generation
	GeneratedFileType,
	GeneratedFile,
	GenerationResult,
	// Runtime
	BootstrapOptions,
	ValidationResult,
	ValidationError,
} from './types.js';

export { ENV_INTERNAL, ENV_PROXY } from './types.js';

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick setup: bootstrap + generate if needed.
 *
 * This is the recommended way to set up environment handling.
 * It will:
 * 1. Load .env files and inject into process.env
 * 2. Generate schema files if they don't exist
 *
 * @param options - Bootstrap options
 *
 * @example
 * ```ts
 * import { setupEnv } from '@foxen/env';
 *
 * // At the very start of your app
 * await setupEnv({ mode: 'development' });
 * ```
 */
export async function setupEnv(options: import('./types.js').BootstrapOptions = {}): Promise<void> {
	const { bootstrapEnv } = await import('./runtime.js');
	const { needsRegeneration, generateAndWriteEnvFiles } = await import('./generator.js');

	// Bootstrap first to load .env files
	bootstrapEnv(options);

	// Generate schema files if needed
	if (needsRegeneration({ rootDir: options.rootDir, mode: options.mode })) {
		await generateAndWriteEnvFiles({ rootDir: options.rootDir, mode: options.mode });
	}
}

/**
 * Define environment configuration.
 *
 * Helper function for type-safe configuration.
 *
 * @param config - Configuration options
 * @returns The same configuration (typed)
 *
 * @example
 * ```ts
 * // foxen.config.ts
 * import { defineEnvConfig } from '@foxen/env';
 *
 * export default defineEnvConfig({
 *   prefix: 'APP_',
 *   stripPrefix: true,
 *   typeOverrides: {
 *     APP_PORT: 'integer',
 *   },
 * });
 * ```
 */
export function defineEnvConfig(
	config: import('./types.js').EnvConfig,
): import('./types.js').EnvConfig {
	return config;
}
