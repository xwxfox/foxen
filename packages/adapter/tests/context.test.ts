import { describe, expect, it } from 'bun:test';
import {
	createNextRequest,
	createParamsPromise,
	extractGeoFromHeaders,
	extractIPFromHeaders,
	getFoxenContext,
	normalizeParams,
	setFoxenContext,
	updateFoxenContext,
} from '../src/context.js';

describe('extractIPFromHeaders', () => {
	it('should extract IP from x-forwarded-for', () => {
		const headers = new Headers({
			'x-forwarded-for': '1.2.3.4, 5.6.7.8',
		});
		expect(extractIPFromHeaders(headers)).toBe('1.2.3.4');
	});

	it('should extract IP from x-real-ip', () => {
		const headers = new Headers({
			'x-real-ip': '10.0.0.1',
		});
		expect(extractIPFromHeaders(headers)).toBe('10.0.0.1');
	});

	it('should extract IP from cf-connecting-ip', () => {
		const headers = new Headers({
			'cf-connecting-ip': '192.168.1.1',
		});
		expect(extractIPFromHeaders(headers)).toBe('192.168.1.1');
	});

	it('should prefer x-forwarded-for over x-real-ip', () => {
		const headers = new Headers({
			'x-forwarded-for': '1.1.1.1',
			'x-real-ip': '2.2.2.2',
		});
		expect(extractIPFromHeaders(headers)).toBe('1.1.1.1');
	});

	it('should return undefined when no IP headers present', () => {
		const headers = new Headers({
			'content-type': 'application/json',
		});
		expect(extractIPFromHeaders(headers)).toBeUndefined();
	});

	it('should handle IPv6 addresses', () => {
		const headers = new Headers({
			'x-forwarded-for': '2001:db8::1',
		});
		expect(extractIPFromHeaders(headers)).toBe('2001:db8::1');
	});
});

describe('extractGeoFromHeaders', () => {
	it('should extract geo from Vercel headers', () => {
		const headers = new Headers({
			'x-vercel-ip-country': 'US',
			'x-vercel-ip-country-region': 'CA',
			'x-vercel-ip-city': 'San Francisco',
			'x-vercel-ip-latitude': '37.7749',
			'x-vercel-ip-longitude': '-122.4194',
		});
		const geo = extractGeoFromHeaders(headers);
		expect(geo).toEqual({
			country: 'US',
			region: 'CA',
			city: 'San Francisco',
			latitude: '37.7749',
			longitude: '-122.4194',
		});
	});

	it('should extract geo from Cloudflare headers', () => {
		const headers = new Headers({
			'cf-ipcountry': 'GB',
			'cf-ipcity': 'London',
		});
		const geo = extractGeoFromHeaders(headers);
		expect(geo?.country).toBe('GB');
		expect(geo?.city).toBe('London');
	});

	it('should return undefined when no geo headers present', () => {
		const headers = new Headers({
			'content-type': 'application/json',
		});
		expect(extractGeoFromHeaders(headers)).toBeUndefined();
	});

	it('should decode URL-encoded city names', () => {
		const headers = new Headers({
			'x-vercel-ip-country': 'DE',
			'x-vercel-ip-city': 'M%C3%BCnchen', // München
		});
		const geo = extractGeoFromHeaders(headers);
		expect(geo?.city).toBe('München');
	});
});

describe('createNextRequest', () => {
	it('should create NextRequest from regular Request', () => {
		const request = new Request('https://example.com/api/users');
		const nextRequest = createNextRequest(request);

		expect(nextRequest).toBeDefined();
		expect(nextRequest.url).toBe('https://example.com/api/users');
	});

	it('should apply basePath option', () => {
		const request = new Request('https://example.com/api/users');
		const nextRequest = createNextRequest(request, { basePath: '/api' });

		expect(nextRequest.nextUrl.basePath).toBe('/api');
	});

	it('should extract IP from headers', () => {
		const request = new Request('https://example.com/api/users', {
			headers: { 'x-forwarded-for': '1.2.3.4' },
		});
		const nextRequest = createNextRequest(request);

		expect(nextRequest.ip).toBe('1.2.3.4');
	});

	it('should extract geo from headers', () => {
		const request = new Request('https://example.com/api/users', {
			headers: { 'x-vercel-ip-country': 'US' },
		});
		const nextRequest = createNextRequest(request);

		expect(nextRequest.geo?.country).toBe('US');
	});
});

describe('createParamsPromise', () => {
	it('should create a promise that resolves to params', async () => {
		const params = { id: '123', name: 'test' };
		const promise = createParamsPromise(params);

		const resolved = await promise;
		expect(resolved).toEqual(params);
	});

	it('should allow direct access to params', () => {
		const params = { id: '123', name: 'test' };
		const promise = createParamsPromise(params);

		expect(promise.id).toBe('123');
		expect(promise.name).toBe('test');
	});

	it('should handle array values', async () => {
		const params = { slug: ['a', 'b', 'c'] };
		const promise = createParamsPromise(params);

		expect(promise.slug).toEqual(['a', 'b', 'c']);
		const resolved = await promise;
		expect(resolved.slug).toEqual(['a', 'b', 'c']);
	});
});

describe('normalizeParams', () => {
	it('should normalize simple params', () => {
		const params = { id: '123', name: 'test' };
		const normalized = normalizeParams(params);

		expect(normalized).toEqual({ id: '123', name: 'test' });
	});

	it('should convert wildcard to named catch-all', () => {
		const params = { '*': 'a/b/c' };
		const normalized = normalizeParams(params, 'slug');

		expect(normalized.slug).toEqual(['a', 'b', 'c']);
	});

	it('should handle empty wildcard', () => {
		const params = { '*': '' };
		const normalized = normalizeParams(params, 'slug');

		expect(normalized.slug).toEqual([]);
	});

	it('should keep wildcard as * if no name provided', () => {
		const params = { '*': 'a/b' };
		const normalized = normalizeParams(params);

		expect(normalized['*']).toEqual(['a', 'b']);
	});

	it('should filter undefined values', () => {
		const params = { id: '123', name: undefined };
		const normalized = normalizeParams(params);

		expect(normalized).toEqual({ id: '123' });
	});
});

describe('Foxen context helpers', () => {
	it('should set and get context', () => {
		const ctx = {};
		setFoxenContext(ctx, { _basePath: '/api' });

		const foxenCtx = getFoxenContext(ctx);
		expect(foxenCtx._basePath).toBe('/api');
	});

	it('should update existing context', () => {
		const ctx = {};
		setFoxenContext(ctx, { _basePath: '/api' });
		updateFoxenContext(ctx, { _ip: '1.2.3.4' });

		const foxenCtx = getFoxenContext(ctx);
		expect(foxenCtx._basePath).toBe('/api');
		expect(foxenCtx._ip).toBe('1.2.3.4');
	});

	it('should initialize empty context if not exists', () => {
		const ctx = {};
		const foxenCtx = getFoxenContext(ctx);

		expect(foxenCtx).toEqual({});
	});
});
