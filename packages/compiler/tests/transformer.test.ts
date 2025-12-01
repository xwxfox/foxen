import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	CodeTransformer,
	applyTransformers,
	catchAllTransformer,
	composeTransformers,
	openApiTransformer,
	validationTransformer,
} from '../src/transformer.js';
import type { AnalyzedRoute, RouteTransformer, TransformContext } from '../src/types.js';

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, 'fixtures-transformer');

// Setup test fixtures
beforeAll(() => {
	mkdirSync(FIXTURES_DIR, { recursive: true });

	writeFileSync(
		join(FIXTURES_DIR, 'sample-handler.ts'),
		`
import { NextRequest, NextResponse } from '@foxen/core';

export async function POST(request: NextRequest) {
    const body = await request.json();
    return NextResponse.json({ received: body });
}
`,
	);

	writeFileSync(
		join(FIXTURES_DIR, 'simple-handler.ts'),
		`
export function GET() {
    return new Response("hello");
}
`,
	);
});

// Cleanup test fixtures
afterAll(() => {
	rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

// Helper to create a mock route
function createMockRoute(overrides: Partial<AnalyzedRoute> = {}): AnalyzedRoute {
	return {
		filePath: '/app/api/users/route.ts',
		relativePath: 'users/route.ts',
		elysiaPath: '/users',
		pathParams: [],
		isCatchAll: false,
		isOptionalCatchAll: false,
		handlers: [
			{
				method: 'GET',
				exportName: 'GET',
				isAsync: false,
				isArrowFunction: false,
				params: [],
				startLine: 1,
				endLine: 3,
			},
		],
		config: {},
		imports: [],
		usesNextRequest: true,
		usesNextResponse: true,
		needsBodyParsing: false,
		...overrides,
	};
}

// Helper to create transform context
function createContext(route: AnalyzedRoute): TransformContext {
	return {
		route,
		allRoutes: [route],
		options: {
			outputPath: './generated',
			format: 'ts',
			moduleFormat: 'esm',
		},
		projectRoot: '/app',
	};
}

describe('validationTransformer', () => {
	test('returns empty string for GET handler', () => {
		const route = createMockRoute({
			handlers: [
				{
					method: 'GET',
					exportName: 'GET',
					isAsync: false,
					isArrowFunction: false,
					params: [],
					startLine: 1,
					endLine: 3,
				},
			],
		});
		const context = createContext(route);

		const result = validationTransformer(context);

		expect(result).toBe('');
	});

	test('generates comment for POST handler with body param', () => {
		const route = createMockRoute({
			handlers: [
				{
					method: 'POST',
					exportName: 'POST',
					isAsync: true,
					isArrowFunction: false,
					params: [{ name: 'body', type: 'UserBody', hasDefault: false, isOptional: false }],
					startLine: 1,
					endLine: 5,
				},
			],
		});
		const context = createContext(route);

		const result = validationTransformer(context);

		expect(result).toContain('Validation for POST');
		expect(result).toContain('Body type');
	});

	test('handles PUT handler', () => {
		const route = createMockRoute({
			handlers: [
				{
					method: 'PUT',
					exportName: 'PUT',
					isAsync: true,
					isArrowFunction: false,
					params: [{ name: 'body', type: 'UpdateBody', hasDefault: false, isOptional: false }],
					startLine: 1,
					endLine: 5,
				},
			],
		});
		const context = createContext(route);

		const result = validationTransformer(context);

		expect(result).toContain('PUT');
	});

	test('handles PATCH handler', () => {
		const route = createMockRoute({
			handlers: [
				{
					method: 'PATCH',
					exportName: 'PATCH',
					isAsync: true,
					isArrowFunction: false,
					params: [{ name: 'body', type: 'PatchBody', hasDefault: false, isOptional: false }],
					startLine: 1,
					endLine: 5,
				},
			],
		});
		const context = createContext(route);

		const result = validationTransformer(context);

		expect(result).toContain('PATCH');
	});
});

describe('openApiTransformer', () => {
	test('returns empty string when no JSDoc', () => {
		const route = createMockRoute();
		const context = createContext(route);

		const result = openApiTransformer(context);

		expect(result).toBe('');
	});

	test('includes JSDoc content', () => {
		const route = createMockRoute({
			handlers: [
				{
					method: 'GET',
					exportName: 'GET',
					isAsync: false,
					isArrowFunction: false,
					params: [],
					startLine: 1,
					endLine: 5,
					jsDoc: 'Get all users',
				},
			],
		});
		const context = createContext(route);

		const result = openApiTransformer(context);

		expect(result).toContain('GET:');
		expect(result).toContain('Get all users');
	});

	test('handles multiline JSDoc', () => {
		const route = createMockRoute({
			handlers: [
				{
					method: 'POST',
					exportName: 'POST',
					isAsync: true,
					isArrowFunction: false,
					params: [],
					startLine: 1,
					endLine: 10,
					jsDoc: 'Create user\nWith validation',
				},
			],
		});
		const context = createContext(route);

		const result = openApiTransformer(context);

		expect(result).toContain('Create user With validation');
	});
});

describe('catchAllTransformer', () => {
	test('returns empty for non-catch-all route', () => {
		const route = createMockRoute({ isCatchAll: false, isOptionalCatchAll: false });
		const context = createContext(route);

		const result = catchAllTransformer(context);

		expect(result).toBe('');
	});

	test('returns comment for catch-all route', () => {
		const route = createMockRoute({
			isCatchAll: true,
			elysiaPath: '/docs/*',
		});
		const context = createContext(route);

		const result = catchAllTransformer(context);

		expect(result).toContain('Catch-all route');
		expect(result).toContain('/docs/*');
	});

	test('returns comment for optional catch-all route', () => {
		const route = createMockRoute({
			isOptionalCatchAll: true,
			elysiaPath: '/products/*',
		});
		const context = createContext(route);

		const result = catchAllTransformer(context);

		expect(result).toContain('Catch-all route');
	});
});

describe('CodeTransformer', () => {
	describe('transformHandler', () => {
		test('transforms handler code', () => {
			const transformer = new CodeTransformer();
			const code = `
export async function GET(request: NextRequest) {
    return NextResponse.json({ ok: true });
}
`;
			const handler = {
				method: 'GET' as const,
				exportName: 'GET',
				isAsync: true,
				isArrowFunction: false,
				params: [],
				startLine: 1,
				endLine: 3,
			};

			const result = transformer.transformHandler(code, handler);

			expect(result).toBeDefined();
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe('extractResponseType', () => {
		test('detects Response return type', () => {
			const transformer = new CodeTransformer();
			const code = `
export function GET(): Response {
    return new Response("hello");
}
`;
			const handler = {
				method: 'GET' as const,
				exportName: 'GET',
				isAsync: false,
				isArrowFunction: false,
				params: [],
				startLine: 1,
				endLine: 3,
			};

			const result = transformer.extractResponseType(code, handler);

			expect(result).toBe('Response');
		});

		test('detects NextResponse return type', () => {
			const transformer = new CodeTransformer();
			const code = `
export function GET(): NextResponse {
    return NextResponse.json({});
}
`;
			const handler = {
				method: 'GET' as const,
				exportName: 'GET',
				isAsync: false,
				isArrowFunction: false,
				params: [],
				startLine: 1,
				endLine: 3,
			};

			const result = transformer.extractResponseType(code, handler);

			expect(result).toBe('NextResponse');
		});
	});

	describe('checkImports', () => {
		test('detects used imports', () => {
			const transformer = new CodeTransformer();
			const code = `
import { NextRequest, NextResponse } from '@foxen/core';

export function GET(req: NextRequest) {
    return NextResponse.json({});
}
`;

			const result = transformer.checkImports(code, ['NextRequest', 'NextResponse', 'cookies']);

			expect(result.get('NextRequest')).toBe(true);
			expect(result.get('NextResponse')).toBe(true);
			expect(result.get('cookies')).toBe(false);
		});
	});

	describe('generateTypeBoxSchema', () => {
		test('generates schema from interface', () => {
			const transformer = new CodeTransformer();
			const code = `
interface User {
    id: string;
    name: string;
    age: number;
    active: boolean;
}
`;

			const result = transformer.generateTypeBoxSchema(code);

			expect(result).toContain('UserSchema');
			expect(result).toContain('Type.Object');
			expect(result).toContain('id: Type.String()');
			expect(result).toContain('name: Type.String()');
			expect(result).toContain('age: Type.Number()');
			expect(result).toContain('active: Type.Boolean()');
		});

		test('handles optional properties', () => {
			const transformer = new CodeTransformer();
			const code = `
interface Config {
    name: string;
    debug?: boolean;
}
`;

			const result = transformer.generateTypeBoxSchema(code);

			expect(result).toContain('Type.Optional');
		});

		test('handles array types', () => {
			const transformer = new CodeTransformer();
			const code = `
interface List {
    items: string[];
}
`;

			const result = transformer.generateTypeBoxSchema(code);

			expect(result).toContain('Type.Array');
		});
	});
});

describe('applyTransformers', () => {
	test('applies multiple transformers', async () => {
		const route = createMockRoute();
		const allRoutes = [route];
		const options = { outputPath: './gen', format: 'ts' as const, moduleFormat: 'esm' as const };

		const transformer1: RouteTransformer = () => '// Transform 1';
		const transformer2: RouteTransformer = () => '// Transform 2';

		const results = await applyTransformers(
			route,
			[transformer1, transformer2],
			allRoutes,
			options,
		);

		expect(results).toHaveLength(2);
		expect(results[0]).toBe('// Transform 1');
		expect(results[1]).toBe('// Transform 2');
	});

	test('filters empty results', async () => {
		const route = createMockRoute();
		const allRoutes = [route];
		const options = { outputPath: './gen', format: 'ts' as const, moduleFormat: 'esm' as const };

		const transformer1: RouteTransformer = () => '';
		const transformer2: RouteTransformer = () => '// Has content';

		const results = await applyTransformers(
			route,
			[transformer1, transformer2],
			allRoutes,
			options,
		);

		expect(results).toHaveLength(1);
		expect(results[0]).toBe('// Has content');
	});

	test('handles async transformers', async () => {
		const route = createMockRoute();
		const allRoutes = [route];
		const options = { outputPath: './gen', format: 'ts' as const, moduleFormat: 'esm' as const };

		const asyncTransformer: RouteTransformer = async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return '// Async result';
		};

		const results = await applyTransformers(route, [asyncTransformer], allRoutes, options);

		expect(results[0]).toBe('// Async result');
	});
});

describe('composeTransformers', () => {
	test('composes multiple transformers into one', async () => {
		const transformer1: RouteTransformer = () => '// Line 1';
		const transformer2: RouteTransformer = () => '// Line 2';

		const composed = composeTransformers(transformer1, transformer2);
		const route = createMockRoute();
		const context = createContext(route);

		const result = await composed(context);

		expect(result).toContain('// Line 1');
		expect(result).toContain('// Line 2');
	});

	test('joins results with newlines', async () => {
		const transformer1: RouteTransformer = () => 'A';
		const transformer2: RouteTransformer = () => 'B';

		const composed = composeTransformers(transformer1, transformer2);
		const route = createMockRoute();
		const context = createContext(route);

		const result = await composed(context);

		expect(result).toBe('A\nB');
	});

	test('filters empty strings from composition', async () => {
		const transformer1: RouteTransformer = () => '';
		const transformer2: RouteTransformer = () => 'Only this';

		const composed = composeTransformers(transformer1, transformer2);
		const route = createMockRoute();
		const context = createContext(route);

		const result = await composed(context);

		expect(result).toBe('Only this');
	});
});
