import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Elysia } from 'elysia';
import { appRouter, createApp } from '../src/plugin.js';

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, 'fixtures-plugin');
const API_DIR = join(FIXTURES_DIR, 'api');

// Setup test fixtures
beforeAll(() => {
	mkdirSync(join(API_DIR, 'users', '[id]'), { recursive: true });
	mkdirSync(join(API_DIR, 'health'), { recursive: true });

	// Users list route
	writeFileSync(
		join(API_DIR, 'users', 'route.ts'),
		`
export async function GET() {
    return Response.json({ users: [{ id: "1", name: "Test" }] });
}

export async function POST(request) {
    const body = await request.json();
    return Response.json({ created: true, name: body.name });
}
`,
	);

	// User by ID route
	writeFileSync(
		join(API_DIR, 'users', '[id]', 'route.ts'),
		`
export async function GET(request, { params }) {
    const { id } = await params;
    return Response.json({ id, name: "User " + id });
}

export async function DELETE() {
    return new Response(null, { status: 204 });
}
`,
	);

	// Health route
	writeFileSync(
		join(API_DIR, 'health', 'route.ts'),
		`
export function GET() {
    return Response.json({ status: "ok", timestamp: new Date().toISOString() });
}
`,
	);
});

// Cleanup test fixtures
afterAll(() => {
	rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('appRouter', () => {
	test('creates Elysia plugin', async () => {
		const plugin = await appRouter({
			apiDir: API_DIR,
			verbose: false,
		});

		expect(plugin).toBeInstanceOf(Elysia);
	});

	test('registers routes from directory', async () => {
		const plugin = await appRouter({
			apiDir: API_DIR,
			verbose: false,
		});

		const app = new Elysia().use(plugin);

		// Check GET /users
		const usersResponse = await app.handle(new Request('http://localhost/users'));
		expect(usersResponse.status).toBe(200);
		const usersData = await usersResponse.json();
		expect(usersData.users).toBeDefined();
	});

	test('handles dynamic routes', async () => {
		const plugin = await appRouter({
			apiDir: API_DIR,
			verbose: false,
		});

		const app = new Elysia().use(plugin);

		const response = await app.handle(new Request('http://localhost/users/123'));
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.id).toBe('123');
	});

	test('handles POST requests', async () => {
		const plugin = await appRouter({
			apiDir: API_DIR,
			verbose: false,
		});

		const app = new Elysia().use(plugin);

		const response = await app.handle(
			new Request('http://localhost/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'New User' }),
			}),
		);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.created).toBe(true);
	});

	test('handles DELETE requests', async () => {
		const plugin = await appRouter({
			apiDir: API_DIR,
			verbose: false,
		});

		const app = new Elysia().use(plugin);

		const response = await app.handle(
			new Request('http://localhost/users/123', {
				method: 'DELETE',
			}),
		);

		expect(response.status).toBe(204);
	});

	test('applies basePath', async () => {
		const plugin = await appRouter({
			apiDir: API_DIR,
			basePath: '/api/v1',
			verbose: false,
		});

		const app = new Elysia().use(plugin);

		const response = await app.handle(new Request('http://localhost/api/v1/health'));

		expect(response.status).toBe(200);
	});

	test('strips api prefix when configured', async () => {
		// Create a route that already has /api prefix in its path
		const apiPrefixDir = join(FIXTURES_DIR, 'with-api');
		mkdirSync(join(apiPrefixDir, 'api', 'ping'), { recursive: true });

		writeFileSync(
			join(apiPrefixDir, 'api', 'ping', 'route.ts'),
			'export function GET() { return Response.json({ pong: true }); }',
		);

		const plugin = await appRouter({
			apiDir: join(apiPrefixDir, 'api'),
			stripApiPrefix: true,
			verbose: false,
		});

		expect(plugin).toBeInstanceOf(Elysia);
	});
});

describe('createApp', () => {
	test('creates standalone Elysia app', async () => {
		const app = await createApp({
			apiDir: API_DIR,
			verbose: false,
		});

		expect(app).toBeInstanceOf(Elysia);
	});

	test('app handles requests', async () => {
		const app = await createApp({
			apiDir: API_DIR,
			verbose: false,
		});

		const response = await app.handle(new Request('http://localhost/health'));

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.status).toBe('ok');
	});

	test('inherits all plugin features', async () => {
		const app = await createApp({
			apiDir: API_DIR,
			basePath: '/api',
			verbose: false,
		});

		const response = await app.handle(new Request('http://localhost/api/users'));

		expect(response.status).toBe(200);
	});
});

describe('route registration', () => {
	test('returns 404 for non-existent routes', async () => {
		const plugin = await appRouter({
			apiDir: API_DIR,
			verbose: false,
		});

		const app = new Elysia().use(plugin);

		const response = await app.handle(new Request('http://localhost/nonexistent'));

		expect(response.status).toBe(404);
	});

	test('returns 404 for wrong method', async () => {
		const plugin = await appRouter({
			apiDir: API_DIR,
			verbose: false,
		});

		const app = new Elysia().use(plugin);

		const response = await app.handle(new Request('http://localhost/health', { method: 'PUT' }));

		expect(response.status).toBe(404);
	});
});

describe('error handling', () => {
	test('handles route with error gracefully', async () => {
		// Create a route that throws
		const errorDir = join(FIXTURES_DIR, 'error-routes');
		mkdirSync(join(errorDir, 'error'), { recursive: true });

		writeFileSync(
			join(errorDir, 'error', 'route.ts'),
			`export function GET() { throw new Error("Test error"); }`,
		);

		const plugin = await appRouter({
			apiDir: errorDir,
			verbose: false,
		});

		const app = new Elysia().use(plugin);

		const response = await app.handle(new Request('http://localhost/error'));

		// Should return 500
		expect(response.status).toBe(500);
	});
});
