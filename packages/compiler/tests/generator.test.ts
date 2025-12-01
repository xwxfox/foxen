import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeRoutes } from '../src/analyzer.js';
import { CodeGenerator, generateAndWrite, generateCode } from '../src/generator.js';
import type { AnalysisResult } from '../src/types.js';

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, 'fixtures-generator');
const ROUTES_DIR = join(FIXTURES_DIR, 'routes');
const OUTPUT_DIR = join(FIXTURES_DIR, 'output');

// Setup test fixtures
beforeAll(() => {
	mkdirSync(join(ROUTES_DIR, 'users', '[id]'), { recursive: true });
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

export async function POST(request: NextRequest) {
    return NextResponse.json({ created: true });
}
`,
	);

	// Dynamic route
	writeFileSync(
		join(ROUTES_DIR, 'users', '[id]', 'route.ts'),
		`
import { NextRequest, NextResponse } from '@foxen/core';

export async function GET(request: NextRequest) {
    return NextResponse.json({ id: "123" });
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

describe('CodeGenerator', () => {
	let analysis: AnalysisResult;

	beforeAll(async () => {
		analysis = await analyzeRoutes({ rootDir: ROUTES_DIR });
	});

	describe('constructor', () => {
		test('creates generator with default options', () => {
			const generator = new CodeGenerator();
			expect(generator).toBeDefined();
		});

		test('accepts custom options', () => {
			const generator = new CodeGenerator({
				format: 'js',
				basePath: '/api',
			});
			expect(generator).toBeDefined();
		});
	});

	describe('generate', () => {
		test('generates router code', async () => {
			const generator = new CodeGenerator();
			const output = await generator.generate(analysis);

			expect(output.routerCode).toBeDefined();
			expect(output.routerCode.length).toBeGreaterThan(0);
		});

		test('includes header comment', async () => {
			const generator = new CodeGenerator({
				header: '// Custom header',
			});
			const output = await generator.generate(analysis);

			expect(output.routerCode).toContain('// Custom header');
		});

		test('imports Elysia', async () => {
			const generator = new CodeGenerator();
			const output = await generator.generate(analysis);

			expect(output.routerCode).toContain('import { Elysia }');
		});

		test('imports foxen core', async () => {
			const generator = new CodeGenerator();
			const output = await generator.generate(analysis);

			expect(output.routerCode).toContain('@foxen/core');
		});

		test('imports foxen adapter', async () => {
			const generator = new CodeGenerator();
			const output = await generator.generate(analysis);

			expect(output.routerCode).toContain('@foxen/adapter');
		});

		test('creates router factory function', async () => {
			const generator = new CodeGenerator();
			const output = await generator.generate(analysis);

			expect(output.routerCode).toContain('function createRouter');
			expect(output.routerCode).toContain('export');
		});

		test('exports standalone router', async () => {
			const generator = new CodeGenerator();
			const output = await generator.generate(analysis);

			expect(output.routerCode).toContain('export const router');
		});

		test('generates route imports', async () => {
			const generator = new CodeGenerator();
			const output = await generator.generate(analysis);

			expect(output.routerCode).toContain('// Route handlers');
		});

		test('handles dynamic routes', async () => {
			const generator = new CodeGenerator();
			const output = await generator.generate(analysis);

			// Should have route with :id pattern
			expect(output.routerCode).toContain(':id');
		});
	});

	describe('output files', () => {
		test('generates router file', async () => {
			const generator = new CodeGenerator({ format: 'ts' });
			const output = await generator.generate(analysis);

			const routerFile = output.files.find((f) => f.type === 'router');
			expect(routerFile).toBeDefined();
			expect(routerFile?.path).toBe('router.ts');
		});

		test('generates barrel export when enabled', async () => {
			const generator = new CodeGenerator({ generateBarrel: true });
			const output = await generator.generate(analysis);

			const barrelFile = output.files.find((f) => f.type === 'barrel');
			expect(barrelFile).toBeDefined();
			expect(barrelFile?.path).toBe('index.ts');
		});

		test('skips barrel export when disabled', async () => {
			const generator = new CodeGenerator({ generateBarrel: false });
			const output = await generator.generate(analysis);

			const barrelFile = output.files.find((f) => f.type === 'barrel');
			expect(barrelFile).toBeUndefined();
		});

		test('generates type definitions for JS output', async () => {
			const generator = new CodeGenerator({ format: 'js' });
			const output = await generator.generate(analysis);

			const typesFile = output.files.find((f) => f.type === 'types');
			expect(typesFile).toBeDefined();
			expect(typesFile?.path).toBe('router.d.ts');
		});

		test('skips type definitions for TS output', async () => {
			const generator = new CodeGenerator({ format: 'ts' });
			const output = await generator.generate(analysis);

			expect(output.typeDefinitions).toBeUndefined();
		});
	});

	describe('options', () => {
		test('uses custom base path', async () => {
			const generator = new CodeGenerator({ basePath: '/v1/api' });
			const output = await generator.generate(analysis);

			expect(output.routerCode).toContain('/v1/api');
		});

		test('uses custom instance name', async () => {
			const generator = new CodeGenerator({ elysiaInstanceName: 'server' });
			const output = await generator.generate(analysis);

			expect(output.routerCode).toContain('server');
		});

		test('uses custom routes alias', async () => {
			const generator = new CodeGenerator({ routesAlias: '@/routes' });
			const output = await generator.generate(analysis);

			expect(output.routerCode).toContain('@/routes');
		});
	});

	describe('transformers', () => {
		test('allows adding custom transformers', async () => {
			const generator = new CodeGenerator();
			generator.addTransformer((_ctx) => '// Custom transform');

			expect(generator).toBeDefined();
		});
	});
});

describe('generateCode', () => {
	let analysis: AnalysisResult;

	beforeAll(async () => {
		analysis = await analyzeRoutes({ rootDir: ROUTES_DIR });
	});

	test('is a convenience function', async () => {
		const output = await generateCode(analysis);

		expect(output.routerCode).toBeDefined();
		expect(output.files.length).toBeGreaterThan(0);
	});

	test('accepts options', async () => {
		const output = await generateCode(analysis, { basePath: '/custom' });

		expect(output.routerCode).toContain('/custom');
	});
});

describe('generateAndWrite', () => {
	let analysis: AnalysisResult;

	beforeAll(async () => {
		analysis = await analyzeRoutes({ rootDir: ROUTES_DIR });
	});

	test('writes files to disk', async () => {
		await generateAndWrite(analysis, { outputPath: OUTPUT_DIR });

		const routerFile = Bun.file(join(OUTPUT_DIR, 'router.ts'));
		expect(await routerFile.exists()).toBe(true);
	});

	test('writes barrel export', async () => {
		await generateAndWrite(analysis, {
			outputPath: OUTPUT_DIR,
			generateBarrel: true,
		});

		const indexFile = Bun.file(join(OUTPUT_DIR, 'index.ts'));
		expect(await indexFile.exists()).toBe(true);
	});
});
