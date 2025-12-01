import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	getEnvFileHierarchy,
	getExistingEnvFiles,
	loadEnvFiles,
	resolveConfig,
	validateAgainstExample,
} from '../src/loader.js';

// Test directory
const TEST_DIR = join(import.meta.dir, '.test-loader');

describe('getEnvFileHierarchy', () => {
	it('should return development hierarchy', () => {
		const files = getEnvFileHierarchy('development');
		expect(files).toEqual(['.env', '.env.local', '.env.development', '.env.development.local']);
	});

	it('should return production hierarchy', () => {
		const files = getEnvFileHierarchy('production');
		expect(files).toEqual(['.env', '.env.local', '.env.production', '.env.production.local']);
	});

	it('should skip .local files in test mode', () => {
		const files = getEnvFileHierarchy('test');
		expect(files).toEqual(['.env', '.env.test']);
		expect(files).not.toContain('.env.local');
		expect(files).not.toContain('.env.test.local');
	});
});

describe('resolveConfig', () => {
	it('should apply default values', () => {
		const config = resolveConfig({});

		expect(config.rootDir).toBe(process.cwd());
		expect(config.outputDir).toBe('.foxen');
		expect(config.prefix).toBeUndefined();
		expect(config.stripPrefix).toBe(false);
		expect(config.additionalFiles).toEqual([]);
		expect(config.exclude).toEqual([]);
		expect(config.typeOverrides).toEqual({});
		expect(config.validateExample).toBe(false);
	});

	it('should override defaults with provided values', () => {
		const config = resolveConfig({
			outputDir: 'custom-output',
			prefix: 'APP_',
			stripPrefix: true,
		});

		expect(config.outputDir).toBe('custom-output');
		expect(config.prefix).toBe('APP_');
		expect(config.stripPrefix).toBe(true);
	});

	it('should set strict mode in production', () => {
		const config = resolveConfig({ mode: 'production' });
		expect(config.strict).toBe(true);
	});
});

describe('loadEnvFiles', () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	it('should load a single .env file', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');

		const result = loadEnvFiles({ rootDir: TEST_DIR, mode: 'development' });

		expect(result.raw).toEqual({ KEY: 'value' });
		expect(result.variables.size).toBe(1);
		expect(result.files.length).toBe(1);
	});

	it('should merge multiple .env files with correct priority', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=base\nBASE_ONLY=yes\n');
		writeFileSync(join(TEST_DIR, '.env.development'), 'KEY=dev\nDEV_ONLY=yes\n');

		const result = loadEnvFiles({ rootDir: TEST_DIR, mode: 'development' });

		expect(result.raw.KEY).toBe('dev'); // Later file wins
		expect(result.raw.BASE_ONLY).toBe('yes');
		expect(result.raw.DEV_ONLY).toBe('yes');
	});

	it('should apply prefix filter', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'APP_KEY=value\nOTHER_KEY=other\n');

		const result = loadEnvFiles({
			rootDir: TEST_DIR,
			mode: 'development',
			prefix: 'APP_',
		});

		expect(result.raw.APP_KEY).toBe('value');
		expect(result.raw.OTHER_KEY).toBeUndefined();
	});

	it('should strip prefix when configured', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'APP_KEY=value\n');

		const result = loadEnvFiles({
			rootDir: TEST_DIR,
			mode: 'development',
			prefix: 'APP_',
			stripPrefix: true,
		});

		expect(result.raw.KEY).toBe('value');
		expect(result.raw.APP_KEY).toBeUndefined();
	});

	it('should apply exclusions', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEEP=yes\nSECRET=hidden\n');

		const result = loadEnvFiles({
			rootDir: TEST_DIR,
			mode: 'development',
			exclude: ['SECRET'],
		});

		expect(result.raw.KEEP).toBe('yes');
		expect(result.raw.SECRET).toBeUndefined();
	});

	it('should apply type overrides', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'PORT=3000\n');

		const result = loadEnvFiles({
			rootDir: TEST_DIR,
			mode: 'development',
			typeOverrides: { PORT: 'string' },
		});

		expect(result.variables.get('PORT')?.inferredType).toBe('string');
	});

	it('should infer types correctly', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'DEBUG=true\nPORT=3000\nRATE=0.5\nNAME=test\n');

		const result = loadEnvFiles({ rootDir: TEST_DIR, mode: 'development' });

		expect(result.variables.get('DEBUG')?.inferredType).toBe('boolean');
		expect(result.variables.get('PORT')?.inferredType).toBe('integer');
		expect(result.variables.get('RATE')?.inferredType).toBe('number');
		expect(result.variables.get('NAME')?.inferredType).toBe('string');
	});

	it('should skip .local files in test mode', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=base\n');
		writeFileSync(join(TEST_DIR, '.env.local'), 'KEY=local\n');

		const result = loadEnvFiles({ rootDir: TEST_DIR, mode: 'test' });

		expect(result.raw.KEY).toBe('base'); // .env.local should NOT be loaded
	});

	it('should return empty result when no files exist', () => {
		const result = loadEnvFiles({ rootDir: TEST_DIR, mode: 'development' });

		expect(result.variables.size).toBe(0);
		expect(result.raw).toEqual({});
		expect(result.files.length).toBe(0);
	});

	it('should load additional files', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'BASE=yes\n');
		writeFileSync(join(TEST_DIR, '.env.custom'), 'CUSTOM=yes\n');

		const result = loadEnvFiles({
			rootDir: TEST_DIR,
			mode: 'development',
			additionalFiles: ['.env.custom'],
		});

		expect(result.raw.BASE).toBe('yes');
		expect(result.raw.CUSTOM).toBe('yes');
	});
});

describe('getExistingEnvFiles', () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	it('should only return files that exist', () => {
		writeFileSync(join(TEST_DIR, '.env'), '');
		writeFileSync(join(TEST_DIR, '.env.development'), '');

		const files = getExistingEnvFiles(TEST_DIR, 'development');

		expect(files.length).toBe(2);
		expect(files.some((f) => f.endsWith('.env'))).toBe(true);
		expect(files.some((f) => f.endsWith('.env.development'))).toBe(true);
	});
});

describe('validateAgainstExample', () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	it("should return empty array when .env.example doesn't exist", () => {
		const missing = validateAgainstExample(TEST_DIR, { KEY: 'value' });
		expect(missing).toEqual([]);
	});

	it('should return missing variables', () => {
		writeFileSync(join(TEST_DIR, '.env.example'), 'KEY1=\nKEY2=\nKEY3=\n');

		const missing = validateAgainstExample(TEST_DIR, { KEY1: 'value1' });

		expect(missing).toContain('KEY2');
		expect(missing).toContain('KEY3');
		expect(missing).not.toContain('KEY1');
	});

	it('should return empty array when all variables present', () => {
		writeFileSync(join(TEST_DIR, '.env.example'), 'KEY1=\nKEY2=\n');

		const missing = validateAgainstExample(TEST_DIR, {
			KEY1: 'value1',
			KEY2: 'value2',
		});

		expect(missing).toEqual([]);
	});
});
