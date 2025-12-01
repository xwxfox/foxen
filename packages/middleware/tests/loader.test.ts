import { describe, expect, it } from 'bun:test';
import { normalizeMatchers } from '../src/loader.js';
import type { MiddlewareConfig } from '../src/types.js';

// Note: loadMiddleware requires actual filesystem access which is harder to test
// These tests focus on normalizeMatchers which is the pure function

describe('normalizeMatchers', () => {
	it('should return default matcher when no config', () => {
		const matchers = normalizeMatchers();
		expect(matchers).toHaveLength(1);
		//@ts-expect-error
		expect(matchers[0].source).toContain('(?!_next');
	});

	it('should return default matcher when no matcher in config', () => {
		const config: MiddlewareConfig = { runtime: 'nodejs' };
		const matchers = normalizeMatchers(config);
		expect(matchers).toHaveLength(1);
	});

	it('should normalize string matcher', () => {
		const config: MiddlewareConfig = { matcher: '/api/:path*' };
		const matchers = normalizeMatchers(config);

		expect(matchers).toHaveLength(1);
		//@ts-expect-error
		expect(matchers[0].source).toBe('/api/:path*');
		//@ts-expect-error
		expect(matchers[0].regex.test('/api/users')).toBe(true);
	});

	it('should normalize string array matchers', () => {
		const config: MiddlewareConfig = {
			matcher: ['/api/:path*', '/admin/:path*'],
		};
		const matchers = normalizeMatchers(config);

		expect(matchers).toHaveLength(2);
		//@ts-expect-error
		expect(matchers[0].source).toBe('/api/:path*');
		//@ts-expect-error
		expect(matchers[1].source).toBe('/admin/:path*');
	});

	it('should normalize object matchers', () => {
		const config: MiddlewareConfig = {
			matcher: [
				{
					source: '/api/:path*',
					has: [{ type: 'header', key: 'authorization' }],
					missing: [{ type: 'cookie', key: 'skip' }],
				},
			],
		};
		const matchers = normalizeMatchers(config);

		expect(matchers).toHaveLength(1);
		//@ts-expect-error
		expect(matchers[0].has).toHaveLength(1);
		//@ts-expect-error
		expect(matchers[0].has?.[0].key).toBe('authorization');
		//@ts-expect-error
		expect(matchers[0].missing).toHaveLength(1);
		//@ts-expect-error
		expect(matchers[0].missing?.[0].key).toBe('skip');
	});

	it('should use custom regexp if provided', () => {
		const config: MiddlewareConfig = {
			matcher: [
				{
					source: '/api/:path*',
					regexp: '^/api/v[0-9]+/.*$',
				},
			],
		};
		const matchers = normalizeMatchers(config);

		//@ts-expect-error
		expect(matchers[0].regex.test('/api/v1/users')).toBe(true);
		//@ts-expect-error
		expect(matchers[0].regex.test('/api/users')).toBe(false);
	});

	it('should handle mixed string and object matchers', () => {
		const config: MiddlewareConfig = {
			matcher: [
				//@ts-expect-error
				'/public/:path*',
				{
					source: '/api/:path*',
					has: [{ type: 'header', key: 'x-api-key' }],
				},
			],
		};
		const matchers = normalizeMatchers(config);

		expect(matchers).toHaveLength(2);
		//@ts-expect-error
		expect(matchers[0].has).toBeUndefined();
		//@ts-expect-error
		expect(matchers[1].has).toBeDefined();
	});
});
