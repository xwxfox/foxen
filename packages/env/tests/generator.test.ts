import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateAndWriteEnvFiles, generateEnvFiles, needsRegeneration } from '../src/generator.js';

// Test directory
const TEST_DIR = join(import.meta.dir, '.test-generator');

describe('generateEnvFiles', () => {
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

	it('should return empty result when no env files exist', async () => {
		const result = await generateEnvFiles({ rootDir: TEST_DIR });

		expect(result.files.length).toBe(0);
		expect(result.variableCount).toBe(0);
		expect(result.warnings.length).toBeGreaterThan(0);
	});

	it('should generate all required files', async () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');

		const result = await generateEnvFiles({ rootDir: TEST_DIR });

		expect(result.files.length).toBe(5);
		expect(result.variableCount).toBe(1);

		const fileNames = result.files.map((f) => f.path);
		expect(fileNames).toContain('env.schema.ts');
		expect(fileNames).toContain('env.d.ts');
		expect(fileNames).toContain('env.types.ts');
		expect(fileNames).toContain('env.runtime.ts');
		expect(fileNames).toContain('index.ts');
	});

	describe('schema file generation', () => {
		it('should generate TypeBox schema for string variables', async () => {
			writeFileSync(join(TEST_DIR, '.env'), 'NAME=myapp\n');

			const result = await generateEnvFiles({ rootDir: TEST_DIR });
			const schemaFile = result.files.find((f) => f.path === 'env.schema.ts');

			expect(schemaFile).toBeDefined();
			expect(schemaFile?.content).toContain('Type.String()');
			expect(schemaFile?.content).toContain('NAME:');
		});

		it('should generate TypeBox schema for boolean variables', async () => {
			writeFileSync(join(TEST_DIR, '.env'), 'DEBUG=true\n');

			const result = await generateEnvFiles({ rootDir: TEST_DIR });
			const schemaFile = result.files.find((f) => f.path === 'env.schema.ts');

			expect(schemaFile).toBeDefined();
			expect(schemaFile?.content).toContain('Type.Transform');
			expect(schemaFile?.content).toContain('DEBUG:');
		});

		it('should generate TypeBox schema for integer variables', async () => {
			writeFileSync(join(TEST_DIR, '.env'), 'PORT=3000\n');

			const result = await generateEnvFiles({ rootDir: TEST_DIR });
			const schemaFile = result.files.find((f) => f.path === 'env.schema.ts');

			expect(schemaFile).toBeDefined();
			expect(schemaFile?.content).toContain('parseInt');
			expect(schemaFile?.content).toContain('PORT:');
		});

		it('should generate TypeBox schema for number variables', async () => {
			writeFileSync(join(TEST_DIR, '.env'), 'RATE=0.5\n');

			const result = await generateEnvFiles({ rootDir: TEST_DIR });
			const schemaFile = result.files.find((f) => f.path === 'env.schema.ts');

			expect(schemaFile).toBeDefined();
			expect(schemaFile?.content).toContain('parseFloat');
			expect(schemaFile?.content).toContain('RATE:');
		});
	});

	describe('declaration file generation', () => {
		it('should generate ProcessEnv augmentation', async () => {
			writeFileSync(join(TEST_DIR, '.env'), 'KEY1=value1\nKEY2=value2\n');

			const result = await generateEnvFiles({ rootDir: TEST_DIR });
			const dtsFile = result.files.find((f) => f.path === 'env.d.ts');

			expect(dtsFile).toBeDefined();
			expect(dtsFile?.content).toContain('declare global');
			expect(dtsFile?.content).toContain('namespace NodeJS');
			expect(dtsFile?.content).toContain('interface ProcessEnv');
			expect(dtsFile?.content).toContain('readonly KEY1: string;');
			expect(dtsFile?.content).toContain('readonly KEY2: string;');
		});
	});

	describe('types file generation', () => {
		it('should generate Env interface with correct types', async () => {
			writeFileSync(join(TEST_DIR, '.env'), 'DEBUG=true\nPORT=3000\nNAME=myapp\n');

			const result = await generateEnvFiles({ rootDir: TEST_DIR });
			const typesFile = result.files.find((f) => f.path === 'env.types.ts');

			expect(typesFile).toBeDefined();
			expect(typesFile?.content).toContain('interface Env');
			expect(typesFile?.content).toContain('readonly DEBUG: boolean;');
			expect(typesFile?.content).toContain('readonly PORT: number;');
			expect(typesFile?.content).toContain('readonly NAME: string;');
		});

		it('should generate EnvKey type', async () => {
			writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');

			const result = await generateEnvFiles({ rootDir: TEST_DIR });
			const typesFile = result.files.find((f) => f.path === 'env.types.ts');

			expect(typesFile).toBeDefined();
			expect(typesFile?.content).toContain('type EnvKey = keyof Env;');
		});
	});

	describe('runtime file generation', () => {
		it('should generate runtime module with env object', async () => {
			writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');

			const result = await generateEnvFiles({ rootDir: TEST_DIR });
			const runtimeFile = result.files.find((f) => f.path === 'env.runtime.ts');

			expect(runtimeFile).toBeDefined();
			expect(runtimeFile?.content).toContain('export const env: Env');
			expect(runtimeFile?.content).toContain('initializeEnv');
			expect(runtimeFile?.content).toContain('resetEnv');
		});

		it('should generate getters for each variable', async () => {
			writeFileSync(join(TEST_DIR, '.env'), 'DEBUG=true\nPORT=3000\n');

			const result = await generateEnvFiles({ rootDir: TEST_DIR });
			const runtimeFile = result.files.find((f) => f.path === 'env.runtime.ts');

			expect(runtimeFile).toBeDefined();
			expect(runtimeFile?.content).toContain('get DEBUG()');
			expect(runtimeFile?.content).toContain('get PORT()');
		});
	});

	describe('index file generation', () => {
		it('should re-export all modules', async () => {
			writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');

			const result = await generateEnvFiles({ rootDir: TEST_DIR });
			const indexFile = result.files.find((f) => f.path === 'index.ts');

			expect(indexFile).toBeDefined();
			expect(indexFile?.content).toContain('./env.runtime.js');
			expect(indexFile?.content).toContain('./env.schema.js');
			expect(indexFile?.content).toContain('./env.types.js');
		});
	});
});

