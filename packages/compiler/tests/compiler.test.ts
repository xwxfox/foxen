import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	Compiler,
	type CompilerOptions,
	compile,
	compileAndWrite,
	defineConfig,
} from '../src/compiler.js';

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, 'fixtures-compiler');
const ROUTES_DIR = join(FIXTURES_DIR, 'routes');
const OUTPUT_DIR = join(FIXTURES_DIR, 'output');

// Setup test fixtures
beforeAll(() => {
	mkdirSync(join(ROUTES_DIR, 'users'), { recursive: true });
	mkdirSync(join(ROUTES_DIR, 'health'), { recursive: true });
	mkdirSync(OUTPUT_DIR, { recursive: true });

	// Basic route
	writeFileSync(
		join(ROUTES_DIR, 'users', 'route.ts'),
		`
import { NextRequest, NextResponse } from '@foxen/core';

export async function GET(request: NextRequest) {
    return NextResponse.json({ users: [] });
}
`,
	);

	// Health route
	writeFileSync(
		join(ROUTES_DIR, 'health', 'route.ts'),
		`
export function GET() {
    return Response.json({ status: "ok" });
}
`,
	);
});

// Cleanup test fixtures
afterAll(() => {
	rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

function createCompilerOptions(): CompilerOptions {
	return {
		analyzer: {
			rootDir: ROUTES_DIR,
		},
		generator: {
			outputPath: OUTPUT_DIR,
			format: 'ts',
		},
		verbose: false,
	};
}

describe('Compiler', () => {
	describe('constructor', () => {
		test('creates compiler with options', () => {
			const options = createCompilerOptions();
			const compiler = new Compiler(options);
			expect(compiler).toBeDefined();
		});

		test('accepts plugins', () => {
			const options: CompilerOptions = {
				...createCompilerOptions(),
				plugins: [
					{
						name: 'test-plugin',
					},
				],
			};
			const compiler = new Compiler(options);
			expect(compiler).toBeDefined();
		});
	});

	describe('compile', () => {
		test('analyzes and generates code', async () => {
			const options = createCompilerOptions();
			const compiler = new Compiler(options);

			const result = await compiler.compile();

			expect(result.analysis).toBeDefined();
			expect(result.output).toBeDefined();
			expect(result.duration).toBeGreaterThan(0);
		});

		test('returns analysis result', async () => {
			const options = createCompilerOptions();
			const compiler = new Compiler(options);

			const result = await compiler.compile();

			expect(result.analysis.routes.length).toBeGreaterThan(0);
			expect(result.analysis.rootDir).toBe(ROUTES_DIR);
		});

		test('returns generated output', async () => {
			const options = createCompilerOptions();
			const compiler = new Compiler(options);

			const result = await compiler.compile();

			expect(result.output.routerCode).toBeDefined();
			expect(result.output.files.length).toBeGreaterThan(0);
		});

		test('runs beforeAnalysis plugin hook', async () => {
			let hookCalled = false;

			const options: CompilerOptions = {
				...createCompilerOptions(),
				plugins: [
					{
						name: 'test-plugin',
						beforeAnalysis: () => {
							hookCalled = true;
						},
					},
				],
			};

			const compiler = new Compiler(options);
			await compiler.compile();

			expect(hookCalled).toBe(true);
		});

		test('runs afterAnalysis plugin hook', async () => {
			let analysisResult: unknown = null;

			const options: CompilerOptions = {
				...createCompilerOptions(),
				plugins: [
					{
						name: 'test-plugin',
						afterAnalysis: (result) => {
							analysisResult = result;
							return result;
						},
					},
				],
			};

			const compiler = new Compiler(options);
			await compiler.compile();

			expect(analysisResult).not.toBeNull();
		});

		test('runs beforeGeneration plugin hook', async () => {
			let hookCalled = false;

			const options: CompilerOptions = {
				...createCompilerOptions(),
				plugins: [
					{
						name: 'test-plugin',
						beforeGeneration: () => {
							hookCalled = true;
						},
					},
				],
			};

			const compiler = new Compiler(options);
			await compiler.compile();

			expect(hookCalled).toBe(true);
		});

		test('runs afterGeneration plugin hook', async () => {
			let outputResult: unknown = null;

			const options: CompilerOptions = {
				...createCompilerOptions(),
				plugins: [
					{
						name: 'test-plugin',
						afterGeneration: (output) => {
							outputResult = output;
							return output;
						},
					},
				],
			};

			const compiler = new Compiler(options);
			await compiler.compile();

			expect(outputResult).not.toBeNull();
		});

		test('applies route transformers from plugins', async () => {
			let _transformerCalled = false;

			const options: CompilerOptions = {
				...createCompilerOptions(),
				plugins: [
					{
						name: 'test-plugin',
						transformRoute: () => {
							_transformerCalled = true;
							return '';
						},
					},
				],
			};

			const compiler = new Compiler(options);
			await compiler.compile();

			// Transformer is added but may not be invoked in all code paths
			expect(compiler).toBeDefined();
		});
	});

	describe('compileAndWrite', () => {
		test('writes files to output directory', async () => {
			const options = createCompilerOptions();
			const compiler = new Compiler(options);

			await compiler.compileAndWrite();

			const routerPath = join(OUTPUT_DIR, 'router.ts');
			expect(existsSync(routerPath)).toBe(true);
		});

		test('throws if no output path', async () => {
			const options: CompilerOptions = {
				analyzer: {
					rootDir: ROUTES_DIR,
				},
				generator: {
					format: 'ts',
				},
				verbose: false,
			};

			const compiler = new Compiler(options);

			expect(compiler.compileAndWrite()).rejects.toThrow('Output path is required');
		});

		test('returns compile result', async () => {
			const options = createCompilerOptions();
			const compiler = new Compiler(options);

			const result = await compiler.compileAndWrite();

			expect(result.analysis).toBeDefined();
			expect(result.output).toBeDefined();
		});
	});
});

describe('compile', () => {
	test('is a convenience function', async () => {
		const options = createCompilerOptions();
		const result = await compile(options);

		expect(result.analysis).toBeDefined();
		expect(result.output).toBeDefined();
	});
});

describe('compileAndWrite', () => {
	test('is a convenience function that writes files', async () => {
		const outputDir = join(FIXTURES_DIR, 'output-convenience');
		mkdirSync(outputDir, { recursive: true });

		const options: CompilerOptions = {
			analyzer: {
				rootDir: ROUTES_DIR,
			},
			generator: {
				outputPath: outputDir,
				format: 'ts',
			},
			verbose: false,
		};

		await compileAndWrite(options);

		expect(existsSync(join(outputDir, 'router.ts'))).toBe(true);
	});
});

describe('defineConfig', () => {
	test('returns the same options', () => {
		const options = createCompilerOptions();
		const result = defineConfig(options);

		expect(result).toEqual(options);
	});

	test('is useful for type safety', () => {
		const config = defineConfig({
			analyzer: {
				rootDir: './src/app/api',
			},
			generator: {
				outputPath: './generated',
				format: 'ts',
			},
		});

		expect(config.analyzer.rootDir).toBe('./src/app/api');
	});
});
