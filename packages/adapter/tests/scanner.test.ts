import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	convertPathToElysia,
	extractExportedMethods,
	extractHandlerSignatures,
	scanDirectory,
	scanDirectoryStructure,
} from '../src/scanner.js';

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, 'fixtures-scanner');
const ROUTES_DIR = join(FIXTURES_DIR, 'api');

// Setup test fixtures
beforeAll(() => {
	// Create directory structure
	mkdirSync(join(ROUTES_DIR, 'users', '[id]'), { recursive: true });
	mkdirSync(join(ROUTES_DIR, 'docs', '[...slug]'), { recursive: true });
	mkdirSync(join(ROUTES_DIR, 'products', '[[...categories]]'), { recursive: true });
	mkdirSync(join(ROUTES_DIR, 'health'), { recursive: true });

	// Users route
	writeFileSync(
		join(ROUTES_DIR, 'users', 'route.ts'),
		`
export async function GET(request) {
    return Response.json({ users: [] });
}

export async function POST(request) {
    return Response.json({ created: true });
}
`,
	);

	// User by ID route
	writeFileSync(
		join(ROUTES_DIR, 'users', '[id]', 'route.ts'),
		`
export async function GET(request, { params }) {
    return Response.json({ id: params.id });
}

export async function DELETE(request) {
    return new Response(null, { status: 204 });
}
`,
	);

	// Docs catch-all route
	writeFileSync(
		join(ROUTES_DIR, 'docs', '[...slug]', 'route.ts'),
		`
export function GET(request, context) {
    return new Response("docs");
}
`,
	);

	// Products optional catch-all route
	writeFileSync(
		join(ROUTES_DIR, 'products', '[[...categories]]', 'route.ts'),
		`
export const GET = async () => {
    return new Response("products");
};
`,
	);

	// Health route
	writeFileSync(
		join(ROUTES_DIR, 'health', 'route.ts'),
		`
export function GET() {
    return Response.json({ status: "ok" });
}

export function HEAD() {
    return new Response(null);
}
`,
	);
});

