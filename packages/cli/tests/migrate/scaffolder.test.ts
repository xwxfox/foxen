/**
 * Tests for the project scaffolder
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeNextJsProject, scaffoldProject } from '../../src/migrate/index.js';

const FIXTURES_DIR = join(__dirname, '../fixtures');
const NEXTJS_APP = join(FIXTURES_DIR, 'nextjs-app');
const OUTPUT_DIR = join(FIXTURES_DIR, 'output-scaffolder');

describe('scaffoldProject', () => {
	beforeEach(() => {
		// Clean up output directory before each test
		if (existsSync(OUTPUT_DIR)) {
			rmSync(OUTPUT_DIR, { recursive: true });
		}
	});

	afterEach(() => {
		// Clean up after tests
		if (existsSync(OUTPUT_DIR)) {
			rmSync(OUTPUT_DIR, { recursive: true });
		}
	});

	test('creates project directory structure', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-project',
			runtime: 'bun',
		});

		expect(existsSync(OUTPUT_DIR)).toBe(true);
		expect(existsSync(join(OUTPUT_DIR, 'src'))).toBe(true);
		expect(existsSync(join(OUTPUT_DIR, 'src/routes'))).toBe(true);
		expect(existsSync(join(OUTPUT_DIR, 'src/middleware'))).toBe(true);
	});

	test('creates package.json with correct dependencies', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-project',
			runtime: 'bun',
		});

		const packageJsonPath = join(OUTPUT_DIR, 'package.json');
		expect(existsSync(packageJsonPath)).toBe(true);

		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
		expect(packageJson.name).toBe('test-project');
		expect(packageJson.dependencies.elysia).toBeDefined();
		expect(packageJson.devDependencies['@types/bun']).toBeDefined();
	});

	test('creates tsconfig.json', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-project',
			runtime: 'bun',
		});

		const tsconfigPath = join(OUTPUT_DIR, 'tsconfig.json');
		expect(existsSync(tsconfigPath)).toBe(true);

		const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
		expect(tsconfig.compilerOptions.target).toBe('ESNext');
		expect(tsconfig.compilerOptions.module).toBe('ESNext');
	});

	test('creates main entry point', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-project',
			runtime: 'bun',
		});

		const indexPath = join(OUTPUT_DIR, 'src/index.ts');
		expect(existsSync(indexPath)).toBe(true);

		const content = readFileSync(indexPath, 'utf-8');
		expect(content).toContain('Elysia');
		expect(content).toContain('.listen(');
	});

	test('creates biome config when specified', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-project',
			runtime: 'bun',
			formatter: 'biome',
		});

		const biomePath = join(OUTPUT_DIR, 'biome.json');
		expect(existsSync(biomePath)).toBe(true);
	});

	test('creates .gitignore when requested', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-project',
			runtime: 'bun',
			createGitignore: true,
		});

		const gitignorePath = join(OUTPUT_DIR, '.gitignore');
		expect(existsSync(gitignorePath)).toBe(true);

		const content = readFileSync(gitignorePath, 'utf-8');
		expect(content).toContain('node_modules');
		expect(content).toContain('dist');
	});

	test('creates README when requested', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-project',
			runtime: 'bun',
			createReadme: true,
		});

		const readmePath = join(OUTPUT_DIR, 'README.md');
		expect(existsSync(readmePath)).toBe(true);

		const content = readFileSync(readmePath, 'utf-8');
		expect(content).toContain('Elysia');
		expect(content).toContain('bun');
	});

	test('uses node runtime when specified', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await scaffoldProject(analysis, OUTPUT_DIR, {
			projectName: 'test-project',
			runtime: 'node',
		});

		const packageJson = JSON.parse(readFileSync(join(OUTPUT_DIR, 'package.json'), 'utf-8'));

		expect(packageJson.scripts.dev).toContain('tsx');
		expect(packageJson.devDependencies.tsx).toBeDefined();
	});
});
