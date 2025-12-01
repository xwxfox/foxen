import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	executeMiddleware,
	loadMiddleware,
	matchesConditions,
	shouldRunMiddleware,
} from '../src/middleware.js';
import type { CompiledMatcher } from '../src/middleware.js';

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, 'fixtures-middleware');

// Setup test fixtures
beforeAll(() => {
	mkdirSync(FIXTURES_DIR, { recursive: true });

	// Basic middleware
	writeFileSync(
		join(FIXTURES_DIR, 'middleware.ts'),
		`
export function middleware(request) {
    return new Response(null, {
        headers: { "x-middleware-next": "1" },
    });
}

export const config = {
    matcher: ["/api/:path*"],
};
`,
	);

	// Proxy middleware
	writeFileSync(
		join(FIXTURES_DIR, 'proxy.ts'),
		`
export function proxy(request) {
    return new Response("proxied");
}

export const config = {
    matcher: "/proxy/:path*",
};
`,
	);

	// Middleware with default export
	writeFileSync(
		join(FIXTURES_DIR, 'default-middleware.ts'),
		`
export default function middleware(request) {
    return new Response("default");
}
`,
	);
});

// Cleanup test fixtures
afterAll(() => {
	rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('loadMiddleware', () => {
	test('loads middleware from explicit path', async () => {
		const result = await loadMiddleware('middleware.ts', FIXTURES_DIR);

		expect(result).not.toBeNull();
		expect(result?.type).toBe('middleware');
		expect(typeof result?.handler).toBe('function');
	});

	test('loads proxy middleware', async () => {
		const result = await loadMiddleware('proxy.ts', FIXTURES_DIR);

		expect(result).not.toBeNull();
		expect(result?.type).toBe('proxy');
	});

	test('compiles matchers from config', async () => {
		const result = await loadMiddleware('middleware.ts', FIXTURES_DIR);

		expect(result?.matchers.length).toBeGreaterThan(0);
	});

	test('returns null for non-existent middleware', async () => {
		const result = await loadMiddleware('nonexistent.ts', FIXTURES_DIR);

		expect(result).toBeNull();
	});

	test('auto-detects middleware files', async () => {
		const result = await loadMiddleware(undefined, FIXTURES_DIR);

		// Should find either proxy.ts or middleware.ts
		expect(result).not.toBeNull();
	});
});

describe('shouldRunMiddleware', () => {
	test('matches simple path pattern', () => {
		const request = new Request('https://example.com/api/users');
		const matchers: CompiledMatcher[] = [{ source: '/api/:path*', regex: /^\/api\/.*$/ }];

		expect(shouldRunMiddleware(request, matchers)).toBe(true);
	});

	test('does not match non-matching path', () => {
		const request = new Request('https://example.com/other/path');
		const matchers: CompiledMatcher[] = [{ source: '/api/:path*', regex: /^\/api\/.*$/ }];

		expect(shouldRunMiddleware(request, matchers)).toBe(false);
	});

	test('matches any of multiple matchers', () => {
		const request = new Request('https://example.com/admin/dashboard');
		const matchers: CompiledMatcher[] = [
			{ source: '/api/:path*', regex: /^\/api\/.*$/ },
			{ source: '/admin/:path*', regex: /^\/admin\/.*$/ },
		];

		expect(shouldRunMiddleware(request, matchers)).toBe(true);
	});

	test('respects has conditions', () => {
		const request = new Request('https://example.com/api/users', {
			headers: { 'x-api-key': 'secret' },
		});

		const matchers: CompiledMatcher[] = [
			{
				source: '/api/:path*',
				regex: /^\/api\/.*$/,
				has: [{ type: 'header', key: 'x-api-key' }],
			},
		];

		expect(shouldRunMiddleware(request, matchers)).toBe(true);
	});

	test('fails when has condition not met', () => {
		const request = new Request('https://example.com/api/users');

		const matchers: CompiledMatcher[] = [
			{
				source: '/api/:path*',
				regex: /^\/api\/.*$/,
				has: [{ type: 'header', key: 'x-api-key' }],
			},
		];

		expect(shouldRunMiddleware(request, matchers)).toBe(false);
	});

	test('respects missing conditions', () => {
		const request = new Request('https://example.com/api/users');

		const matchers: CompiledMatcher[] = [
			{
				source: '/api/:path*',
				regex: /^\/api\/.*$/,
				missing: [{ type: 'header', key: 'x-internal' }],
			},
		];

		expect(shouldRunMiddleware(request, matchers)).toBe(true);
	});

	test('fails when missing condition is present', () => {
		const request = new Request('https://example.com/api/users', {
			headers: { 'x-internal': 'true' },
		});

		const matchers: CompiledMatcher[] = [
			{
				source: '/api/:path*',
				regex: /^\/api\/.*$/,
				missing: [{ type: 'header', key: 'x-internal' }],
			},
		];

		expect(shouldRunMiddleware(request, matchers)).toBe(false);
	});
});

describe('matchesConditions', () => {
	test('matches header condition', () => {
		const request = new Request('https://example.com/test', {
			headers: { 'x-custom': 'value' },
		});

		const result = matchesConditions(request, [{ type: 'header', key: 'x-custom' }]);

		expect(result).toBe(true);
	});

	test('matches header with value', () => {
		const request = new Request('https://example.com/test', {
			headers: { 'x-custom': 'expected' },
		});

		const result = matchesConditions(request, [
			{ type: 'header', key: 'x-custom', value: 'expected' },
		]);

		expect(result).toBe(true);
	});

	test('fails header with wrong value', () => {
		const request = new Request('https://example.com/test', {
			headers: { 'x-custom': 'wrong' },
		});

		const result = matchesConditions(request, [
			{ type: 'header', key: 'x-custom', value: 'expected' },
		]);

		expect(result).toBe(false);
	});

	test('matches cookie condition', () => {
		const request = new Request('https://example.com/test', {
			headers: { cookie: 'session=abc123' },
		});

		const result = matchesConditions(request, [{ type: 'cookie', key: 'session' }]);

		expect(result).toBe(true);
	});

	test('matches host condition', () => {
		const request = new Request('https://api.example.com/test');

		const result = matchesConditions(request, [
			{ type: 'host', key: '', value: 'api\\.example\\.com' },
		]);

		expect(result).toBe(true);
	});

	test('matches query condition', () => {
		const request = new Request('https://example.com/test?debug=true');

		const result = matchesConditions(request, [{ type: 'query', key: 'debug' }]);

		expect(result).toBe(true);
	});

	test('matches query with value', () => {
		const request = new Request('https://example.com/test?version=2');

		const result = matchesConditions(request, [{ type: 'query', key: 'version', value: '2' }]);

		expect(result).toBe(true);
	});

	test('handles missing conditions', () => {
		const request = new Request('https://example.com/test');

		const result = matchesConditions(request, undefined, [{ type: 'header', key: 'x-internal' }]);

		expect(result).toBe(true);
	});

	test('fails when missing condition is present', () => {
		const request = new Request('https://example.com/test', {
			headers: { 'x-internal': 'true' },
		});

		const result = matchesConditions(request, undefined, [{ type: 'header', key: 'x-internal' }]);

		expect(result).toBe(false);
	});
});

describe('executeMiddleware', () => {
	test('executes middleware handler', async () => {
		const handler = async () => {
			return new Response('handled');
		};

		const result = await executeMiddleware(new Request('https://example.com/test'), handler);

		expect(result.continue).toBe(false);
		expect(result.response).toBeInstanceOf(Response);
	});

	test('handles next response', async () => {
		const handler = async () => {
			return new Response(null, {
				headers: { 'x-middleware-next': '1' },
			});
		};

		const result = await executeMiddleware(new Request('https://example.com/test'), handler);

		expect(result.continue).toBe(true);
	});

	test('handles rewrite response', async () => {
		const handler = async () => {
			return new Response(null, {
				headers: { 'x-middleware-rewrite': 'https://example.com/new-path' },
			});
		};

		const result = await executeMiddleware(new Request('https://example.com/test'), handler);

		expect(result.continue).toBe(true);
		expect(result.rewriteTo).toBe('https://example.com/new-path');
	});

	test('handles redirect response', async () => {
		const handler = async () => {
			return new Response(null, {
				status: 307,
				headers: { location: 'https://example.com/login' },
			});
		};

		const result = await executeMiddleware(new Request('https://example.com/test'), handler);

		expect(result.continue).toBe(false);
		expect(result.response?.status).toBe(307);
	});

	test('handles undefined return', async () => {
		const handler = async () => {
			return undefined;
		};

		const result = await executeMiddleware(new Request('https://example.com/test'), handler);

		expect(result.continue).toBe(true);
	});

	test('handles errors gracefully', async () => {
		const handler = async () => {
			throw new Error('Middleware error');
		};

		const result = await executeMiddleware(new Request('https://example.com/test'), handler);

		expect(result.continue).toBe(false);
		expect(result.response?.status).toBe(500);
	});

	test('applies basePath option', async () => {
		let receivedRequest: Request | null = null;

		const handler = async (request: Request) => {
			receivedRequest = request;
			return undefined;
		};

		await executeMiddleware(new Request('https://example.com/api/test'), handler, {
			basePath: '/api',
		});

		expect(receivedRequest).not.toBeNull();
	});
});
