import { describe, expect, it } from 'bun:test';
import { RequestCookies, ResponseCookies } from '../src/cookies.js';

describe('RequestCookies', () => {
	describe('parsing', () => {
		it('should parse cookie header', () => {
			const headers = new Headers({ Cookie: 'a=1; b=2; c=3' });
			const cookies = new RequestCookies(headers);
			expect(cookies.get('a')?.value).toBe('1');
			expect(cookies.get('b')?.value).toBe('2');
			expect(cookies.get('c')?.value).toBe('3');
		});

		it('should handle empty cookie header', () => {
			const headers = new Headers();
			const cookies = new RequestCookies(headers);
			expect(cookies.size).toBe(0);
		});

		it('should handle URL-encoded values', () => {
			const headers = new Headers({ Cookie: 'data=%7B%22foo%22%3A%22bar%22%7D' });
			const cookies = new RequestCookies(headers);
			expect(cookies.get('data')?.value).toBe('{"foo":"bar"}');
		});
	});

	describe('get()', () => {
		it('should return cookie object', () => {
			const headers = new Headers({ Cookie: 'session=abc123' });
			const cookies = new RequestCookies(headers);
			const cookie = cookies.get('session');
			expect(cookie).toEqual({ name: 'session', value: 'abc123' });
		});

		it('should return undefined for missing cookie', () => {
			const headers = new Headers({ Cookie: 'a=1' });
			const cookies = new RequestCookies(headers);
			expect(cookies.get('missing')).toBeUndefined();
		});
	});

	describe('getAll()', () => {
		it('should return all cookies with name', () => {
			const headers = new Headers({ Cookie: 'a=1' });
			const cookies = new RequestCookies(headers);
			const all = cookies.getAll('a');
			expect(all).toHaveLength(1);
			expect(all[0]).toEqual({ name: 'a', value: '1' });
		});

		it('should return all cookies when no name provided', () => {
			const headers = new Headers({ Cookie: 'a=1; b=2' });
			const cookies = new RequestCookies(headers);
			const all = cookies.getAll();
			expect(all).toHaveLength(2);
		});
	});

	describe('has()', () => {
		it('should check cookie existence', () => {
			const headers = new Headers({ Cookie: 'exists=yes' });
			const cookies = new RequestCookies(headers);
			expect(cookies.has('exists')).toBe(true);
			expect(cookies.has('missing')).toBe(false);
		});
	});

	describe('iteration', () => {
		it('should be iterable', () => {
			const headers = new Headers({ Cookie: 'a=1; b=2' });
			const cookies = new RequestCookies(headers);
			const entries = [...cookies];
			expect(entries).toHaveLength(2);
		});

		it('should support keys()', () => {
			const headers = new Headers({ Cookie: 'x=1; y=2' });
			const cookies = new RequestCookies(headers);
			const keys = [...cookies.keys()];
			expect(keys).toContain('x');
			expect(keys).toContain('y');
		});

		it('should support values()', () => {
			const headers = new Headers({ Cookie: 'k=v1' });
			const cookies = new RequestCookies(headers);
			const values = [...cookies.values()];
			expect(values[0]).toEqual({ name: 'k', value: 'v1' });
		});
	});
});

describe('ResponseCookies', () => {
	describe('set()', () => {
		it('should set a cookie', () => {
			const headers = new Headers();
			const cookies = new ResponseCookies(headers);
			cookies.set('name', 'value');
			expect(headers.get('Set-Cookie')).toContain('name=value');
		});

		it('should set cookie with options', () => {
			const headers = new Headers();
			const cookies = new ResponseCookies(headers);
			cookies.set('secure', 'data', {
				httpOnly: true,
				secure: true,
				sameSite: 'strict',
				maxAge: 3600,
				path: '/api',
			});
			const setCookie = headers.get('Set-Cookie');
			expect(setCookie).toBeDefined();
			expect(setCookie).toContain('secure=data');
			expect(setCookie).toContain('HttpOnly');
			expect(setCookie).toContain('Secure');
			expect(setCookie?.toLowerCase()).toContain('samesite=strict');
			expect(setCookie).toContain('Max-Age=3600');
			expect(setCookie).toContain('Path=/api');
		});

		it('should handle expires date', () => {
			const headers = new Headers();
			const cookies = new ResponseCookies(headers);
			const expires = new Date('2025-12-31T23:59:59Z');
			cookies.set('expiring', 'soon', { expires });
			const setCookie = headers.get('Set-Cookie');
			expect(setCookie).toBeDefined();
			expect(setCookie).toContain('Expires=');
		});
	});

	describe('delete()', () => {
		it('should delete a cookie', () => {
			const headers = new Headers();
			const cookies = new ResponseCookies(headers);
			cookies.delete('session');
			const setCookie = headers.get('Set-Cookie');
			expect(setCookie).toBeDefined();
			expect(setCookie).toContain('session=');
			expect(setCookie).toContain('Max-Age=0');
		});

		it('should delete with path', () => {
			const headers = new Headers();
			const cookies = new ResponseCookies(headers);
			cookies.delete({ name: 'token', path: '/api' });
			const setCookie = headers.get('Set-Cookie');
			expect(setCookie).toBeDefined();
			expect(setCookie).toContain('Path=/api');
		});
	});

	describe('get()', () => {
		it('should return set cookie', () => {
			const headers = new Headers();
			const cookies = new ResponseCookies(headers);
			cookies.set('test', 'value');
			const cookie = cookies.get('test');
			expect(cookie?.value).toBe('value');
		});
	});

	describe('multiple cookies', () => {
		it('should handle multiple Set-Cookie headers', () => {
			const headers = new Headers();
			const cookies = new ResponseCookies(headers);
			cookies.set('a', '1');
			cookies.set('b', '2');
			const all = cookies.getAll();
			expect(all).toHaveLength(2);
		});
	});
});
