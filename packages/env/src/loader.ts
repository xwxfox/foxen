import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { EnvError } from './errors.js';
import { inferType } from './inference.js';
import { parseEnvFile } from './parser.js';
import type {
	EnvConfig,
	EnvMode,
	EnvVariable,
	EnvVariableMap,
	ParsedEnv,
	ResolvedEnvConfig,
} from './types.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Default configuration values.
 */
const _DEFAULT_CONFIG: ResolvedEnvConfig = {
	rootDir: process.cwd(),
	mode: 'development',
	outputDir: '.foxen',
	prefix: undefined,
	stripPrefix: false,
	additionalFiles: [],
	exclude: [],
	typeOverrides: {},
	validateExample: false,
	strict: false,
};

/**
 * Resolve configuration with defaults.
 */
export function resolveConfig(config: EnvConfig = {}): ResolvedEnvConfig {
	const mode = config.mode ?? (process.env.NODE_ENV as EnvMode) ?? 'development';
	const strict = config.strict ?? mode === 'production';

	return {
		rootDir: config.rootDir ? resolve(config.rootDir) : process.cwd(),
		mode,
		outputDir: config.outputDir ?? '.foxen',
		prefix: config.prefix,
		stripPrefix: config.stripPrefix ?? false,
		additionalFiles: config.additionalFiles ?? [],
		exclude: config.exclude ?? [],
		typeOverrides: config.typeOverrides ?? {},
		validateExample: config.validateExample ?? false,
		strict,
	};
}

// ============================================================================
// File Hierarchy
// ============================================================================

/**
 * Get the list of .env files to load in order.
 *
 * Files are loaded in this order (later overrides earlier):
 * 1. .env
 * 2. .env.local (not in test mode)
 * 3. .env.[mode]
 * 4. .env.[mode].local (not in test mode)
 *
 * @param mode - The environment mode
 * @returns Array of file names in load order
 */
export function getEnvFileHierarchy(mode: EnvMode): readonly string[] {
	const files: string[] = ['.env'];

	// .env.local is not loaded in test mode (Next.js behavior)
	if (mode !== 'test') {
		files.push('.env.local');
	}

	// Mode-specific file
	files.push(`.env.${mode}`);

	// Mode-specific local (not in test)
	if (mode !== 'test') {
		files.push(`.env.${mode}.local`);
	}

	return files;
}

/**
 * Get all env file paths that exist.
 */
export function getExistingEnvFiles(
	rootDir: string,
	mode: EnvMode,
	additionalFiles: readonly string[] = [],
): readonly string[] {
	const hierarchy = getEnvFileHierarchy(mode);
	const existing: string[] = [];

	// Check standard hierarchy
	for (const file of hierarchy) {
		const fullPath = join(rootDir, file);
		if (existsSync(fullPath)) {
			existing.push(fullPath);
		}
	}

	// Check additional files
	for (const file of additionalFiles) {
		const fullPath = join(rootDir, file);
		if (existsSync(fullPath)) {
			existing.push(fullPath);
		}
	}

	return existing;
}

// ============================================================================
// Loading
// ============================================================================

/**
 * Load and merge environment variables from .env files.
 *
 * @param config - Loader configuration
 * @returns Loaded environment variables with metadata
 *
 * @example
 * ```ts
 * const result = loadEnvFiles({ mode: 'development' });
 * console.log(result.variables); // Map of variable name -> EnvVariable
 * console.log(result.raw);       // Simple key-value object
 * ```
 */
