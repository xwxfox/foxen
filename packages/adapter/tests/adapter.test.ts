import { describe, expect, test } from 'bun:test';
import { NextResponse } from '@foxen/core';
import { createMiddlewareAdapter, defaultAdapter, simpleAdapter } from '../src/adapter.js';
import type { ElysiaContext, RouteInfo } from '../src/types.js';

// Helper to create a mock route info
function createMockRouteInfo(overrides: Partial<RouteInfo> = {}): RouteInfo {
	return {
		filePath: '/app/api/users/route.ts',
		nextPath: '/users',
		elysiaPath: '/users',
		methods: ['GET'],
		params: [],
		isCatchAll: false,
		isOptionalCatchAll: false,
		...overrides,
	};
}

// Helper to create a mock Elysia context
function createMockContext(
	options: {
		url?: string;
		method?: string;
		headers?: Record<string, string>;
		params?: Record<string, string | string[]>;
		body?: unknown;
	} = {},
): ElysiaContext {
	const url = options.url ?? 'https://example.com/users';
	const method = options.method ?? 'GET';
	const reqHeaders = options.headers ?? {};

	return {
		request: new Request(url, {
			method,
			headers: reqHeaders,
		}),
		params: options.params ?? {},
		query: {},
		body: options.body,
		headers: reqHeaders,
		path: new URL(url).pathname,
		store: {},
		set: {
			status: 200,
			headers: {},
		},
	};
}

