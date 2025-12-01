import { describe, expect, it } from 'bun:test';
import type { ResolvedNextConfig } from '@foxen/config';
import { getFoxenContext } from '../src/context.js';
import {
	createOnAfterHandleHandler,
	createOnBeforeHandleHandler,
	createOnErrorHandler,
	createOnRequestHandler,
	registerLifecycleHooks,
} from '../src/lifecycle.js';
import type { AppRouterConfig } from '../src/types.js';

// Mock config
const baseConfig: AppRouterConfig = {
	apiDir: './src/app/api',
	verbose: false,
	features: {
		redirects: true,
		rewrites: true,
		headers: true,
		middleware: true,
	},
};

// Helper to create mock request and context
type MockContext = {
	request: Request;
	set: { headers: Record<string, string>; status?: number };
	response?: Response;
	[key: symbol]: unknown;
};

function createMockContext(url = 'http://localhost/api/users'): MockContext {
	return {
		request: new Request(url),
		set: { headers: {} as Record<string, string> },
	};
}

describe('createOnRequestHandler', () => {
	it('should continue when no redirects match', async () => {
		const nextConfig: ResolvedNextConfig = {
			basePath: '',
			trailingSlash: false,
			redirects: [
				{
					source: '/old-path',
					destination: '/new-path',
					permanent: true,
				},
			],
			rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
			headers: [],
		};

		const handler = createOnRequestHandler({
			middleware: null,
			nextConfig,
			config: baseConfig,
		});

		const ctx = createMockContext('http://localhost/api/users');
		const result = await handler(ctx);

		expect(result).toBeUndefined();
	});

	it('should return redirect response when redirect matches', async () => {
		const nextConfig: ResolvedNextConfig = {
			basePath: '',
			trailingSlash: false,
			redirects: [
				{
					source: '/api/users',
					destination: '/api/v2/users',
					permanent: false,
				},
			],
			rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
			headers: [],
		};

		const handler = createOnRequestHandler({
			middleware: null,
			nextConfig,
			config: baseConfig,
		});

		const ctx = createMockContext('http://localhost/api/users');
		const result = await handler(ctx);

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(307);
		expect((result as Response).headers.get('Location')).toBe('http://localhost/api/v2/users');
	});

	it('should handle permanent redirects with 308', async () => {
		const nextConfig: ResolvedNextConfig = {
			basePath: '',
			trailingSlash: false,
			redirects: [
				{
					source: '/old',
					destination: '/new',
					permanent: true,
				},
			],
			rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
			headers: [],
		};

		const handler = createOnRequestHandler({
			middleware: null,
			nextConfig,
			config: baseConfig,
		});

		const ctx = createMockContext('http://localhost/old');
		const result = await handler(ctx);

		expect((result as Response).status).toBe(308);
	});

	it('should collect headers for response', async () => {
		const nextConfig: ResolvedNextConfig = {
			basePath: '',
			trailingSlash: false,
			redirects: [],
			rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
			headers: [
				{
					source: '/api/:path*',
					headers: [{ key: 'X-Custom-Header', value: 'test-value' }],
				},
			],
		};

		const handler = createOnRequestHandler({
			middleware: null,
			nextConfig,
			config: baseConfig,
		});

		const ctx = createMockContext('http://localhost/api/users');
		await handler(ctx);

		const foxenCtx = getFoxenContext(ctx);
		expect(foxenCtx._nextHeaders).toEqual([{ key: 'X-Custom-Header', value: 'test-value' }]);
	});

	it('should store beforeFiles rewrite in context', async () => {
		const nextConfig: ResolvedNextConfig = {
			basePath: '',
			trailingSlash: false,
			redirects: [],
			rewrites: {
				beforeFiles: [
					{
						source: '/api/v1/:path*',
						destination: '/api/v2/:path*',
					},
				],
				afterFiles: [],
				fallback: [],
			},
			headers: [],
		};

		const handler = createOnRequestHandler({
			middleware: null,
			nextConfig,
			config: baseConfig,
		});

		const ctx = createMockContext('http://localhost/api/v1/users');
		await handler(ctx);

		const foxenCtx = getFoxenContext(ctx);
		expect(foxenCtx._rewriteTo).toBe('/api/v2/users');
	});
});

describe('createOnBeforeHandleHandler', () => {
	it('should skip afterFiles if already rewritten', async () => {
		const nextConfig: ResolvedNextConfig = {
			basePath: '',
			trailingSlash: false,
			redirects: [],
			rewrites: {
				beforeFiles: [],
				afterFiles: [
					{
						source: '/api/users',
						destination: '/api/v3/users',
					},
				],
				fallback: [],
			},
			headers: [],
		};

		const handler = createOnBeforeHandleHandler({
			middleware: null,
			nextConfig,
			config: baseConfig,
		});

		const ctx = createMockContext('http://localhost/api/users');
		// Pre-set a rewrite from beforeFiles
		const Symbol_FOXEN = Symbol.for('foxen.context');
		ctx[Symbol_FOXEN] = { _rewriteTo: '/already-rewritten' };

		await handler(ctx);

		const foxenCtx = getFoxenContext(ctx);
		expect(foxenCtx._rewriteTo).toBe('/already-rewritten');
	});

	it('should process afterFiles rewrites', async () => {
		const nextConfig: ResolvedNextConfig = {
			basePath: '',
			trailingSlash: false,
			redirects: [],
			rewrites: {
				beforeFiles: [],
				afterFiles: [
					{
						source: '/api/users',
						destination: '/api/v3/users',
					},
				],
				fallback: [],
			},
			headers: [],
		};

		const handler = createOnBeforeHandleHandler({
			middleware: null,
			nextConfig,
			config: baseConfig,
		});

		const ctx = createMockContext('http://localhost/api/users');
		await handler(ctx);

		const foxenCtx = getFoxenContext(ctx);
		expect(foxenCtx._rewriteTo).toBe('/api/v3/users');
	});
});

