/**
 * Tests for Docker file generation
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { generateDockerFiles } from '../../src/migrate/index.js';

const FIXTURES_DIR = join(__dirname, '../fixtures');
const OUTPUT_DIR = join(FIXTURES_DIR, 'output-docker');

describe('generateDockerFiles', () => {
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

	test('creates all Docker files', async () => {
		const files = await generateDockerFiles(OUTPUT_DIR, {
			projectName: 'test-app',
			runtime: 'bun',
		});

		expect(files.length).toBe(3);
		expect(existsSync(join(OUTPUT_DIR, 'Dockerfile'))).toBe(true);
		expect(existsSync(join(OUTPUT_DIR, 'docker-compose.yml'))).toBe(true);
		expect(existsSync(join(OUTPUT_DIR, '.dockerignore'))).toBe(true);
	});

	test('generates Bun Dockerfile when runtime is bun', async () => {
		await generateDockerFiles(OUTPUT_DIR, {
			projectName: 'test-app',
			runtime: 'bun',
		});

		const content = readFileSync(join(OUTPUT_DIR, 'Dockerfile'), 'utf-8');
		expect(content).toContain('oven/bun');
		expect(content).toContain('bun install');
	});

	test('generates Node Dockerfile when runtime is node', async () => {
		await generateDockerFiles(OUTPUT_DIR, {
			projectName: 'test-app',
			runtime: 'node',
		});

		const content = readFileSync(join(OUTPUT_DIR, 'Dockerfile'), 'utf-8');
		expect(content).toContain('node:');
		expect(content).toContain('npm ci');
	});

	test('generates docker-compose with service name', async () => {
		await generateDockerFiles(OUTPUT_DIR, {
			projectName: 'my-api',
			runtime: 'bun',
		});

		const content = readFileSync(join(OUTPUT_DIR, 'docker-compose.yml'), 'utf-8');
		expect(content).toContain('services:');
		expect(content).toContain('3000:3000');
	});

	test('generates .dockerignore with appropriate entries', async () => {
		await generateDockerFiles(OUTPUT_DIR, {
			projectName: 'test-app',
			runtime: 'bun',
		});

		const content = readFileSync(join(OUTPUT_DIR, '.dockerignore'), 'utf-8');
		expect(content).toContain('node_modules');
		expect(content).toContain('dist');
		expect(content).toContain('.env');
		expect(content).toContain('tests/');
	});
});
