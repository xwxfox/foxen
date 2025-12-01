import { describe, expect, it } from 'bun:test';
import { applyParams, matchConditions, matchPath, parsePath } from '../src/matcher.js';

describe('parsePath', () => {
	it('parses static paths', () => {
		const segments = parsePath('/users/profile');
		expect(segments).toHaveLength(2);
		expect(segments[0].type).toBe('static');
		expect(segments[0].raw).toBe('users');
		expect(segments[1].type).toBe('static');
		expect(segments[1].raw).toBe('profile');
	});

	it('parses dynamic params :param', () => {
		const segments = parsePath('/users/:id');
		expect(segments).toHaveLength(2);
		expect(segments[1].type).toBe('param');
		expect(segments[1].name).toBe('id');
	});

	it('parses catch-all :param*', () => {
		const segments = parsePath('/docs/:path*');
		expect(segments).toHaveLength(2);
		expect(segments[1].type).toBe('catch-all');
		expect(segments[1].name).toBe('path');
	});

	it('parses Next.js style [param]', () => {
		const segments = parsePath('/users/[id]');
		expect(segments).toHaveLength(2);
		expect(segments[1].type).toBe('param');
		expect(segments[1].name).toBe('id');
	});

	it('parses Next.js style [...param]', () => {
		const segments = parsePath('/docs/[...slug]');
		expect(segments).toHaveLength(2);
		expect(segments[1].type).toBe('catch-all');
		expect(segments[1].name).toBe('slug');
	});

	it('parses Next.js style [[...param]]', () => {
		const segments = parsePath('/docs/[[...slug]]');
		expect(segments).toHaveLength(2);
		expect(segments[1].type).toBe('optional-catch-all');
		expect(segments[1].name).toBe('slug');
	});

	it('parses route groups (admin)', () => {
		const segments = parsePath('/(admin)/users');
		expect(segments).toHaveLength(2);
		expect(segments[0].type).toBe('group');
		expect(segments[1].type).toBe('static');
	});
});

describe('matchPath', () => {
	it('matches simple static paths', () => {
		const result = matchPath('/users', '/users');
		expect(result.matched).toBe(true);
		expect(result.params).toEqual({});
	});

	it('does not match different static paths', () => {
		const result = matchPath('/users', '/posts');
		expect(result.matched).toBe(false);
	});

	it('matches dynamic params', () => {
		const result = matchPath('/users/123', '/users/:id');
		expect(result.matched).toBe(true);
		expect(result.params).toEqual({ id: '123' });
	});

	it('matches multiple dynamic params', () => {
		const result = matchPath('/users/123/posts/456', '/users/:userId/posts/:postId');
		expect(result.matched).toBe(true);
		expect(result.params).toEqual({ userId: '123', postId: '456' });
	});

	it('matches catch-all with zero segments', () => {
		const result = matchPath('/docs', '/docs/:path*');
		expect(result.matched).toBe(true);
		expect(result.params).toEqual({ path: [] });
	});

	it('matches catch-all with multiple segments', () => {
		const result = matchPath('/docs/a/b/c', '/docs/:path*');
		expect(result.matched).toBe(true);
		expect(result.params).toEqual({ path: ['a', 'b', 'c'] });
	});

	it('matches Next.js style [param]', () => {
		const result = matchPath('/users/123', '/users/[id]');
		expect(result.matched).toBe(true);
		expect(result.params).toEqual({ id: '123' });
	});

	it('matches Next.js style [...slug]', () => {
		const result = matchPath('/docs/a/b', '/docs/[...slug]');
		expect(result.matched).toBe(true);
		expect(result.params).toEqual({ slug: ['a', 'b'] });
	});

	it('matches Next.js style [[...slug]] with segments', () => {
		const result = matchPath('/docs/a/b', '/docs/[[...slug]]');
		expect(result.matched).toBe(true);
		expect(result.params).toEqual({ slug: ['a', 'b'] });
	});

	it('matches Next.js style [[...slug]] without segments', () => {
		const result = matchPath('/docs', '/docs/[[...slug]]');
		expect(result.matched).toBe(true);
		expect(result.params).toEqual({ slug: [] });
	});

	it('ignores route groups in matching', () => {
		const result = matchPath('/users', '/(admin)/users');
		expect(result.matched).toBe(true);
	});

	it('handles basePath option', () => {
		const result = matchPath('/api/users', '/users', { basePath: '/api' });
		expect(result.matched).toBe(true);
	});

	it('handles trailing slashes', () => {
		const result1 = matchPath('/users/', '/users');
		expect(result1.matched).toBe(true);

		const result2 = matchPath('/users', '/users/');
		expect(result2.matched).toBe(true);
	});
});