export function loadEnvFiles(config: EnvConfig = {}): LoadResult {
	const resolved = resolveConfig(config);
	const { rootDir, mode, additionalFiles, prefix, stripPrefix, exclude, typeOverrides } = resolved;

	const existingFiles = getExistingEnvFiles(rootDir, mode, additionalFiles);

	if (existingFiles.length === 0) {
		return {
			variables: new Map(),
			raw: {},
			files: [],
			config: resolved,
		};
	}

	// Merge all env files (later overrides earlier)
	const merged: ParsedEnv = {};
	const sources: Map<string, string> = new Map();

	for (const filePath of existingFiles) {
		const content = readEnvFile(filePath);
		const parsed = parseEnvFile(content, filePath);

		for (const [key, value] of Object.entries(parsed)) {
			merged[key] = value;
			sources.set(key, basename(filePath));
		}
	}

	// Build variable map with metadata
	const variables: EnvVariableMap = new Map();

	for (const [name, rawValue] of Object.entries(merged)) {
		// Apply exclusions
		if (exclude.includes(name)) {
			continue;
		}

		// Apply prefix filter
		if (prefix && !name.startsWith(prefix)) {
			continue;
		}

		// Determine final name (with optional prefix stripping)
		const finalName = prefix && stripPrefix ? name.slice(prefix.length) : name;

		// Get type (override or inferred)
		const inferredType = typeOverrides[name] ?? inferType(rawValue);

		const variable: EnvVariable = {
			name: finalName,
			rawValue,
			inferredType,
			source: sources.get(name) ?? 'unknown',
		};

		variables.set(finalName, variable);
	}

	// Build raw env (simple key-value)
	const raw: ParsedEnv = {};
	for (const [name, variable] of variables) {
		raw[name] = variable.rawValue;
	}

	return {
		variables,
		raw,
		files: existingFiles,
		config: resolved,
	};
}

/**
 * Result of loading environment files.
 */
export interface LoadResult {
	/** Variables with full metadata */
	readonly variables: EnvVariableMap;
	/** Simple key-value representation */
	readonly raw: ParsedEnv;
	/** List of files that were loaded */
	readonly files: readonly string[];
	/** Resolved configuration */
	readonly config: ResolvedEnvConfig;
}

/**
 * Read an env file with error handling.
 */
function readEnvFile(filePath: string): string {
	try {
		return readFileSync(filePath, 'utf-8');
	} catch (error) {
		throw new EnvError(`Failed to read environment file: ${filePath}`, 'ENV_FILE_READ_ERROR', {
			filePath,
			originalError: error instanceof Error ? error.message : String(error),
		});
	}
}

// ============================================================================
// Example File Validation
// ============================================================================

/**
 * Load .env.example and validate that all required variables are present.
 *
 * @param rootDir - Root directory
 * @param actualEnv - The loaded environment
 * @returns List of missing variable names
 */
export function validateAgainstExample(rootDir: string, actualEnv: ParsedEnv): readonly string[] {
	const examplePath = join(rootDir, '.env.example');

	if (!existsSync(examplePath)) {
		return [];
	}

	const content = readEnvFile(examplePath);
	const example = parseEnvFile(content, examplePath);
	const missing: string[] = [];

	for (const key of Object.keys(example)) {
		if (!(key in actualEnv)) {
			missing.push(key);
		}
	}

	return missing;
}

// ============================================================================
// Watch Support
// ============================================================================

/**
 * Get all env file paths to watch (existing or potential).
 */
export function getWatchPaths(
	rootDir: string,
	mode: EnvMode,
	additionalFiles: readonly string[] = [],
): readonly string[] {
	const hierarchy = getEnvFileHierarchy(mode);
	const paths: string[] = [];

	for (const file of hierarchy) {
		paths.push(join(rootDir, file));
	}

	for (const file of additionalFiles) {
		paths.push(join(rootDir, file));
	}

	// Also watch .env.example
	paths.push(join(rootDir, '.env.example'));

	return paths;
}

// ============================================================================
// Quick Loaders
// ============================================================================

/**
 * Load environment for development mode.
 */
export function loadDevelopmentEnv(rootDir?: string): LoadResult {
	return loadEnvFiles({ rootDir, mode: 'development' });
}

/**
 * Load environment for production mode.
 */
export function loadProductionEnv(rootDir?: string): LoadResult {
	return loadEnvFiles({ rootDir, mode: 'production' });
}

/**
 * Load environment for test mode.
 */
export function loadTestEnv(rootDir?: string): LoadResult {
	return loadEnvFiles({ rootDir, mode: 'test' });
}
