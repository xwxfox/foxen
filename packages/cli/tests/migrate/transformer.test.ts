/**
 * Tests for the route transformer
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeNextJsProject, transformAllRoutes } from '../../src/migrate/index.js';

const FIXTURES_DIR = join(__dirname, '../fixtures');
const NEXTJS_APP = join(FIXTURES_DIR, 'nextjs-app');
const OUTPUT_DIR = join(FIXTURES_DIR, 'output-transformer');

describe('transformAllRoutes', () => {
	beforeEach(() => {
		// Clean up output directory before each test
		if (existsSync(OUTPUT_DIR)) {
			rmSync(OUTPUT_DIR, { recursive: true });
		}
		mkdirSync(OUTPUT_DIR, { recursive: true });
	});

	afterEach(() => {
		// Clean up after tests
		if (existsSync(OUTPUT_DIR)) {
			rmSync(OUTPUT_DIR, { recursive: true });
		}
	});

	test('transforms all routes', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const results = await transformAllRoutes(analysis, OUTPUT_DIR);

		expect(results.length).toBeGreaterThanOrEqual(4);

		const successful = results.filter((r) => r.success);
		expect(successful.length).toBe(results.length);
	});

	test('creates route files in output directory', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await transformAllRoutes(analysis, OUTPUT_DIR);

		const routesDir = join(OUTPUT_DIR, 'src/routes');
		expect(existsSync(routesDir)).toBe(true);
		expect(existsSync(join(routesDir, 'index.ts'))).toBe(true);
	});

	test('transforms Next.js imports to Elysia imports', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const results = await transformAllRoutes(analysis, OUTPUT_DIR);

		// Read a transformed file
		const usersRoute = results.find((r) => r.elysiaPath === '/users');
		expect(usersRoute).toBeDefined();
		expect(usersRoute?.outputPath).toBeDefined();

		const content = readFileSync(usersRoute?.outputPath, 'utf-8');

		// Should have Elysia import
		expect(content).toContain('import { Elysia');

		// Should NOT have next/server imports
		expect(content).not.toContain("from 'next/server'");
		expect(content).not.toContain('from "next/server"');
	});

	test('maps navigation helpers to @foxen/navigation', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const results = await transformAllRoutes(analysis, OUTPUT_DIR);

		const sessionRoute = results.find((r) => r.elysiaPath === '/session');
		expect(sessionRoute).toBeDefined();
		expect(sessionRoute?.outputPath).toBeDefined();

		const content = readFileSync(sessionRoute?.outputPath as string, 'utf-8');
		expect(content).toContain('@foxen/navigation');
		expect(content).toContain('headers');
		expect(content).toContain('redirect');
		expect(content).not.toContain('next/navigation');
		expect(content).not.toContain('next/headers');
	});

	test('preserves HTTP methods', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const results = await transformAllRoutes(analysis, OUTPUT_DIR);

		const usersRoute = results.find((r) => r.elysiaPath === '/users');
		expect(usersRoute).toBeDefined();
		expect(usersRoute?.methods).toContain('GET');
		expect(usersRoute?.methods).toContain('POST');
	});

	test('generates index file with all routes', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await transformAllRoutes(analysis, OUTPUT_DIR);

		const indexPath = join(OUTPUT_DIR, 'src/routes/index.ts');
		expect(existsSync(indexPath)).toBe(true);

		const content = readFileSync(indexPath, 'utf-8');
		expect(content).toContain('export const routes');
		expect(content).toContain('.use(');
	});
});
