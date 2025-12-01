import { describe, expect, it } from 'bun:test';
import {
	compileMatcher,
	compileMatchers,
	createExcludeMatcher,
	createMiddlewareMatcher,
} from '../src/matchers.js';

describe('compileMatcher', () => {
	describe('exact match', () => {
		it('should match exact path', () => {
			const matcher = compileMatcher('/api/users');
			expect(matcher('/api/users')).toBe(true);
			expect(matcher('/api/users/')).toBe(false);
			expect(matcher('/api/user')).toBe(false);
		});
	});

	describe('parameter patterns', () => {
		it('should match :param patterns', () => {
			const matcher = compileMatcher('/api/users/:id');
			expect(matcher('/api/users/123')).toBe(true);
			expect(matcher('/api/users/abc')).toBe(true);
			expect(matcher('/api/users')).toBe(false);
			expect(matcher('/api/users/123/posts')).toBe(false);
		});

		it('should match multiple params', () => {
			const matcher = compileMatcher('/api/:resource/:id');
			expect(matcher('/api/users/123')).toBe(true);
			expect(matcher('/api/posts/456')).toBe(true);
			expect(matcher('/api/users')).toBe(false);
		});
	});

	describe('wildcard patterns', () => {
		it('should match * wildcard', () => {
			const matcher = compileMatcher('/api/*');
			expect(matcher('/api/')).toBe(true);
			expect(matcher('/api/users')).toBe(true);
			expect(matcher('/api/users/123')).toBe(true);
		});

		it('should match :path* pattern', () => {
			const matcher = compileMatcher('/:path*');
			expect(matcher('/')).toBe(true);
			expect(matcher('/api')).toBe(true);
			expect(matcher('/api/users/123')).toBe(true);
		});
	});

	describe('regex patterns', () => {
		it('should match regex directly', () => {
			const matcher = compileMatcher(/^\/api\/v\d+/);
			expect(matcher('/api/v1')).toBe(true);
			expect(matcher('/api/v2/users')).toBe(true);
			expect(matcher('/api/users')).toBe(false);
		});
	});

	describe('matcher config', () => {
		it('should match with source pattern', () => {
			const matcher = compileMatcher({
				source: '/api/:path*',
			});
			expect(matcher('/api/users')).toBe(true);
		});

		it('should check has header condition', () => {
			const matcher = compileMatcher({
				source: '/api/:path*',
				has: [{ type: 'header', key: 'authorization' }],
			});

			const withAuth = new Request('https://example.com/api/test', {
				headers: { Authorization: 'Bearer token' },
			});
			const withoutAuth = new Request('https://example.com/api/test');

			expect(matcher('/api/test', withAuth)).toBe(true);
			expect(matcher('/api/test', withoutAuth)).toBe(false);
		});

		it('should check missing header condition', () => {
			const matcher = compileMatcher({
				source: '/public/:path*',
				missing: [{ type: 'header', key: 'authorization' }],
			});

			const withAuth = new Request('https://example.com/public/data', {
				headers: { Authorization: 'Bearer token' },
			});
			const withoutAuth = new Request('https://example.com/public/data');

			expect(matcher('/public/data', withAuth)).toBe(false);
			expect(matcher('/public/data', withoutAuth)).toBe(true);
		});
	});
});

describe('compileMatchers', () => {
	it('should match any of multiple patterns', () => {
		const matcher = compileMatchers(['/api/:path*', '/graphql']);
		expect(matcher('/api/users')).toBe(true);
		expect(matcher('/graphql')).toBe(true);
		expect(matcher('/web')).toBe(false);
	});

	it('should handle single pattern', () => {
		const matcher = compileMatchers('/api/:path*');
		expect(matcher('/api/test')).toBe(true);
	});
});

describe('createExcludeMatcher', () => {
	it('should return true for non-excluded paths', () => {
		const matcher = createExcludeMatcher(['/_next/*', '/static/*']);
		expect(matcher('/api/users')).toBe(true);
		expect(matcher('/page')).toBe(true);
	});

	it('should return false for excluded paths', () => {
		const matcher = createExcludeMatcher(['/_next/*', '/static/*']);
		expect(matcher('/_next/static/chunk.js')).toBe(false);
		expect(matcher('/static/image.png')).toBe(false);
	});
});

describe('createMiddlewareMatcher', () => {
	it('should include matching paths and exclude defaults', () => {
		const matcher = createMiddlewareMatcher(['/:path*']);
		expect(matcher('/api/users')).toBe(true);
		expect(matcher('/page')).toBe(true);
		expect(matcher('/_next/static/chunk.js')).toBe(false);
		expect(matcher('/favicon.ico')).toBe(false);
	});

	it('should allow custom exclusions', () => {
		const matcher = createMiddlewareMatcher(['/api/:path*'], {
			excludePatterns: ['/api/public/:path*'],
			includeDefaultExclusions: false,
		});
		expect(matcher('/api/users')).toBe(true);
		expect(matcher('/api/public/data')).toBe(false);
	});
});
