import { describe, expect, it } from 'bun:test';
import {
	SECURITY_HEADERS,
	applyHeadersToResponse,
	createCorsHeaders,
	createHeadersObject,
	mergeHeaderResults,
	processHeaders,
} from '../src/headers.js';
import type { NextHeader } from '../src/types.js';

describe('processHeaders', () => {
	it('matches simple header rule', () => {
		const request = new Request('https://example.com/api/test');
		const rules: NextHeader[] = [
			{
				source: '/api/:path*',
				headers: [{ key: 'X-Custom', value: 'test-value' }],
			},
		];

		const result = processHeaders(request, rules);
		expect(result.headers).toHaveLength(1);
		expect(result.headers[0]).toEqual({ key: 'X-Custom', value: 'test-value' });
		expect(result.matchedRules).toHaveLength(1);
	});

	it('accumulates multiple matching rules', () => {
		const request = new Request('https://example.com/api/users');
		const rules: NextHeader[] = [
			{
				source: '/api/:path*',
				headers: [{ key: 'X-API', value: 'true' }],
			},
			{
				source: '/api/users',
				headers: [{ key: 'X-Users', value: 'true' }],
			},
		];

		const result = processHeaders(request, rules);
		expect(result.headers).toHaveLength(2);
		expect(result.matchedRules).toHaveLength(2);
	});

	it('applies params to header values', () => {
		const request = new Request('https://example.com/api/v2/users');
		const rules: NextHeader[] = [
			{
				source: '/api/:version/:path*',
				headers: [{ key: 'X-Version', value: ':version' }],
			},
		];

		const result = processHeaders(request, rules);
		expect(result.headers[0]).toEqual({ key: 'X-Version', value: 'v2' });
	});

	it('respects has conditions', () => {
		const request = new Request('https://example.com/api', {
			headers: { 'X-Auth': 'token' },
		});
		const rules: NextHeader[] = [
			{
				source: '/api',
				headers: [{ key: 'X-Authenticated', value: 'true' }],
				has: [{ type: 'header', key: 'X-Auth' }],
			},
		];

		const result = processHeaders(request, rules);
		expect(result.headers).toHaveLength(1);

		// Without the header
		const request2 = new Request('https://example.com/api');
		const result2 = processHeaders(request2, rules);
		expect(result2.headers).toHaveLength(0);
	});

	it('respects missing conditions', () => {
		const request = new Request('https://example.com/api');
		const rules: NextHeader[] = [
			{
				source: '/api',
				headers: [{ key: 'X-Public', value: 'true' }],
				missing: [{ type: 'cookie', key: 'session' }],
			},
		];

		const result = processHeaders(request, rules);
		expect(result.headers).toHaveLength(1);
	});

	it('returns empty when no rules match', () => {
		const request = new Request('https://example.com/other');
		const rules: NextHeader[] = [
			{
				source: '/api/:path*',
				headers: [{ key: 'X-API', value: 'true' }],
			},
		];

		const result = processHeaders(request, rules);
		expect(result.headers).toHaveLength(0);
		expect(result.matchedRules).toHaveLength(0);
	});
});

describe('applyHeadersToResponse', () => {
	it('adds headers to response', () => {
		const response = new Response('test');
		const newResponse = applyHeadersToResponse(response, [
			{ key: 'X-Custom', value: 'value1' },
			{ key: 'X-Another', value: 'value2' },
		]);

		expect(newResponse.headers.get('X-Custom')).toBe('value1');
		expect(newResponse.headers.get('X-Another')).toBe('value2');
	});

	it('preserves original response body and status', async () => {
		const response = new Response('test body', { status: 201 });
		const newResponse = applyHeadersToResponse(response, [{ key: 'X-Custom', value: 'value' }]);

		expect(newResponse.status).toBe(201);
		expect(await newResponse.text()).toBe('test body');
	});
});

describe('createHeadersObject', () => {
	it('creates Headers from result', () => {
		const result = {
			headers: [
				{ key: 'X-Custom', value: 'value1' },
				{ key: 'X-Another', value: 'value2' },
			],
			matchedRules: [],
		};

		const headers = createHeadersObject(result);
		expect(headers.get('X-Custom')).toBe('value1');
		expect(headers.get('X-Another')).toBe('value2');
	});
});

describe('mergeHeaderResults', () => {
	it('merges multiple results', () => {
		const result1 = {
			headers: [{ key: 'X-First', value: 'value1' }],
			matchedRules: [],
		};
		const result2 = {
			headers: [{ key: 'X-Second', value: 'value2' }],
			matchedRules: [],
		};

		const merged = mergeHeaderResults(result1, result2);
		expect(merged.headers).toHaveLength(2);
	});

	it('later values override earlier for same key', () => {
		const result1 = {
			headers: [{ key: 'X-Custom', value: 'first' }],
			matchedRules: [],
		};
		const result2 = {
			headers: [{ key: 'X-Custom', value: 'second' }],
			matchedRules: [],
		};

		const merged = mergeHeaderResults(result1, result2);
		expect(merged.headers).toHaveLength(1);
		expect(merged.headers[0].value).toBe('second');
	});
});

describe('SECURITY_HEADERS', () => {
	it('contains expected security headers', () => {
		expect(SECURITY_HEADERS.length).toBeGreaterThan(0);

		const headerKeys = SECURITY_HEADERS.map((h) => h.key);
		expect(headerKeys).toContain('X-Content-Type-Options');
		expect(headerKeys).toContain('X-Frame-Options');
		expect(headerKeys).toContain('Strict-Transport-Security');
	});
});

describe('createCorsHeaders', () => {
	it('creates default CORS headers', () => {
		const headers = createCorsHeaders();
		const headerMap = new Map(headers.map((h) => [h.key, h.value]));

		expect(headerMap.get('Access-Control-Allow-Origin')).toBe('*');
		expect(headerMap.get('Access-Control-Allow-Methods')).toContain('GET');
	});

	it('creates custom CORS headers', () => {
		const headers = createCorsHeaders({
			origin: 'https://example.com',
			methods: ['GET', 'POST'],
			headers: ['Content-Type'],
			credentials: true,
			maxAge: 86400,
		});
		const headerMap = new Map(headers.map((h) => [h.key, h.value]));

		expect(headerMap.get('Access-Control-Allow-Origin')).toBe('https://example.com');
		expect(headerMap.get('Access-Control-Allow-Methods')).toBe('GET, POST');
		expect(headerMap.get('Access-Control-Allow-Headers')).toBe('Content-Type');
		expect(headerMap.get('Access-Control-Allow-Credentials')).toBe('true');
		expect(headerMap.get('Access-Control-Max-Age')).toBe('86400');
	});
});