describe('generateAndWriteEnvFiles', () => {
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

	it('should write all generated files to disk', async () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');

		await generateAndWriteEnvFiles({
			rootDir: TEST_DIR,
			outputDir: '.foxen',
		});

		const outputDir = join(TEST_DIR, '.foxen');
		expect(existsSync(join(outputDir, 'env.schema.ts'))).toBe(true);
		expect(existsSync(join(outputDir, 'env.d.ts'))).toBe(true);
		expect(existsSync(join(outputDir, 'env.types.ts'))).toBe(true);
		expect(existsSync(join(outputDir, 'env.runtime.ts'))).toBe(true);
		expect(existsSync(join(outputDir, 'index.ts'))).toBe(true);
	});

	it("should create output directory if it doesn't exist", async () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');

		const outputDir = join(TEST_DIR, 'nested/output');
		await generateAndWriteEnvFiles({
			rootDir: TEST_DIR,
			outputDir: 'nested/output',
		});

		expect(existsSync(outputDir)).toBe(true);
	});
});

describe('needsRegeneration', () => {
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

	it("should return true when output files don't exist", () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');

		const needs = needsRegeneration({ rootDir: TEST_DIR });
		expect(needs).toBe(true);
	});

	it('should return false when all output files exist', async () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');

		await generateAndWriteEnvFiles({ rootDir: TEST_DIR });

		const needs = needsRegeneration({ rootDir: TEST_DIR });
		expect(needs).toBe(false);
	});

	it('should return true when some output files are missing', async () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');

		await generateAndWriteEnvFiles({ rootDir: TEST_DIR });

		// Remove one file
		rmSync(join(TEST_DIR, '.foxen', 'env.schema.ts'));

		const needs = needsRegeneration({ rootDir: TEST_DIR });
		expect(needs).toBe(true);
	});
});
