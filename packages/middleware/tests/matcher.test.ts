import { describe, expect, it } from 'bun:test';
import {
	compileMatchers,
	pathToRegex,
	shouldRunMiddleware,
	testPathMatch,
} from '../src/matcher.js';
import type { NormalizedMatcher } from '../src/types.js';

describe('pathToRegex', () => {
	it('should match simple paths', () => {
		const regex = pathToRegex('/api/users');
		expect(regex.test('/api/users')).toBe(true);
		expect(regex.test('/api/posts')).toBe(false);
	});

	it('should match required parameters', () => {
		const regex = pathToRegex('/api/users/:id');
		expect(regex.test('/api/users/123')).toBe(true);
		expect(regex.test('/api/users/abc')).toBe(true);
		expect(regex.test('/api/users/')).toBe(false);
		expect(regex.test('/api/users')).toBe(false);
	});

	it('should match optional parameters', () => {
		const regex = pathToRegex('/api/posts/:slug?');
		expect(regex.test('/api/posts/hello')).toBe(true);
		expect(regex.test('/api/posts/')).toBe(true);
		expect(regex.test('/api/posts')).toBe(false); // needs trailing slash for optional
	});

	it('should match wildcard parameters', () => {
		const regex = pathToRegex('/api/:path*');
		expect(regex.test('/api/')).toBe(true);
		expect(regex.test('/api/users')).toBe(true);
		expect(regex.test('/api/users/123/posts')).toBe(true);
	});

	it('should match one-or-more parameters', () => {
		const regex = pathToRegex('/api/:path+');
		expect(regex.test('/api/')).toBe(false);
		expect(regex.test('/api/users')).toBe(true);
		expect(regex.test('/api/users/123')).toBe(true);
	});

	it('should handle negative lookahead patterns', () => {
		const regex = pathToRegex('/((?!_next|api).*)');
		expect(regex.test('/')).toBe(true);
		expect(regex.test('/about')).toBe(true);
		expect(regex.test('/_next/static/chunk.js')).toBe(false);
		expect(regex.test('/api/users')).toBe(false);
	});
});

describe('testPathMatch', () => {
	it('should test path against pattern', () => {
		expect(testPathMatch('/api/users', '/api/users')).toBe(true);
		expect(testPathMatch('/api/users/123', '/api/users/:id')).toBe(true);
		expect(testPathMatch('/api/posts', '/api/users')).toBe(false);
	});
});

describe('shouldRunMiddleware', () => {
	it('should match simple patterns', () => {
		const matchers: NormalizedMatcher[] = [
			{ source: '/api/:path*', regex: pathToRegex('/api/:path*') },
		];

		const request = new Request('http://localhost/api/users');
		expect(shouldRunMiddleware(request, matchers)).toBe(true);
	});

	it('should not match excluded paths', () => {
		const matchers: NormalizedMatcher[] = [{ source: '/:path*', regex: pathToRegex('/:path*') }];

		// Static files should be skipped by default
		const staticRequest = new Request('http://localhost/favicon.ico');
		expect(shouldRunMiddleware(staticRequest, matchers)).toBe(false);

		const nextStaticRequest = new Request('http://localhost/_next/static/chunk.js');
		expect(shouldRunMiddleware(nextStaticRequest, matchers)).toBe(false);
	});

	it('should match with skipStatic disabled', () => {
		const matchers: NormalizedMatcher[] = [{ source: '/:path*', regex: pathToRegex('/:path*') }];

		const request = new Request('http://localhost/favicon.ico');
		expect(shouldRunMiddleware(request, matchers, { skipStatic: false })).toBe(true);
	});

	it('should handle has conditions', () => {
		const matchers: NormalizedMatcher[] = [
			{
				source: '/api/:path*',
				regex: pathToRegex('/api/:path*'),
				has: [{ type: 'header', key: 'x-custom-header' }],
			},
		];

		// Without header
		const requestWithoutHeader = new Request('http://localhost/api/users');
		expect(shouldRunMiddleware(requestWithoutHeader, matchers)).toBe(false);

		// With header
		const requestWithHeader = new Request('http://localhost/api/users', {
			headers: { 'x-custom-header': 'value' },
		});
		expect(shouldRunMiddleware(requestWithHeader, matchers)).toBe(true);
	});

	it('should handle missing conditions', () => {
		const matchers: NormalizedMatcher[] = [
			{
				source: '/api/:path*',
				regex: pathToRegex('/api/:path*'),
				missing: [{ type: 'header', key: 'x-skip-middleware' }],
			},
		];

		// Without skip header (middleware should run)
		const request = new Request('http://localhost/api/users');
		expect(shouldRunMiddleware(request, matchers)).toBe(true);

		// With skip header (middleware should not run)
		const requestWithSkip = new Request('http://localhost/api/users', {
			headers: { 'x-skip-middleware': 'true' },
		});
		expect(shouldRunMiddleware(requestWithSkip, matchers)).toBe(false);
	});

	it('should handle cookie conditions', () => {
		const matchers: NormalizedMatcher[] = [
			{
				source: '/dashboard/:path*',
				regex: pathToRegex('/dashboard/:path*'),
				has: [{ type: 'cookie', key: 'session' }],
			},
		];

		// Without cookie
		const requestWithoutCookie = new Request('http://localhost/dashboard/settings');
		expect(shouldRunMiddleware(requestWithoutCookie, matchers)).toBe(false);

		// With cookie
		const requestWithCookie = new Request('http://localhost/dashboard/settings', {
			headers: { cookie: 'session=abc123' },
		});
		expect(shouldRunMiddleware(requestWithCookie, matchers)).toBe(true);
	});

	it('should handle query conditions', () => {
		const matchers: NormalizedMatcher[] = [
			{
				source: '/api/:path*',
				regex: pathToRegex('/api/:path*'),
				has: [{ type: 'query', key: 'debug' }],
			},
		];

		// Without query
		const request = new Request('http://localhost/api/users');
		expect(shouldRunMiddleware(request, matchers)).toBe(false);

		// With query
		const requestWithQuery = new Request('http://localhost/api/users?debug=true');
		expect(shouldRunMiddleware(requestWithQuery, matchers)).toBe(true);
	});
});

describe('compileMatchers', () => {
	it('should compile string matchers', () => {
		const matchers = compileMatchers(['/api/:path*', '/admin/:path*']);
		expect(matchers).toHaveLength(2);
		//@ts-expect-error
		expect(matchers[0].source).toBe('/api/:path*');
		//@ts-expect-error
		expect(matchers[0].regex.test('/api/users')).toBe(true);
		//@ts-expect-error
		expect(matchers[1].source).toBe('/admin/:path*');
	});

	it('should compile object matchers with conditions', () => {
		const matchers = compileMatchers([
			{
				source: '/api/:path*',
				has: [{ type: 'header', key: 'authorization' }],
			},
		]);
		expect(matchers).toHaveLength(1);
		//@ts-expect-error
		expect(matchers[0].has).toBeDefined();
		//@ts-expect-error
		expect(matchers[0].has?.[0].key).toBe('authorization');
	});
});
