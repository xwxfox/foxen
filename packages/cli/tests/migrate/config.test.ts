/**
 * Tests for config transformation
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
	analyzeNextJsProject,
	generatePlaceholderConfig,
	transformConfig,
} from '../../src/migrate/index.js';

const FIXTURES_DIR = join(__dirname, '../fixtures');
const NEXTJS_APP = join(FIXTURES_DIR, 'nextjs-app');
const OUTPUT_DIR = join(FIXTURES_DIR, 'output-config');

describe('transformConfig', () => {
	beforeEach(() => {
		if (existsSync(OUTPUT_DIR)) {
			rmSync(OUTPUT_DIR, { recursive: true });
		}
		mkdirSync(join(OUTPUT_DIR, 'src/middleware'), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(OUTPUT_DIR)) {
			rmSync(OUTPUT_DIR, { recursive: true });
		}
	});

	test('extracts redirects from next.config', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const result = await transformConfig(analysis, OUTPUT_DIR);

		expect(result.success).toBe(true);
		expect(result.hasRedirects).toBe(true);
	});

	test('extracts rewrites from next.config', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const result = await transformConfig(analysis, OUTPUT_DIR);

		expect(result.success).toBe(true);
		expect(result.hasRewrites).toBe(true);
	});

	test('extracts headers from next.config', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const result = await transformConfig(analysis, OUTPUT_DIR);

		expect(result.success).toBe(true);
		expect(result.hasHeaders).toBe(true);
	});

	test('generates middleware file', async () => {
		const analysis = await analyzeNextJsProject(NEXTJS_APP);
		const result = await transformConfig(analysis, OUTPUT_DIR);

		expect(result.outputPath).toBeDefined();
		if (result.outputPath) {
			expect(existsSync(result.outputPath)).toBe(true);

			const content = readFileSync(result.outputPath, 'utf-8');
			expect(content).toContain('configMiddleware');
			expect(content).toContain('Elysia');
		}
	});
});

describe('generatePlaceholderConfig', () => {
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

	test('creates placeholder config file', async () => {
		await generatePlaceholderConfig(OUTPUT_DIR);

		const configPath = join(OUTPUT_DIR, 'src/middleware/config.ts');
		expect(existsSync(configPath)).toBe(true);

		const content = readFileSync(configPath, 'utf-8');
		expect(content).toContain('configMiddleware');
		expect(content).toContain('Elysia');
	});
});
