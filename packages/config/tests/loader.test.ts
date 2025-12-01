import { describe, expect, it } from 'bun:test';
import { DEFAULT_CONFIG, defineConfig, validateConfig } from '../src/loader.js';

describe('defineConfig', () => {
	it('returns config with defaults', () => {
		const config = defineConfig({});
		expect(config.routesDir).toBe(DEFAULT_CONFIG.routesDir);
		expect(config.outputDir).toBe(DEFAULT_CONFIG.outputDir);
	});

	it('overrides defaults with provided values', () => {
		const config = defineConfig({
			routesDir: './custom/routes',
			basePath: '/api/v2',
		});
		expect(config.routesDir).toBe('./custom/routes');
		expect(config.basePath).toBe('/api/v2');
		expect(config.outputDir).toBe(DEFAULT_CONFIG.outputDir);
	});

	it('preserves all default values', () => {
		const config = defineConfig({});
		expect(config.format).toBe('ts');
		expect(config.generateBarrel).toBe(true);
		expect(config.useGroups).toBe(false);
		expect(config.plugins).toEqual([]);
	});
});

describe('DEFAULT_CONFIG', () => {
	it('has expected default values', () => {
		expect(DEFAULT_CONFIG.routesDir).toBe('./src/app/api');
		expect(DEFAULT_CONFIG.outputDir).toBe('./src/generated');
		expect(DEFAULT_CONFIG.basePath).toBe('');
		expect(DEFAULT_CONFIG.format).toBe('ts');
		expect(DEFAULT_CONFIG.generateBarrel).toBe(true);
		expect(DEFAULT_CONFIG.useGroups).toBe(false);
		expect(DEFAULT_CONFIG.elysiaInstanceName).toBe('app');
	});

	it('has array defaults', () => {
		expect(Array.isArray(DEFAULT_CONFIG.plugins)).toBe(true);
		expect(Array.isArray(DEFAULT_CONFIG.watchPatterns)).toBe(true);
		expect(Array.isArray(DEFAULT_CONFIG.ignorePatterns)).toBe(true);
	});
});

describe('validateConfig', () => {
	it('returns no errors for valid config', () => {
		const errors = validateConfig({
			routesDir: './src/routes',
			outputDir: './dist',
			basePath: '/api',
			format: 'ts',
		});
		expect(errors).toHaveLength(0);
	});

	it('returns error for invalid routesDir', () => {
		const errors = validateConfig({
			routesDir: 123 as unknown as string,
		});
		expect(errors).toContain('routesDir must be a string');
	});

	it('returns error for invalid format', () => {
		const errors = validateConfig({
			format: 'invalid' as unknown as 'ts' | 'js',
		});
		expect(errors).toContain("format must be 'ts' or 'js'");
	});

	it('returns error for invalid plugins', () => {
		const errors = validateConfig({
			plugins: 'not-an-array' as unknown as string[],
		});
		expect(errors).toContain('plugins must be an array');
	});

	it('returns multiple errors', () => {
		const errors = validateConfig({
			routesDir: 123 as unknown as string,
			format: 'invalid' as unknown as 'ts' | 'js',
			plugins: 'not-an-array' as unknown as string[],
		});
		expect(errors.length).toBe(3);
	});
});
