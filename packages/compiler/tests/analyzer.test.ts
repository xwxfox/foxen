import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RouteAnalyzer, analyzeFile, analyzeRoutes } from '../src/analyzer.js';
import type { AnalysisResult } from '../src/types.js';

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, 'fixtures');
const ROUTES_DIR = join(FIXTURES_DIR, 'routes');

// Setup test fixtures
beforeAll(() => {
	mkdirSync(join(ROUTES_DIR, 'users', '[id]'), { recursive: true });
	mkdirSync(join(ROUTES_DIR, 'docs', '[...slug]'), { recursive: true });
	mkdirSync(join(ROUTES_DIR, 'products', '[[...categories]]'), { recursive: true });
	mkdirSync(join(ROUTES_DIR, '(auth)', 'login'), { recursive: true });
	mkdirSync(join(ROUTES_DIR, 'health'), { recursive: true });

	// Basic route with GET and POST
	writeFileSync(
		join(ROUTES_DIR, 'users', 'route.ts'),
		`
import { NextRequest, NextResponse } from '@foxen/core';

export async function GET(request: NextRequest) {
    return NextResponse.json({ users: [] });
}

export async function POST(request: NextRequest) {
    return NextResponse.json({ created: true });
}

export const dynamic = 'force-dynamic';
`,
	);

	// Dynamic route with params
	writeFileSync(
		join(ROUTES_DIR, 'users', '[id]', 'route.ts'),
		`
import { NextRequest, NextResponse } from '@foxen/core';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return NextResponse.json({ id });
}

export async function DELETE(request: NextRequest) {
    return new Response(null, { status: 204 });
}
`,
	);

	// Catch-all route
	writeFileSync(
		join(ROUTES_DIR, 'docs', '[...slug]', 'route.ts'),
		`
export function GET() {
    return new Response("docs");
}
`,
	);

	// Optional catch-all route
	writeFileSync(
		join(ROUTES_DIR, 'products', '[[...categories]]', 'route.ts'),
		`
export const GET = async () => {
    return new Response("products");
};
`,
	);

	// Route group
	writeFileSync(
		join(ROUTES_DIR, '(auth)', 'login', 'route.ts'),
		`
export function POST() {
    return new Response("login");
}
`,
	);

	// Health check
	writeFileSync(
		join(ROUTES_DIR, 'health', 'route.ts'),
		`
/**
 * Health check endpoint
 * @returns Health status
 */
export function GET() {
    return Response.json({ status: "ok" });
}

export const revalidate = 0;
`,
	);

	// Middleware file
	writeFileSync(
		join(ROUTES_DIR, 'middleware.ts'),
		`
import { NextRequest, NextResponse } from '@foxen/core';

export function middleware(request: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: ['/api/:path*'],
};
`,
	);
});

