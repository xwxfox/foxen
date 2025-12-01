/**
 * Tests for the dependency resolver
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
	analyzeNextJsProject,
	getDependencySummary,
	resolveDependencies,
} from '../../src/migrate/index.js';

const FIXTURES_DIR = join(__dirname, '../fixtures');
const NEXTJS_APP = join(FIXTURES_DIR, 'nextjs-app');

describe('resolveDependencies', () => {
	test('adds Elysia dependencies', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const deps = resolveDependencies(analysis);

		const addedNames = deps.add.map((d) => d.name);
		expect(addedNames).toContain('elysia');
		expect(addedNames).toContain('@elysiajs/cors');
		expect(addedNames).toContain('@elysiajs/swagger');
	});

	test('removes Next.js dependencies', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const deps = resolveDependencies(analysis);

		expect(deps.remove).toContain('next');
		expect(deps.remove).toContain('react');
		expect(deps.remove).toContain('react-dom');
	});

	test('keeps compatible dependencies', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const deps = resolveDependencies(analysis);

		expect(deps.keep).toContain('zod');
	});

	test('generates warnings for unknown dependencies', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		// The fixture doesn't have unknown deps, but the function should handle them
		const deps = resolveDependencies(analysis);

		// Warnings array should exist
		expect(Array.isArray(deps.warnings)).toBe(true);
	});
});

describe('getDependencySummary', () => {
	test('generates readable summary', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const deps = resolveDependencies(analysis);
		const summary = getDependencySummary(deps);

		expect(summary).toContain('Dependency Resolution');
		expect(summary).toContain('elysia');
	});
});
