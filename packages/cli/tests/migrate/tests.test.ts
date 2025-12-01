/**
 * Tests for test stub generation
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeNextJsProject, generateTestStubs } from '../../src/migrate/index.js';

const FIXTURES_DIR = join(__dirname, '../fixtures');
const NEXTJS_APP = join(FIXTURES_DIR, 'nextjs-app');
const OUTPUT_DIR = join(FIXTURES_DIR, 'output-tests');

describe('generateTestStubs', () => {
	beforeEach(() => {
		if (existsSync(OUTPUT_DIR)) {
			rmSync(OUTPUT_DIR, { recursive: true });
		}
		mkdirSync(OUTPUT_DIR, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(OUTPUT_DIR)) {
			rmSync(OUTPUT_DIR, { recursive: true });
		}
	});

	test('creates test directory structure', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await generateTestStubs(analysis, OUTPUT_DIR);

		const testsDir = join(OUTPUT_DIR, 'tests');
		expect(existsSync(testsDir)).toBe(true);
		expect(existsSync(join(testsDir, 'routes'))).toBe(true);
	});

	test('generates test files for route groups', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const files = await generateTestStubs(analysis, OUTPUT_DIR);

		expect(files.length).toBeGreaterThan(0);

		// Should have at least one test file for users routes
		const usersTestPath = join(OUTPUT_DIR, 'tests/routes/users.test.ts');
		expect(existsSync(usersTestPath)).toBe(true);
	});

	test('generated test files have correct imports', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await generateTestStubs(analysis, OUTPUT_DIR);

		const usersTestPath = join(OUTPUT_DIR, 'tests/routes/users.test.ts');
		const content = readFileSync(usersTestPath, 'utf-8');

		expect(content).toContain('from "bun:test"');
		expect(content).toContain('describe');
		expect(content).toContain('test');
		expect(content).toContain('expect');
	});

	test('generates setup file', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await generateTestStubs(analysis, OUTPUT_DIR);

		const setupPath = join(OUTPUT_DIR, 'tests/setup.ts');
		expect(existsSync(setupPath)).toBe(true);

		const content = readFileSync(setupPath, 'utf-8');
		expect(content).toContain('beforeAll');
		expect(content).toContain('afterAll');
	});

	test('includes test cases for each HTTP method', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		await generateTestStubs(analysis, OUTPUT_DIR);

		const usersTestPath = join(OUTPUT_DIR, 'tests/routes/users.test.ts');
		const content = readFileSync(usersTestPath, 'utf-8');

		// Should have GET and POST test cases for /users
		expect(content).toContain('GET /users');
		expect(content).toContain('POST /users');
	});
});