describe('applyParams', () => {
	it('replaces simple params', () => {
		const result = applyParams('/users/:id', { id: '123' });
		expect(result).toBe('/users/123');
	});

	it('replaces multiple params', () => {
		const result = applyParams('/users/:userId/posts/:postId', { userId: '123', postId: '456' });
		expect(result).toBe('/users/123/posts/456');
	});

	it('replaces catch-all params', () => {
		const result = applyParams('/docs/:path*', { path: ['a', 'b', 'c'] });
		expect(result).toBe('/docs/a/b/c');
	});

	it('applies captures from conditions', () => {
		const result = applyParams('/api/:version', { version: 'v1' }, { token: 'abc' });
		expect(result).toBe('/api/v1');
	});

	it('captures override params', () => {
		const result = applyParams('/api/:version', { version: 'v1' }, { version: 'v2' });
		expect(result).toBe('/api/v2');
	});
});

describe('matchConditions', () => {
	it('matches when no conditions', () => {
		const request = new Request('https://example.com/test');
		const result = matchConditions(request);
		expect(result.matches).toBe(true);
	});

	it('matches header existence', () => {
		const request = new Request('https://example.com/test', {
			headers: { 'x-auth-token': 'secret' },
		});
		const result = matchConditions(request, [{ type: 'header', key: 'x-auth-token' }]);
		expect(result.matches).toBe(true);
	});

	it('fails when header missing', () => {
		const request = new Request('https://example.com/test');
		const result = matchConditions(request, [{ type: 'header', key: 'x-auth-token' }]);
		expect(result.matches).toBe(false);
	});

	it('matches header value', () => {
		const request = new Request('https://example.com/test', {
			headers: { 'x-version': 'v2' },
		});
		const result = matchConditions(request, [{ type: 'header', key: 'x-version', value: 'v2' }]);
		expect(result.matches).toBe(true);
	});

	it('matches header value with regex', () => {
		const request = new Request('https://example.com/test', {
			headers: { 'x-version': 'v2.3.4' },
		});
		const result = matchConditions(request, [
			{ type: 'header', key: 'x-version', value: 'v\\d+\\.\\d+\\.\\d+' },
		]);
		expect(result.matches).toBe(true);
	});

	it('extracts captures from regex', () => {
		const request = new Request('https://example.com/test', {
			headers: { 'x-user': 'user-123' },
		});
		const result = matchConditions(request, [
			{ type: 'header', key: 'x-user', value: 'user-(?<id>\\d+)' },
		]);
		expect(result.matches).toBe(true);
		expect(result.captures).toEqual({ id: '123' });
	});

	it('matches query params', () => {
		const request = new Request('https://example.com/test?page=5');
		const result = matchConditions(request, [{ type: 'query', key: 'page' }]);
		expect(result.matches).toBe(true);
	});

	it('matches query param value', () => {
		const request = new Request('https://example.com/test?page=5');
		const result = matchConditions(request, [{ type: 'query', key: 'page', value: '\\d+' }]);
		expect(result.matches).toBe(true);
	});

	it('matches cookies', () => {
		const request = new Request('https://example.com/test', {
			headers: { cookie: 'session=abc123' },
		});
		const result = matchConditions(request, [{ type: 'cookie', key: 'session' }]);
		expect(result.matches).toBe(true);
	});

	it('matches host', () => {
		const request = new Request('https://api.example.com/test');
		const result = matchConditions(request, [
			{ type: 'host', key: '', value: 'api\\.example\\.com' },
		]);
		expect(result.matches).toBe(true);
	});

	it('handles missing conditions', () => {
		const request = new Request('https://example.com/test');
		const result = matchConditions(request, undefined, [{ type: 'header', key: 'x-internal' }]);
		expect(result.matches).toBe(true);
	});

	it('fails missing condition when header present', () => {
		const request = new Request('https://example.com/test', {
			headers: { 'x-internal': 'true' },
		});
		const result = matchConditions(request, undefined, [{ type: 'header', key: 'x-internal' }]);
		expect(result.matches).toBe(false);
	});

	it('combines has and missing conditions', () => {
		const request = new Request('https://example.com/test', {
			headers: { 'x-auth': 'token' },
		});
		const result = matchConditions(
			request,
			[{ type: 'header', key: 'x-auth' }],
			[{ type: 'header', key: 'x-internal' }],
		);
		expect(result.matches).toBe(true);
	});
});
