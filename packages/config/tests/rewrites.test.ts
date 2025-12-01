import { describe, expect, it } from 'bun:test';
import {
	createRewrittenRequest,
	processRewrite,
	processRewriteArray,
	processRewrites,
} from '../src/rewrites.js';
import type { NextRewrite, NextRewritesConfig } from '../src/types.js';

describe('processRewrite', () => {
	it('matches simple rewrite', () => {
		const request = new Request('https://example.com/old-path');
		const rule: NextRewrite = {
			source: '/old-path',
			destination: '/new-path',
		};

		const result = processRewrite(request, rule);
		expect(result.matched).toBe(true);
		expect(result.pathname).toBe('/new-path');
		expect(result.isExternal).toBe(false);
	});

	it('extracts and applies params', () => {
		const request = new Request('https://example.com/users/123');
		const rule: NextRewrite = {
			source: '/users/:id',
			destination: '/api/users/:id',
		};

		const result = processRewrite(request, rule);
		expect(result.matched).toBe(true);
		expect(result.pathname).toBe('/api/users/123');
	});

	it('handles catch-all params', () => {
		const request = new Request('https://example.com/docs/a/b/c');
		const rule: NextRewrite = {
			source: '/docs/:path*',
			destination: '/content/:path*',
		};

		const result = processRewrite(request, rule);
		expect(result.matched).toBe(true);
		expect(result.pathname).toBe('/content/a/b/c');
	});

	it('detects external URLs', () => {
		const request = new Request('https://example.com/proxy/api');
		const rule: NextRewrite = {
			source: '/proxy/:path*',
			destination: 'https://backend.example.com/:path*',
		};

		const result = processRewrite(request, rule);
		expect(result.matched).toBe(true);
		expect(result.isExternal).toBe(true);
		expect(result.externalUrl).toBe('https://backend.example.com/api');
	});

	it('preserves query string on external URLs', () => {
		const request = new Request('https://example.com/proxy/api?foo=bar');
		const rule: NextRewrite = {
			source: '/proxy/:path*',
			destination: 'https://backend.example.com/:path*',
		};

		const result = processRewrite(request, rule);
		expect(result.externalUrl).toContain('foo=bar');
	});

	it('respects has conditions', () => {
		const request = new Request('https://example.com/page', {
			headers: { 'x-custom': 'value' },
		});
		const rule: NextRewrite = {
			source: '/page',
			destination: '/custom-page',
			has: [{ type: 'header', key: 'x-custom' }],
		};

		const result = processRewrite(request, rule);
		expect(result.matched).toBe(true);

		// Without the header
		const request2 = new Request('https://example.com/page');
		const result2 = processRewrite(request2, rule);
		expect(result2.matched).toBe(false);
	});

	it('respects missing conditions', () => {
		const request = new Request('https://example.com/page');
		const rule: NextRewrite = {
			source: '/page',
			destination: '/public-page',
			missing: [{ type: 'cookie', key: 'session' }],
		};

		const result = processRewrite(request, rule);
		expect(result.matched).toBe(true);
	});

	it('does not match non-matching paths', () => {
		const request = new Request('https://example.com/other');
		const rule: NextRewrite = {
			source: '/page',
			destination: '/rewritten',
		};

		const result = processRewrite(request, rule);
		expect(result.matched).toBe(false);
	});
});

describe('processRewriteArray', () => {
	it('returns first matching rewrite', () => {
		const request = new Request('https://example.com/page');
		const rules: NextRewrite[] = [
			{ source: '/page', destination: '/dest1' },
			{ source: '/page', destination: '/dest2' },
		];

		const result = processRewriteArray(request, rules);
		expect(result.matched).toBe(true);
		expect(result.pathname).toBe('/dest1');
	});

	it('returns not matched when no rules match', () => {
		const request = new Request('https://example.com/other');
		const rules: NextRewrite[] = [
			{ source: '/page1', destination: '/dest1' },
			{ source: '/page2', destination: '/dest2' },
		];

		const result = processRewriteArray(request, rules);
		expect(result.matched).toBe(false);
	});
});

describe('processRewrites', () => {
	const rewrites: NextRewritesConfig = {
		beforeFiles: [{ source: '/before/:path*', destination: '/before-rewrite/:path*' }],
		afterFiles: [{ source: '/after/:path*', destination: '/after-rewrite/:path*' }],
		fallback: [{ source: '/fallback/:path*', destination: '/fallback-rewrite/:path*' }],
	};

	it('processes beforeFiles phase', () => {
		const request = new Request('https://example.com/before/test');
		const result = processRewrites(request, rewrites, 'beforeFiles');
		expect(result.matched).toBe(true);
		expect(result.pathname).toBe('/before-rewrite/test');
		expect(result.phase).toBe('beforeFiles');
	});

	it('processes afterFiles phase', () => {
		const request = new Request('https://example.com/after/test');
		const result = processRewrites(request, rewrites, 'afterFiles');
		expect(result.matched).toBe(true);
		expect(result.pathname).toBe('/after-rewrite/test');
		expect(result.phase).toBe('afterFiles');
	});

	it('processes fallback phase', () => {
		const request = new Request('https://example.com/fallback/test');
		const result = processRewrites(request, rewrites, 'fallback');
		expect(result.matched).toBe(true);
		expect(result.pathname).toBe('/fallback-rewrite/test');
		expect(result.phase).toBe('fallback');
	});

	it('processes all phases in order', () => {
		const request = new Request('https://example.com/before/test');
		const result = processRewrites(request, rewrites, 'all');
		expect(result.matched).toBe(true);
		expect(result.phase).toBe('beforeFiles');

		const request2 = new Request('https://example.com/fallback/test');
		const result2 = processRewrites(request2, rewrites, 'all');
		expect(result2.matched).toBe(true);
		expect(result2.phase).toBe('fallback');
	});

	it('returns not matched when no phase matches', () => {
		const request = new Request('https://example.com/other');
		const result = processRewrites(request, rewrites, 'all');
		expect(result.matched).toBe(false);
	});
});

describe('createRewrittenRequest', () => {
	it('creates request with new pathname', () => {
		const original = new Request('https://example.com/old?foo=bar', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		});

		const rewritten = createRewrittenRequest(original, '/new');
		expect(new URL(rewritten.url).pathname).toBe('/new');
		expect(rewritten.method).toBe('POST');
		expect(rewritten.headers.get('Content-Type')).toBe('application/json');
	});

	it('preserves query string by default', () => {
		const original = new Request('https://example.com/old?foo=bar');
		const rewritten = createRewrittenRequest(original, '/new');
		expect(new URL(rewritten.url).searchParams.get('foo')).toBe('bar');
	});

	it('can strip query string', () => {
		const original = new Request('https://example.com/old?foo=bar');
		const rewritten = createRewrittenRequest(original, '/new', false);
		expect(new URL(rewritten.url).search).toBe('');
	});
});