// Cleanup test fixtures
afterAll(() => {
	rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('RouteAnalyzer', () => {
	describe('constructor', () => {
		test('creates analyzer with minimal options', () => {
			const analyzer = new RouteAnalyzer({
				rootDir: ROUTES_DIR,
			});
			expect(analyzer).toBeDefined();
		});

		test('accepts custom include patterns', () => {
			const analyzer = new RouteAnalyzer({
				rootDir: ROUTES_DIR,
				includePatterns: ['**/route.ts'],
			});
			expect(analyzer).toBeDefined();
		});

		test('accepts custom exclude patterns', () => {
			const analyzer = new RouteAnalyzer({
				rootDir: ROUTES_DIR,
				excludePatterns: ['**/node_modules/**'],
			});
			expect(analyzer).toBeDefined();
		});
	});

	describe('analyze', () => {
		let result: AnalysisResult;

		beforeAll(async () => {
			const analyzer = new RouteAnalyzer({
				rootDir: ROUTES_DIR,
				parseJsDoc: true,
			});
			result = await analyzer.analyze();
		});

		test('returns correct root directory', () => {
			expect(result.rootDir).toBe(ROUTES_DIR);
		});

		test('finds all route files', () => {
			expect(result.routes.length).toBeGreaterThanOrEqual(5);
		});

		test('finds middleware files', () => {
			expect(result.middleware.length).toBe(1);
		});

		test('has timestamp', () => {
			expect(result.timestamp).toBeInstanceOf(Date);
		});

		test('extracts handlers from routes', () => {
			const usersRoute = result.routes.find((r) => r.elysiaPath === '/users');
			expect(usersRoute).toBeDefined();
			expect(usersRoute?.handlers.length).toBe(2);

			const methods = usersRoute?.handlers.map((h) => h.method);
			expect(methods).toContain('GET');
			expect(methods).toContain('POST');
		});

		test('extracts async handlers correctly', () => {
			const usersRoute = result.routes.find((r) => r.elysiaPath === '/users');
			const getHandler = usersRoute?.handlers.find((h) => h.method === 'GET');
			expect(getHandler?.isAsync).toBe(true);
		});

		test('detects arrow function handlers', () => {
			const productsRoute = result.routes.find((r) => r.elysiaPath.includes('products'));
			const getHandler = productsRoute?.handlers.find((h) => h.method === 'GET');
			expect(getHandler?.isArrowFunction).toBe(true);
		});

		test('extracts route config', () => {
			const usersRoute = result.routes.find((r) => r.elysiaPath === '/users');
			expect(usersRoute?.config.dynamic).toBe('force-dynamic');
		});

		test('extracts revalidate config', () => {
			const healthRoute = result.routes.find((r) => r.elysiaPath === '/health');
			expect(healthRoute?.config.revalidate).toBe(0);
		});

		test('detects NextRequest usage', () => {
			const usersRoute = result.routes.find((r) => r.elysiaPath === '/users');
			expect(usersRoute?.usesNextRequest).toBe(true);
		});

		test('detects NextResponse usage', () => {
			const usersRoute = result.routes.find((r) => r.elysiaPath === '/users');
			expect(usersRoute?.usesNextResponse).toBe(true);
		});

		test('detects body parsing need', () => {
			const usersRoute = result.routes.find((r) => r.elysiaPath === '/users');
			expect(usersRoute?.needsBodyParsing).toBe(true);
		});

		test('extracts imports', () => {
			const usersRoute = result.routes.find((r) => r.elysiaPath === '/users');
			expect(usersRoute?.imports.length).toBeGreaterThan(0);

			const coreImport = usersRoute?.imports.find((i) => i.moduleSpecifier === '@foxen/core');
			expect(coreImport).toBeDefined();
		});
	});

	describe('path conversion', () => {
		let result: AnalysisResult;

		beforeAll(async () => {
			result = await analyzeRoutes({ rootDir: ROUTES_DIR });
		});

		test('converts dynamic segments [id] to :id', () => {
			const userByIdRoute = result.routes.find((r) => r.elysiaPath === '/users/:id');
			expect(userByIdRoute).toBeDefined();
			expect(userByIdRoute?.pathParams).toContain('id');
		});

		test('converts catch-all [...slug] to *', () => {
			const docsRoute = result.routes.find((r) => r.elysiaPath.includes('docs'));
			expect(docsRoute?.elysiaPath).toContain('*');
			expect(docsRoute?.isCatchAll).toBe(true);
		});

		test('converts optional catch-all [[...param]] to *', () => {
			const productsRoute = result.routes.find((r) => r.elysiaPath.includes('products'));
			expect(productsRoute?.isOptionalCatchAll).toBe(true);
		});

		test('strips route groups from path', () => {
			const loginRoute = result.routes.find((r) => r.elysiaPath === '/login');
			expect(loginRoute).toBeDefined();
		});

		test('extracts path params', () => {
			const userByIdRoute = result.routes.find((r) => r.elysiaPath === '/users/:id');
			expect(userByIdRoute?.pathParams).toEqual(['id']);
		});
	});

	describe('middleware analysis', () => {
		let result: AnalysisResult;

		beforeAll(async () => {
			result = await analyzeRoutes({ rootDir: ROUTES_DIR });
		});

		test('finds middleware function', () => {
			const mw = result.middleware[0];
			expect(mw?.functionName).toBe('middleware');
		});

		test('extracts middleware config', () => {
			const mw = result.middleware[0];
			expect(mw?.config?.matcher).toBeDefined();
		});
	});
});

describe('analyzeRoutes', () => {
	test('is a convenience function for RouteAnalyzer', async () => {
		const result = await analyzeRoutes({ rootDir: ROUTES_DIR });

		expect(result.routes.length).toBeGreaterThan(0);
		expect(result.rootDir).toBe(ROUTES_DIR);
	});
});

describe('analyzeFile', () => {
	test('analyzes a single route file', async () => {
		const filePath = join(ROUTES_DIR, 'users', 'route.ts');
		const result = await analyzeFile(filePath);

		expect(result).toBeDefined();
		expect(result?.handlers.length).toBe(2);
	});
});
