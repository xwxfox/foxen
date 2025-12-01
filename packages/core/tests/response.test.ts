import { describe, expect, it } from 'bun:test';
import { NextResponse } from '../src/response.js';

describe('NextResponse', () => {
	describe('json()', () => {
		it('should create JSON response', () => {
			const res = NextResponse.json({ hello: 'world' });
			expect(res.headers.get('Content-Type')).toContain('application/json');
		});

		it('should accept custom status', async () => {
			const res = NextResponse.json({ error: 'Not found' }, { status: 404 });
			expect(res.status).toBe(404);
			const data = await res.json();
			expect(data.error).toBe('Not found');
		});

		it('should accept custom headers', () => {
			const res = NextResponse.json({ data: 'test' }, { headers: { 'X-Custom': 'value' } });
			expect(res.headers.get('X-Custom')).toBe('value');
		});
	});

	describe('redirect()', () => {
		it('should create redirect response', () => {
			const res = NextResponse.redirect('https://example.com/new-page');
			expect(res.status).toBe(307);
			expect(res.headers.get('Location')).toBe('https://example.com/new-page');
		});

		it('should accept URL object', () => {
			const url = new URL('https://example.com/destination');
			const res = NextResponse.redirect(url);
			expect(res.headers.get('Location')).toBe('https://example.com/destination');
		});

		it('should accept custom status code', () => {
			const res = NextResponse.redirect('https://example.com/moved', 301);
			expect(res.status).toBe(301);
		});

		it('should default to 307 for temporary redirect', () => {
			const res = NextResponse.redirect('https://example.com/temp');
			expect(res.status).toBe(307);
		});
	});

	describe('rewrite()', () => {
		it('should create rewrite response', () => {
			const res = NextResponse.rewrite('https://example.com/internal');
			expect(res.headers.get('x-middleware-rewrite')).toBe('https://example.com/internal');
		});

		it('should accept URL object', () => {
			const url = new URL('https://api.example.com/v2/data');
			const res = NextResponse.rewrite(url);
			expect(res.headers.get('x-middleware-rewrite')).toBe('https://api.example.com/v2/data');
		});
	});

	describe('next()', () => {
		it('should create continue response', () => {
			const res = NextResponse.next();
			expect(res.headers.get('x-middleware-next')).toBe('1');
		});

		it('should allow setting request headers', () => {
			const res = NextResponse.next({
				request: {
					headers: new Headers({ 'x-user-id': '123' }),
				},
			});
			expect(res.headers.get('x-middleware-next')).toBe('1');
		});
	});

	describe('cookies', () => {
		it('should set cookies', () => {
			const res = new NextResponse();
			res.cookies.set('session', 'abc123');
			const setCookie = res.headers.get('Set-Cookie');
			expect(setCookie).toContain('session=abc123');
		});

		it('should set cookies with options', () => {
			const res = new NextResponse();
			res.cookies.set('token', 'xyz', {
				httpOnly: true,
				secure: true,
				maxAge: 3600,
				path: '/',
			});
			const setCookie = res.headers.get('Set-Cookie');
			expect(setCookie).toContain('token=xyz');
			expect(setCookie).toContain('HttpOnly');
			expect(setCookie).toContain('Secure');
			expect(setCookie).toContain('Max-Age=3600');
		});

		it('should delete cookies', () => {
			const res = new NextResponse();
			res.cookies.delete('session');
			const setCookie = res.headers.get('Set-Cookie');
			expect(setCookie).toContain('session=');
			expect(setCookie).toContain('Max-Age=0');
		});
	});

	describe('clone', () => {
		it('should create a clone of the response', async () => {
			const original = NextResponse.json({ data: 'test' }, { status: 201 });
			const clone = original.clone();
			expect(clone.status).toBe(201);
			const data = await clone.json();
			expect(data.data).toBe('test');
		});
	});
});
