/**
 * Tests for the Next.js project analyzer
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { analyzeNextJsProject, getProjectSummary } from '../../src/migrate/analyzer.js';

const FIXTURES_DIR = join(__dirname, '../fixtures');
const NEXTJS_APP = join(FIXTURES_DIR, 'nextjs-app');

describe('analyzeNextJsProject', () => {
	test('detects project structure correctly', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);

		expect(analysis.root).toBe(NEXTJS_APP);
		expect(analysis.name).toBe('test-nextjs-app');
		expect(analysis.version).toBe('0.1.0');
	});

	test('finds routes directory', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);

		expect(analysis.routesDir).toBe('src/app/api');
	});

	test('detects middleware', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);

		expect(analysis.hasMiddleware).toBe(true);
		expect(analysis.middlewarePath).toBe('middleware.ts');
	});

	test('detects next.config', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);

		expect(analysis.hasNextConfig).toBe(true);
		expect(analysis.nextConfigPath).toBe('next.config.js');
	});

	test('detects config features', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);

		expect(analysis.usesRedirects).toBe(true);
		expect(analysis.usesRewrites).toBe(true);
		expect(analysis.usesHeaders).toBe(true);
	});

	test('finds all API routes', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);

		expect(analysis.routes.length).toBeGreaterThanOrEqual(4);

		const paths = analysis.routes.map((r) => r.elysiaPath);
		expect(paths).toContain('/users');
		expect(paths).toContain('/users/:id');
		expect(paths).toContain('/health');
	});

	test('extracts route handlers correctly', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);

		const usersRoute = analysis.routes.find((r) => r.elysiaPath === '/users');
		expect(usersRoute).toBeDefined();
		expect(usersRoute?.handlers.length).toBe(2);

		const methods = usersRoute?.handlers.map((h) => h.method);
		expect(methods).toContain('GET');
		expect(methods).toContain('POST');
	});

	test('extracts dynamic route params', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);

		const userByIdRoute = analysis.routes.find((r) => r.elysiaPath === '/users/:id');
		expect(userByIdRoute).toBeDefined();
		expect(userByIdRoute?.pathParams).toContain('id');
	});

	test('detects catch-all routes', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);

		const docsRoute = analysis.routes.find((r) => r.elysiaPath.includes('docs'));
		expect(docsRoute).toBeDefined();
		expect(docsRoute?.isCatchAll).toBe(true);
	});

	test('extracts dependencies', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);

		expect(analysis.dependencies).toContain('next');
		expect(analysis.dependencies).toContain('zod');
	});
});

describe('getProjectSummary', () => {
	test('generates readable summary', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const summary = getProjectSummary(analysis);

		expect(summary).toContain('test-nextjs-app');
		expect(summary).toContain('src/app/api');
		expect(summary).toContain('middleware.ts');
	});
});
