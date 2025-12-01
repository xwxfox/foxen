import { describe, expect, it } from 'bun:test';
import { NextRequest } from '../src/request.js';

describe('NextRequest', () => {
	describe('constructor', () => {
		it('should create from URL string', () => {
			const req = new NextRequest('https://example.com/api/test');
			expect(req.url).toBe('https://example.com/api/test');
			expect(req.method).toBe('GET');
		});

		it('should create from URL object', () => {
			const url = new URL('https://example.com/api/test?foo=bar');
			const req = new NextRequest(url);
			expect(req.nextUrl.pathname).toBe('/api/test');
			expect(req.nextUrl.searchParams.get('foo')).toBe('bar');
		});

		it('should create from existing Request', () => {
			const original = new Request('https://example.com/api/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ hello: 'world' }),
			});
			const req = new NextRequest(original);
			expect(req.method).toBe('POST');
			expect(req.headers.get('Content-Type')).toBe('application/json');
		});

		it('should handle init options', () => {
			const req = new NextRequest('https://example.com/api/test', {
				method: 'PUT',
				headers: { Authorization: 'Bearer token' },
			});
			expect(req.method).toBe('PUT');
			expect(req.headers.get('Authorization')).toBe('Bearer token');
		});
	});

	describe('nextUrl', () => {
		it('should provide NextURL instance', () => {
			const req = new NextRequest('https://example.com/api/test?page=1');
			expect(req.nextUrl).toBeDefined();
			expect(req.nextUrl.pathname).toBe('/api/test');
			expect(req.nextUrl.searchParams.get('page')).toBe('1');
		});

		it('should handle basePath', () => {
			const req = new NextRequest('https://example.com/app/api/test', {
				nextConfig: { basePath: '/app' },
			});
			expect(req.nextUrl.basePath).toBe('/app');
		});
	});

	describe('cookies', () => {
		it('should parse cookies from header', () => {
			const req = new NextRequest('https://example.com/api/test', {
				headers: {
					Cookie: 'session=abc123; theme=dark',
				},
			});
			expect(req.cookies.get('session')?.value).toBe('abc123');
			expect(req.cookies.get('theme')?.value).toBe('dark');
		});

		it('should return empty cookies when no cookie header', () => {
			const req = new NextRequest('https://example.com/api/test');
			expect(req.cookies.size).toBe(0);
		});

		it('should check cookie existence with has()', () => {
			const req = new NextRequest('https://example.com/api/test', {
				headers: { Cookie: 'token=xyz' },
			});
			expect(req.cookies.has('token')).toBe(true);
			expect(req.cookies.has('missing')).toBe(false);
		});
	});

	describe('geo', () => {
		it('should parse geo from Vercel headers', () => {
			const req = new NextRequest('https://example.com/api/test', {
				headers: {
					'x-vercel-ip-country': 'US',
					'x-vercel-ip-city': 'San Francisco',
					'x-vercel-ip-latitude': '37.7749',
					'x-vercel-ip-longitude': '-122.4194',
				},
			});
			expect(req.geo?.country).toBe('US');
			expect(req.geo?.city).toBe('San Francisco');
			expect(req.geo?.latitude).toBe('37.7749');
			expect(req.geo?.longitude).toBe('-122.4194');
		});
	});

	describe('ip', () => {
		it('should extract IP from x-forwarded-for', () => {
			const req = new NextRequest('https://example.com/api/test', {
				headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
			});
			expect(req.ip).toBe('192.168.1.1');
		});

		it('should extract IP from x-real-ip', () => {
			const req = new NextRequest('https://example.com/api/test', {
				headers: { 'x-real-ip': '10.0.0.5' },
			});
			expect(req.ip).toBe('10.0.0.5');
		});
	});

	describe('clone', () => {
		it('should create a clone of the request', () => {
			const original = new NextRequest('https://example.com/api/test', {
				method: 'POST',
				headers: { 'X-Custom': 'value' },
			});
			const clone = original.clone();
			expect(clone.url).toBe(original.url);
			expect(clone.method).toBe(original.method);
			expect(clone.headers.get('X-Custom')).toBe('value');
		});
	});
});