describe('createOnAfterHandleHandler', () => {
	it('should apply collected headers to response', async () => {
		const handler = createOnAfterHandleHandler({
			middleware: null,
			nextConfig: null,
			config: baseConfig,
		});

		const response = new Response(JSON.stringify({ ok: true }), {
			headers: { 'Content-Type': 'application/json' },
		});

		const ctx = {
			response,
			request: new Request('http://localhost'),
			set: { headers: {} },
		} as MockContext;
		const Symbol_FOXEN = Symbol.for('foxen.context');
		ctx[Symbol_FOXEN] = {
			_nextHeaders: [
				{ key: 'X-Custom', value: 'value1' },
				{ key: 'X-Another', value: 'value2' },
			],
		};

		//@ts-expect-error
		const result = await handler(ctx);

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).headers.get('X-Custom')).toBe('value1');
		expect((result as Response).headers.get('X-Another')).toBe('value2');
	});

	it('should return response unchanged if no headers to apply', async () => {
		const handler = createOnAfterHandleHandler({
			middleware: null,
			nextConfig: null,
			config: baseConfig,
		});

		const response = new Response('test');
		const ctx = { response };

		const result = await handler(ctx);

		// Response should pass through
		expect(result).toBe(response);
	});

	it('should return non-Response values unchanged', async () => {
		const handler = createOnAfterHandleHandler({
			middleware: null,
			nextConfig: null,
			config: baseConfig,
		});

		const ctx = { response: { data: 'test' } };
		const result = await handler(ctx);

		expect(result).toEqual({ data: 'test' });
	});
});

describe('createOnErrorHandler', () => {
	it('should not handle non-NOT_FOUND errors', async () => {
		const nextConfig: ResolvedNextConfig = {
			basePath: '',
			trailingSlash: false,
			redirects: [],
			rewrites: {
				beforeFiles: [],
				afterFiles: [],
				fallback: [{ source: '/:path*', destination: 'https://fallback.com/:path*' }],
			},
			headers: [],
		};

		const handler = createOnErrorHandler({
			middleware: null,
			nextConfig,
			config: baseConfig,
		});

		const ctx = {
			request: new Request('http://localhost/api/users'),
			code: 'INTERNAL_SERVER_ERROR',
			error: new Error('test'),
			set: {},
		};

		const result = await handler(ctx);
		expect(result).toBeUndefined();
	});
});

describe('registerLifecycleHooks', () => {
	it('should register hooks when features are enabled', () => {
		const nextConfig: ResolvedNextConfig = {
			basePath: '',
			trailingSlash: false,
			redirects: [{ source: '/old', destination: '/new', permanent: true }],
			rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
			headers: [{ source: '/:path*', headers: [{ key: 'X-Test', value: 'test' }] }],
		};

		const hooks: Record<string, unknown[]> = {
			onRequest: [],
			onBeforeHandle: [],
			onAfterHandle: [],
			onError: [],
		};

		const mockApp = {
			//@ts-expect-error
			onRequest: (fn: unknown) => hooks.onRequest.push(fn),
			//@ts-expect-error
			onBeforeHandle: (fn: unknown) => hooks.onBeforeHandle.push(fn),
			//@ts-expect-error
			onAfterHandle: (fn: unknown) => hooks.onAfterHandle.push(fn),
			//@ts-expect-error
			onError: (fn: unknown) => hooks.onError.push(fn),
		};

		registerLifecycleHooks(mockApp, {
			middleware: null,
			nextConfig,
			config: baseConfig,
		});
		//@ts-expect-error
		expect(hooks.onRequest.length).toBe(1);
		//@ts-expect-error
		expect(hooks.onAfterHandle.length).toBe(1);
	});

	it('should not register hooks when no features are enabled', () => {
		const nextConfig: ResolvedNextConfig = {
			basePath: '',
			trailingSlash: false,
			redirects: [],
			rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
			headers: [],
		};

		const hooks: Record<string, unknown[]> = {
			onRequest: [],
			onBeforeHandle: [],
			onAfterHandle: [],
			onError: [],
		};

		const mockApp = {
			//@ts-expect-error
			onRequest: (fn: unknown) => hooks.onRequest.push(fn),
			//@ts-expect-error
			onBeforeHandle: (fn: unknown) => hooks.onBeforeHandle.push(fn),
			//@ts-expect-error
			onAfterHandle: (fn: unknown) => hooks.onAfterHandle.push(fn),
			//@ts-expect-error
			onError: (fn: unknown) => hooks.onError.push(fn),
		};

		registerLifecycleHooks(mockApp, {
			middleware: null,
			nextConfig,
			config: baseConfig,
		});

		//@ts-expect-error
		expect(hooks.onRequest.length).toBe(0);
		//@ts-expect-error
		expect(hooks.onBeforeHandle.length).toBe(0);
		//@ts-expect-error
		expect(hooks.onAfterHandle.length).toBe(0);
		//@ts-expect-error
		expect(hooks.onError.length).toBe(0);
	});
});
