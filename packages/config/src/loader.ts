import { join, resolve } from 'node:path';
import type { ConfigLoaderOptions, FoxenConfig } from './types.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: FoxenConfig = {
	routesDir: './src/app/api',
	outputDir: './src/generated',
	basePath: '',
	format: 'ts',
	generateBarrel: true,
	tsConfigPath: './tsconfig.json',
	useGroups: false,
	elysiaInstanceName: 'app',
	nextConfigPath: undefined,
	middlewarePath: undefined,
	plugins: [],
	watchPatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
	ignorePatterns: ['node_modules', '.git', 'dist', '.turbo'],
};

/**
 * Possible config file names to search for
 */
const CONFIG_FILE_NAMES = [
	'foxen.config.ts',
	'foxen.config.mts',
	'foxen.config.js',
	'foxen.config.mjs',
	'foxen.config.cjs',
];

/**
 * Type helper for defining Foxen configuration
 *
 * @param config - The configuration object
 * @returns The same configuration with proper type inference
 *
 * @example
 * ```ts
 * // foxen.config.ts
 * import { defineConfig } from '@foxen/config';
 *
 * export default defineConfig({
 *   routesDir: './src/app/api',
 *   outputDir: './src/generated',
 *   basePath: '/api',
 * });
 * ```
 */
export function defineConfig(config: Partial<FoxenConfig>): FoxenConfig {
	return {
		...DEFAULT_CONFIG,
		...config,
	};
}

/**
 * Find the config file in the project
 *
 * @param startDir - Directory to start searching from
 * @returns Path to config file or null if not found
 */
export async function findConfigFile(startDir: string = process.cwd()): Promise<string | null> {
	for (const fileName of CONFIG_FILE_NAMES) {
		const fullPath = join(startDir, fileName);
		try {
			const file = Bun.file(fullPath);
			if (await file.exists()) {
				return fullPath;
			}
		} catch {
			// File doesn't exist, continue
		}
	}

	return null;
}

/**
 * Load and merge Foxen configuration
 *
 * @param options - Loader options
 * @returns Resolved configuration with defaults applied
 *
 * @example
 * ```ts
 * const config = await loadFoxenConfig();
 * console.log(config.routesDir); // './src/app/api'
 * ```
 */
export async function loadFoxenConfig(options?: ConfigLoaderOptions): Promise<FoxenConfig> {
	const startDir = options?.startDir ?? process.cwd();
	let configPath: string | undefined = options?.configPath;

	// Find config file if not explicitly provided
	if (!configPath) {
		configPath = (await findConfigFile(startDir)) ?? undefined;
	} else {
		configPath = resolve(startDir, configPath);
	}

	// No config file found - return defaults
	if (!configPath) {
		if (options?.throwOnMissing) {
			throw new Error(
				`[foxen:config] No config file found in ${startDir}. Create a foxen.config.ts file or specify configPath option.`,
			);
		}
		return { ...DEFAULT_CONFIG };
	}

	try {
		const module = await import(configPath);
		const exported = module.default || module;

		// Handle function-style config
		let config: Partial<FoxenConfig>;
		if (typeof exported === 'function') {
			config = await exported();
		} else {
			config = exported;
		}

		// Merge with defaults
		return {
			...DEFAULT_CONFIG,
			...config,
		};
	} catch (error) {
		console.error(`[foxen:config] Failed to load config: ${configPath}`, error);

		if (options?.throwOnMissing) {
			throw error;
		}

		return { ...DEFAULT_CONFIG };
	}
}

/**
 * Validate a configuration object
 *
 * @param config - Configuration to validate
 * @returns Array of validation errors, empty if valid
 */
export function validateConfig(config: Partial<FoxenConfig>): string[] {
	const errors: string[] = [];

	if (config.routesDir && typeof config.routesDir !== 'string') {
		errors.push('routesDir must be a string');
	}

	if (config.outputDir && typeof config.outputDir !== 'string') {
		errors.push('outputDir must be a string');
	}

	if (config.basePath && typeof config.basePath !== 'string') {
		errors.push('basePath must be a string');
	}

	if (config.format && !['ts', 'js'].includes(config.format)) {
		errors.push("format must be 'ts' or 'js'");
	}

	if (config.plugins && !Array.isArray(config.plugins)) {
		errors.push('plugins must be an array');
	}

	if (config.watchPatterns && !Array.isArray(config.watchPatterns)) {
		errors.push('watchPatterns must be an array');
	}

	if (config.ignorePatterns && !Array.isArray(config.ignorePatterns)) {
		errors.push('ignorePatterns must be an array');
	}

	return errors;
}