describe('defaultAdapter', () => {
	test('wraps Next.js handler for Elysia', async () => {
		const handler = async (_request: Request) => {
			return NextResponse.json({ received: true });
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = defaultAdapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		const response = (await elysiaHandler(ctx)) as Response;

		expect(response).toBeInstanceOf(Response);
		expect(response.status).toBe(200);

		const json = await response.json();
		expect(json.received).toBe(true);
	});

	test('passes params to handler', async () => {
		let receivedId: string | undefined;

		const handler = async (
			_request: Request,
			ctx: { params: Promise<Record<string, string | string[]>> },
		) => {
			const resolvedParams = await ctx.params;
			receivedId = resolvedParams.id as string;
			return NextResponse.json({ id: receivedId });
		};

		const routeInfo = createMockRouteInfo({
			params: [{ name: 'id', isCatchAll: false, isOptional: false }],
		});
		// Cast handler since our specific param type is compatible
		const elysiaHandler = defaultAdapter(
			handler as Parameters<typeof defaultAdapter>[0],
			routeInfo,
			'GET',
		);
		const ctx = createMockContext({
			url: 'https://example.com/users/123',
			params: { id: '123' },
		});

		await elysiaHandler(ctx);

		expect(receivedId).toBe('123');
	});

	test('handles catch-all params', async () => {
		let receivedSlug: string[] | undefined;

		const handler = async (
			_request: Request,
			ctx: { params: Promise<Record<string, string | string[]>> },
		) => {
			const resolvedParams = await ctx.params;
			receivedSlug = resolvedParams.slug as string[];
			return NextResponse.json({ slug: receivedSlug });
		};

		const routeInfo = createMockRouteInfo({
			elysiaPath: '/docs/*',
			params: [{ name: 'slug', isCatchAll: true, isOptional: false }],
		});
		// Cast handler since our specific param type is compatible
		const elysiaHandler = defaultAdapter(
			handler as Parameters<typeof defaultAdapter>[0],
			routeInfo,
			'GET',
		);
		const ctx = createMockContext({
			url: 'https://example.com/docs/a/b/c',
			params: { '*': 'a/b/c' },
		});

		await elysiaHandler(ctx);

		expect(receivedSlug).toEqual(['a', 'b', 'c']);
	});

	test('converts plain object to JSON response', async () => {
		const handler = async () => {
			return { data: 'test' } as unknown as Response;
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = defaultAdapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		const response = (await elysiaHandler(ctx)) as Response;

		expect(response.headers.get('Content-Type')).toBe('application/json');
		const json = await response.json();
		expect(json.data).toBe('test');
	});

	test('returns 204 for undefined response', async () => {
		const handler = async () => {
			return undefined as unknown as Response;
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = defaultAdapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		const response = (await elysiaHandler(ctx)) as Response;

		expect(response.status).toBe(204);
	});

	test('handles handler errors', async () => {
		const handler = async () => {
			throw new Error('Test error');
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = defaultAdapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		const response = (await elysiaHandler(ctx)) as Response;

		expect(response.status).toBe(500);
		const json = await response.json();
		expect(json.error).toBe('Internal Server Error');
	});

	test('passes request body from Elysia', async () => {
		let receivedBody: unknown;

		const handler = async (request: Request) => {
			receivedBody = await request.json();
			return NextResponse.json({ ok: true });
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = defaultAdapter(handler, routeInfo, 'POST');
		const ctx = createMockContext({
			method: 'POST',
			body: { name: 'test' },
		});

		await elysiaHandler(ctx);

		expect(receivedBody).toEqual({ name: 'test' });
	});
});

describe('simpleAdapter', () => {
	test('wraps handler without params', async () => {
		const handler = async (_request: Request) => {
			return NextResponse.json({ simple: true });
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = simpleAdapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		const response = (await elysiaHandler(ctx)) as Response;

		expect(response).toBeInstanceOf(Response);
		const json = await response.json();
		expect(json.simple).toBe(true);
	});

	test('handles errors gracefully', async () => {
		const handler = async () => {
			throw new Error('Oops');
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = simpleAdapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		const response = (await elysiaHandler(ctx)) as Response;

		expect(response.status).toBe(500);
	});

	test('converts plain object to JSON', async () => {
		const handler = async () => {
			return { status: 'ok' } as unknown as Response;
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = simpleAdapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		const response = (await elysiaHandler(ctx)) as Response;

		const json = await response.json();
		expect(json.status).toBe('ok');
	});

	test('returns 204 for null response', async () => {
		const handler = async () => {
			return null as unknown as Response;
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = simpleAdapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		const response = (await elysiaHandler(ctx)) as Response;

		expect(response.status).toBe(204);
	});
});

describe('createMiddlewareAdapter', () => {
	test('creates adapter with before handler', async () => {
		let beforeCalled = false;

		const adapter = createMiddlewareAdapter(async () => {
			beforeCalled = true;
			return undefined;
		});

		const handler = async () => {
			return NextResponse.json({ ok: true });
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = adapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		await elysiaHandler(ctx);

		expect(beforeCalled).toBe(true);
	});

	test('before handler can short-circuit with response', async () => {
		const adapter = createMiddlewareAdapter(async () => {
			return new Response('Unauthorized', { status: 401 });
		});

		const handler = async () => {
			return NextResponse.json({ ok: true });
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = adapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		const response = (await elysiaHandler(ctx)) as Response;

		expect(response.status).toBe(401);
	});

	test('creates adapter with after handler', async () => {
		let afterCalled = false;

		const adapter = createMiddlewareAdapter(undefined, async (response) => {
			afterCalled = true;
			return response;
		});

		const handler = async () => {
			return NextResponse.json({ ok: true });
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = adapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		await elysiaHandler(ctx);

		expect(afterCalled).toBe(true);
	});

	test('after handler can modify response', async () => {
		const adapter = createMiddlewareAdapter(undefined, async (response) => {
			const newResponse = new Response(response.body, {
				status: response.status,
				headers: response.headers,
			});
			newResponse.headers.set('X-Custom', 'value');
			return newResponse;
		});

		const handler = async () => {
			return NextResponse.json({ ok: true });
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = adapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		const response = (await elysiaHandler(ctx)) as Response;

		expect(response.headers.get('X-Custom')).toBe('value');
	});

	test('handles errors in main handler', async () => {
		const adapter = createMiddlewareAdapter();

		const handler = async () => {
			throw new Error('Handler error');
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = adapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		const response = (await elysiaHandler(ctx)) as Response;

		expect(response.status).toBe(500);
	});

	test('converts plain object response before after handler', async () => {
		let receivedResponse: Response | null = null;

		const adapter = createMiddlewareAdapter(undefined, async (response) => {
			receivedResponse = response;
			return response;
		});

		const handler = async () => {
			return { converted: true } as unknown as Response;
		};

		const routeInfo = createMockRouteInfo();
		const elysiaHandler = adapter(handler, routeInfo, 'GET');
		const ctx = createMockContext();

		await elysiaHandler(ctx);

		expect(receivedResponse).toBeInstanceOf(Response);
	});
});
