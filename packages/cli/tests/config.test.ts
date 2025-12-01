import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, findConfigFile, loadConfig, validateConfig } from '../src/config.js';
import { defaultConfig } from '../src/types.js';

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, 'fixtures-config');

// Setup test fixtures
beforeAll(() => {
	mkdirSync(join(FIXTURES_DIR, 'with-config'), { recursive: true });
	mkdirSync(join(FIXTURES_DIR, 'nested', 'deep'), { recursive: true });
	mkdirSync(join(FIXTURES_DIR, 'no-config'), { recursive: true });

	// TypeScript config
	writeFileSync(
		join(FIXTURES_DIR, 'with-config', 'foxen.config.ts'),
		`
export default {
    routesDir: "./src/app/api",
    outputDir: "./src/generated",
    basePath: "/api",
    format: "ts",
};
`,
	);

	// Config in parent directory
	writeFileSync(
		join(FIXTURES_DIR, 'nested', 'foxen.config.ts'),
		`
export default {
    routesDir: "./routes",
    outputDir: "./output",
};
`,
	);
});

// Cleanup test fixtures
afterAll(() => {
	rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('findConfigFile', () => {
	test('finds config in current directory', async () => {
		const result = await findConfigFile(join(FIXTURES_DIR, 'with-config'));

		expect(result).not.toBeNull();
		expect(result).toContain('foxen.config.ts');
	});

	test('finds config in parent directory', async () => {
		const result = await findConfigFile(join(FIXTURES_DIR, 'nested', 'deep'));

		expect(result).not.toBeNull();
		expect(result).toContain('foxen.config.ts');
	});

	test('returns null when no config found', async () => {
		const result = await findConfigFile(join(FIXTURES_DIR, 'no-config'));

		expect(result).toBeNull();
	});
});

describe('loadConfig', () => {
	test('loads config from explicit path', async () => {
		const configPath = join(FIXTURES_DIR, 'with-config', 'foxen.config.ts');
		const { config } = await loadConfig(configPath);

		expect(config.basePath).toBe('/api');
		expect(config.format).toBe('ts');
	});

	test('auto-detects config file', async () => {
		// Save current dir and change to fixture dir
		const originalCwd = process.cwd();

		try {
			process.chdir(join(FIXTURES_DIR, 'with-config'));
			const { config } = await loadConfig();

			expect(config.basePath).toBe('/api');
		} finally {
			process.chdir(originalCwd);
		}
	});

	test('resolves relative paths', async () => {
		const configPath = join(FIXTURES_DIR, 'with-config', 'foxen.config.ts');
		const { config, configDir } = await loadConfig(configPath);

		expect(config.routesDir).toContain(configDir);
		expect(config.outputDir).toContain(configDir);
	});

	test('returns defaults when no config file', async () => {
		const originalCwd = process.cwd();

		try {
			process.chdir(join(FIXTURES_DIR, 'no-config'));
			const { config } = await loadConfig();

			expect(config.routesDir).toBeDefined();
			expect(config.outputDir).toBeDefined();
		} finally {
			process.chdir(originalCwd);
		}
	});

	test('merges with defaults', async () => {
		const configPath = join(FIXTURES_DIR, 'with-config', 'foxen.config.ts');
		const { config } = await loadConfig(configPath);

		// Should have explicit values
		expect(config.basePath).toBe('/api');

		// Should have defaults for missing values
		expect(config.ignorePatterns).toBeDefined();
	});

	test('throws for non-existent explicit path', async () => {
		expect(loadConfig('/nonexistent/foxen.config.ts')).rejects.toThrow('Config file not found');
	});

	test('returns configDir', async () => {
		const configPath = join(FIXTURES_DIR, 'with-config', 'foxen.config.ts');
		const { configDir } = await loadConfig(configPath);

		expect(configDir).toBe(join(FIXTURES_DIR, 'with-config'));
	});
});

describe('defineConfig', () => {
	test('returns merged config', () => {
		const config = defineConfig({
			routesDir: './custom/routes',
			basePath: '/v2',
		});

		expect(config.routesDir).toBe('./custom/routes');
		expect(config.basePath).toBe('/v2');
		// Should have defaults
		expect(config.format).toBeDefined();
	});

	test('preserves all provided values', () => {
		const config = defineConfig({
			routesDir: './routes',
			outputDir: './out',
			basePath: '/api',
			format: 'js',
			generateBarrel: false,
			useGroups: false,
		});

		expect(config.routesDir).toBe('./routes');
		expect(config.outputDir).toBe('./out');
		expect(config.basePath).toBe('/api');
		expect(config.format).toBe('js');
		expect(config.generateBarrel).toBe(false);
		expect(config.useGroups).toBe(false);
	});

	test('provides type safety', () => {
		// This test verifies the function works with TypeScript
		const config = defineConfig({
			routesDir: './routes',
		});

		// Should be assignable to Config type
		expect(typeof config.routesDir).toBe('string');
	});
});

describe('validateConfig', () => {
	test('returns empty array for valid config', () => {
		const config = {
			...defaultConfig,
			routesDir: './routes',
			outputDir: './output',
		};

		const errors = validateConfig(config);

		expect(errors).toHaveLength(0);
	});

	test('returns error for missing routesDir', () => {
		const config = {
			...defaultConfig,
			routesDir: '',
			outputDir: './output',
		};

		const errors = validateConfig(config);

		expect(errors).toContain('routesDir is required');
	});

	test('returns error for missing outputDir', () => {
		const config = {
			...defaultConfig,
			routesDir: './routes',
			outputDir: '',
		};

		const errors = validateConfig(config);

		expect(errors).toContain('outputDir is required');
	});

	test('returns error for invalid format', () => {
		const config = {
			...defaultConfig,
			routesDir: './routes',
			outputDir: './output',
			format: 'invalid' as 'ts' | 'js',
		};

		const errors = validateConfig(config);

		expect(errors).toContain("format must be 'ts' or 'js'");
	});

	test('returns multiple errors', () => {
		const config = {
			...defaultConfig,
			routesDir: '',
			outputDir: '',
			format: 'invalid' as 'ts' | 'js',
		};

		const errors = validateConfig(config);

		expect(errors.length).toBeGreaterThanOrEqual(2);
	});
});