// Cleanup test fixtures
afterAll(() => {
	rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('convertPathToElysia', () => {
	test('converts simple path', () => {
		const result = convertPathToElysia('/users');

		expect(result.elysiaPath).toBe('/users');
		expect(result.params).toHaveLength(0);
	});

	test('converts dynamic segment [id] to :id', () => {
		const result = convertPathToElysia('/users/[id]');

		expect(result.elysiaPath).toBe('/users/:id');
		expect(result.params).toHaveLength(1);
		expect(result.params[0]?.name).toBe('id');
		expect(result.params[0]?.isCatchAll).toBe(false);
	});

	test('converts multiple dynamic segments', () => {
		const result = convertPathToElysia('/users/[userId]/posts/[postId]');

		expect(result.elysiaPath).toBe('/users/:userId/posts/:postId');
		expect(result.params).toHaveLength(2);
		expect(result.params[0]?.name).toBe('userId');
		expect(result.params[1]?.name).toBe('postId');
	});

	test('converts catch-all [...slug] to *', () => {
		const result = convertPathToElysia('/docs/[...slug]');

		expect(result.elysiaPath).toBe('/docs/*');
		expect(result.params).toHaveLength(1);
		expect(result.params[0]?.name).toBe('slug');
		expect(result.params[0]?.isCatchAll).toBe(true);
		expect(result.params[0]?.isOptional).toBe(false);
	});

	test('converts optional catch-all [[...slug]] to *', () => {
		const result = convertPathToElysia('/products/[[...categories]]');

		expect(result.elysiaPath).toBe('/products/*');
		expect(result.params).toHaveLength(1);
		expect(result.params[0]?.name).toBe('categories');
		expect(result.params[0]?.isCatchAll).toBe(true);
		expect(result.params[0]?.isOptional).toBe(true);
	});

	test('handles root path', () => {
		const result = convertPathToElysia('/');

		expect(result.elysiaPath).toBe('/');
		expect(result.params).toHaveLength(0);
	});

	test('handles complex nested paths', () => {
		const result = convertPathToElysia('/api/v1/[org]/[repo]/issues/[id]');

		expect(result.elysiaPath).toBe('/api/v1/:org/:repo/issues/:id');
		expect(result.params).toHaveLength(3);
	});
});

describe('extractExportedMethods', () => {
	test('extracts GET and POST methods', async () => {
		const filePath = join(ROUTES_DIR, 'users', 'route.ts');
		const methods = await extractExportedMethods(filePath);

		expect(methods).toContain('GET');
		expect(methods).toContain('POST');
		expect(methods).not.toContain('DELETE');
	});

	test('extracts GET and DELETE methods', async () => {
		const filePath = join(ROUTES_DIR, 'users', '[id]', 'route.ts');
		const methods = await extractExportedMethods(filePath);

		expect(methods).toContain('GET');
		expect(methods).toContain('DELETE');
	});

	test('extracts methods from arrow function exports', async () => {
		const filePath = join(ROUTES_DIR, 'products', '[[...categories]]', 'route.ts');
		const methods = await extractExportedMethods(filePath);

		expect(methods).toContain('GET');
	});

	test('extracts GET and HEAD methods', async () => {
		const filePath = join(ROUTES_DIR, 'health', 'route.ts');
		const methods = await extractExportedMethods(filePath);

		expect(methods).toContain('GET');
		expect(methods).toContain('HEAD');
	});

	test('returns empty array for non-existent file', async () => {
		const methods = await extractExportedMethods('/nonexistent/route.ts');

		expect(methods).toEqual([]);
	});
});

describe('extractHandlerSignatures', () => {
	test('extracts signature with request and context params', async () => {
		const filePath = join(ROUTES_DIR, 'users', '[id]', 'route.ts');
		const signatures = await extractHandlerSignatures(filePath);

		const getSignature = signatures.get('GET');
		expect(getSignature).toBeDefined();
		expect(getSignature?.argCount).toBe(2);
		expect(getSignature?.hasParams).toBe(true);
	});

	test('extracts signature with no params', async () => {
		const filePath = join(ROUTES_DIR, 'health', 'route.ts');
		const signatures = await extractHandlerSignatures(filePath);

		const getSignature = signatures.get('GET');
		expect(getSignature).toBeDefined();
		expect(getSignature?.argCount).toBe(0);
	});

	test('extracts signature with single param', async () => {
		const filePath = join(ROUTES_DIR, 'users', '[id]', 'route.ts');
		const signatures = await extractHandlerSignatures(filePath);

		const deleteSignature = signatures.get('DELETE');
		expect(deleteSignature).toBeDefined();
		expect(deleteSignature?.argCount).toBe(1);
	});

	test('returns empty map for non-existent file', async () => {
		const signatures = await extractHandlerSignatures('/nonexistent/route.ts');

		expect(signatures.size).toBe(0);
	});
});

describe('scanDirectory', () => {
	test('finds all route files', async () => {
		const routes = await scanDirectory(ROUTES_DIR);

		expect(routes.length).toBe(5);
	});

	test('extracts correct paths', async () => {
		const routes = await scanDirectory(ROUTES_DIR);
		const paths = routes.map((r) => r.elysiaPath);

		expect(paths).toContain('/users');
		expect(paths).toContain('/users/:id');
		expect(paths).toContain('/health');
	});

	test('detects methods for each route', async () => {
		const routes = await scanDirectory(ROUTES_DIR);

		const usersRoute = routes.find((r) => r.elysiaPath === '/users');
		expect(usersRoute?.methods).toContain('GET');
		expect(usersRoute?.methods).toContain('POST');
	});

	test('extracts params info', async () => {
		const routes = await scanDirectory(ROUTES_DIR);

		const userByIdRoute = routes.find((r) => r.elysiaPath === '/users/:id');
		expect(userByIdRoute?.params).toHaveLength(1);
		expect(userByIdRoute?.params[0]?.name).toBe('id');
	});

	test('detects catch-all routes', async () => {
		const routes = await scanDirectory(ROUTES_DIR);

		const docsRoute = routes.find((r) => r.elysiaPath.includes('docs'));
		expect(docsRoute?.isCatchAll).toBe(true);
	});

	test('detects optional catch-all routes', async () => {
		const routes = await scanDirectory(ROUTES_DIR);

		const productsRoute = routes.find((r) => r.elysiaPath.includes('products'));
		expect(productsRoute?.isOptionalCatchAll).toBe(true);
	});

	test('includes file path', async () => {
		const routes = await scanDirectory(ROUTES_DIR);

		for (const route of routes) {
			expect(route.filePath).toContain('route.ts');
		}
	});
});

describe('scanDirectoryStructure', () => {
	test('scans without loading modules', async () => {
		const routes = await scanDirectoryStructure(ROUTES_DIR);

		expect(routes.length).toBe(5);
	});

	test('includes relative path', async () => {
		const routes = await scanDirectoryStructure(ROUTES_DIR);

		for (const route of routes) {
			expect(route.relativePath).toBeDefined();
			expect(route.relativePath).toContain('route.ts');
		}
	});

	test('includes next path', async () => {
		const routes = await scanDirectoryStructure(ROUTES_DIR);

		const usersRoute = routes.find((r) => r.elysiaPath === '/users');
		expect(usersRoute?.nextPath).toBe('/users');
	});

	test('handles empty directory', async () => {
		const emptyDir = join(FIXTURES_DIR, 'empty');
		mkdirSync(emptyDir, { recursive: true });

		const routes = await scanDirectoryStructure(emptyDir);

		expect(routes).toEqual([]);
	});

	test('handles non-existent directory gracefully', async () => {
		const routes = await scanDirectoryStructure('/nonexistent/path');

		expect(routes).toEqual([]);
	});
});
