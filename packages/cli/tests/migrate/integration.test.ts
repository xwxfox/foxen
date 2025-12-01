/**
 * Integration tests for the full migration flow
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
	type ScaffoldOptions,
	analyzeNextJsProject,
	generateDockerFiles,
	generateTestStubs,
	resolveDependencies,
	scaffoldProject,
	transformAllRoutes,
	transformConfig,
} from '../../src/migrate/index.js';

const FIXTURES_DIR = join(__dirname, '../fixtures');
const NEXTJS_APP = join(FIXTURES_DIR, 'nextjs-app');
const OUTPUT_DIR = join(FIXTURES_DIR, 'output-integration');

describe('Full migration flow', () => {
	beforeEach(() => {
		if (existsSync(OUTPUT_DIR)) {
			rmSync(OUTPUT_DIR, { recursive: true });
		}
	});

	afterEach(() => {
		if (existsSync(OUTPUT_DIR)) {
			rmSync(OUTPUT_DIR, { recursive: true });
		}
	});

	test('complete migration creates a valid project', async () => {
		// Step 1: Analyze
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		expect(analysis.routes.length).toBeGreaterThan(0);

		// Step 2: Resolve dependencies
		const deps = resolveDependencies(analysis);
		expect(deps.add.some((d) => d.name === 'elysia')).toBe(true);

		// Step 3: Scaffold
		const scaffoldOptions: Partial<ScaffoldOptions> = {
			projectName: 'test-migration',
			runtime: 'bun',
			createGitignore: true,
			createReadme: true,
			formatter: 'biome',
		};

		const scaffoldResult = await scaffoldProject(analysis, OUTPUT_DIR, scaffoldOptions);
		expect(scaffoldResult.success).toBe(true);

		// Step 4: Transform routes
		const transformedRoutes = await transformAllRoutes(analysis, OUTPUT_DIR);
		const successful = transformedRoutes.filter((r) => r.success);
		expect(successful.length).toBe(analysis.routes.length);

		// Step 5: Transform config
		const configResult = await transformConfig(analysis, OUTPUT_DIR);
		expect(configResult.success).toBe(true);

		// Verify project structure
		expect(existsSync(join(OUTPUT_DIR, 'package.json'))).toBe(true);
		expect(existsSync(join(OUTPUT_DIR, 'tsconfig.json'))).toBe(true);
		expect(existsSync(join(OUTPUT_DIR, 'src/index.ts'))).toBe(true);
		expect(existsSync(join(OUTPUT_DIR, 'src/routes/index.ts'))).toBe(true);
		expect(existsSync(join(OUTPUT_DIR, 'src/middleware/config.ts'))).toBe(true);
	});

	test('migration with tests generates test files', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-migration',
			runtime: 'bun',
		});
		const transformedRoutes = await transformAllRoutes(analysis, OUTPUT_DIR);
		await generateTestStubs(analysis, OUTPUT_DIR, transformedRoutes);

		expect(existsSync(join(OUTPUT_DIR, 'tests/setup.ts'))).toBe(true);
		expect(existsSync(join(OUTPUT_DIR, 'tests/routes'))).toBe(true);
	});

	test('migration with docker generates Docker files', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-migration',
			runtime: 'bun',
		});
		await generateDockerFiles(OUTPUT_DIR, {
			projectName: 'test-migration',
			runtime: 'bun',
		});

		expect(existsSync(join(OUTPUT_DIR, 'Dockerfile'))).toBe(true);
		expect(existsSync(join(OUTPUT_DIR, 'docker-compose.yml'))).toBe(true);
		expect(existsSync(join(OUTPUT_DIR, '.dockerignore'))).toBe(true);
	});

	test('generated package.json has correct scripts', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-migration',
			runtime: 'bun',
		});

		const packageJson = JSON.parse(readFileSync(join(OUTPUT_DIR, 'package.json'), 'utf-8'));

		expect(packageJson.scripts.dev).toBeDefined();
		expect(packageJson.scripts.build).toBeDefined();
		expect(packageJson.scripts.start).toBeDefined();
		expect(packageJson.scripts.test).toBeDefined();
	});

	test('generated routes are syntactically valid TypeScript', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-migration',
			runtime: 'bun',
		});
		await transformAllRoutes(analysis, OUTPUT_DIR);

		// Read and check that the generated route files can be parsed
		const indexPath = join(OUTPUT_DIR, 'src/routes/index.ts');
		const content = readFileSync(indexPath, 'utf-8');

		// Basic syntax checks
		expect(content).toContain('import');
		expect(content).toContain('export');
		expect(content).toContain('Elysia');

		// Should not have syntax errors (balanced braces, etc.)
		const openBraces = (content.match(/{/g) || []).length;
		const closeBraces = (content.match(/}/g) || []).length;
		expect(openBraces).toBe(closeBraces);
	});

	test('migration preserves route structure', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-migration',
			runtime: 'bun',
		});
		const transformedRoutes = await transformAllRoutes(analysis, OUTPUT_DIR);

		// Verify all original routes are transformed
		const originalPaths = analysis.routes.map((r) => r.elysiaPath).sort();
		const transformedPaths = transformedRoutes.map((r) => r.elysiaPath).sort();

		expect(transformedPaths).toEqual(originalPaths);
	});
});
