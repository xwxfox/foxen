import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Config } from './types.js';
import { configFileNames, defaultConfig } from './types.js';

/**
 * Find config file in directory tree
 */
export async function findConfigFile(startDir: string = process.cwd()): Promise<string | null> {
	let currentDir = startDir;
	const root = resolve('/');

	while (currentDir !== root) {
		for (const fileName of configFileNames) {
			const configPath = resolve(currentDir, fileName);
			if (existsSync(configPath)) {
				return configPath;
			}
		}

		currentDir = dirname(currentDir);
	}

	return null;
}

/**
 * Load configuration from file
 */
export async function loadConfig(
	configPath?: string,
): Promise<{ config: Config; configDir: string }> {
	// Find config file if not specified
	const resolvedPath = configPath ? resolve(configPath) : await findConfigFile();

	if (!resolvedPath) {
		// Return defaults with current directory
		return {
			config: { ...defaultConfig },
			configDir: process.cwd(),
		};
	}

	if (!existsSync(resolvedPath)) {
		throw new Error(`Config file not found: ${resolvedPath}`);
	}

	const configDir = dirname(resolvedPath);

	// Import the config file
	try {
		const imported = await import(resolvedPath);
		const config = imported.default ?? imported;

		// Merge with defaults
		const mergedConfig: Config = {
			...defaultConfig,
			...config,
		};

		// Resolve relative paths
		mergedConfig.routesDir = resolve(configDir, mergedConfig.routesDir);
		mergedConfig.outputDir = resolve(configDir, mergedConfig.outputDir);

		if (mergedConfig.tsConfigPath) {
			mergedConfig.tsConfigPath = resolve(configDir, mergedConfig.tsConfigPath);
		}

		return {
			config: mergedConfig,
			configDir,
		};
	} catch (error) {
		throw new Error(
			`Failed to load config from ${resolvedPath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Define config helper (for type safety in config files)
 */
export function defineConfig(config: Partial<Config>): Config {
	return {
		...defaultConfig,
		...config,
	};
}

/**
 * Validate config
 */
export function validateConfig(config: Config): string[] {
	const errors: string[] = [];

	if (!config.routesDir) {
		errors.push('routesDir is required');
	}

	if (!config.outputDir) {
		errors.push('outputDir is required');
	}

	if (config.format && !['ts', 'js'].includes(config.format)) {
		errors.push("format must be 'ts' or 'js'");
	}

	return errors;
}
