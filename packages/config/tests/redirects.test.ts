import { describe, expect, it } from 'bun:test';
import {
	createRedirectResponse,
	isExternalUrl,
	processRedirect,
	processRedirects,
} from '../src/redirects.js';
import type { NextRedirect } from '../src/types.js';

describe('processRedirect', () => {
	it('matches simple redirect', () => {
		const request = new Request('https://example.com/old-page');
		const rule: NextRedirect = {
			source: '/old-page',
			destination: '/new-page',
			permanent: false,
		};

		const result = processRedirect(request, rule);
		expect(result.matched).toBe(true);
		expect(result.response).toBeInstanceOf(Response);
		expect(result.response?.status).toBe(307);
		expect(result.response?.headers.get('Location')).toBe('https://example.com/new-page');
	});

	it('handles permanent redirects with 308', () => {
		const request = new Request('https://example.com/old-page');
		const rule: NextRedirect = {
			source: '/old-page',
			destination: '/new-page',
			permanent: true,
		};

		const result = processRedirect(request, rule);
		expect(result.matched).toBe(true);
		expect(result.response?.status).toBe(308);
	});

	it('extracts and applies params', () => {
		const request = new Request('https://example.com/users/123');
		const rule: NextRedirect = {
			source: '/users/:id',
			destination: '/profiles/:id',
			permanent: false,
		};

		const result = processRedirect(request, rule);
		expect(result.matched).toBe(true);
		expect(result.response?.headers.get('Location')).toBe('https://example.com/profiles/123');
	});

	it('preserves query string by default', () => {
		const request = new Request('https://example.com/old-page?foo=bar&baz=qux');
		const rule: NextRedirect = {
			source: '/old-page',
			destination: '/new-page',
			permanent: false,
		};

		const result = processRedirect(request, rule);
		expect(result.matched).toBe(true);
		const location = result.response?.headers.get('Location');
		expect(location).toContain('foo=bar');
		expect(location).toContain('baz=qux');
	});

	it('destination query params override original', () => {
		const request = new Request('https://example.com/old-page?foo=bar');
		const rule: NextRedirect = {
			source: '/old-page',
			destination: '/new-page?foo=override',
			permanent: false,
		};

		const result = processRedirect(request, rule);
		expect(result.matched).toBe(true);
		const location = result.response?.headers.get('Location');
		expect(location).toContain('foo=override');
	});

	it('handles external destinations', () => {
		const request = new Request('https://example.com/external');
		const rule: NextRedirect = {
			source: '/external',
			destination: 'https://other-site.com/page',
			permanent: false,
		};

		const result = processRedirect(request, rule);
		expect(result.matched).toBe(true);
		expect(result.response?.headers.get('Location')).toBe('https://other-site.com/page');
	});

	it('respects has conditions', () => {
		const request = new Request('https://example.com/page', {
			headers: { 'x-auth': 'token' },
		});
		const rule: NextRedirect = {
			source: '/page',
			destination: '/dashboard',
			permanent: false,
			has: [{ type: 'header', key: 'x-auth' }],
		};

		const result = processRedirect(request, rule);
		expect(result.matched).toBe(true);

		// Without the header
		const request2 = new Request('https://example.com/page');
		const result2 = processRedirect(request2, rule);
		expect(result2.matched).toBe(false);
	});

	it('respects missing conditions', () => {
		const request = new Request('https://example.com/page');
		const rule: NextRedirect = {
			source: '/page',
			destination: '/login',
			permanent: false,
			missing: [{ type: 'header', key: 'x-auth' }],
		};

		const result = processRedirect(request, rule);
		expect(result.matched).toBe(true);

		// With the header
		const request2 = new Request('https://example.com/page', {
			headers: { 'x-auth': 'token' },
		});
		const result2 = processRedirect(request2, rule);
		expect(result2.matched).toBe(false);
	});

	it('respects basePath: false', () => {
		const request = new Request('https://example.com/api/old');
		const rule: NextRedirect = {
			source: '/api/old',
			destination: '/api/new',
			permanent: false,
			basePath: false,
		};

		const result = processRedirect(request, rule, { basePath: '/api' });
		expect(result.matched).toBe(true);
	});
});

describe('processRedirects', () => {
	it('returns first matching redirect', () => {
		const request = new Request('https://example.com/page1');
		const rules: NextRedirect[] = [
			{ source: '/page1', destination: '/dest1', permanent: false },
			{ source: '/page1', destination: '/dest2', permanent: false },
		];

		const result = processRedirects(request, rules);
		expect(result.matched).toBe(true);
		expect(result.response?.headers.get('Location')).toBe('https://example.com/dest1');
	});

	it('returns not matched when no rules match', () => {
		const request = new Request('https://example.com/other');
		const rules: NextRedirect[] = [
			{ source: '/page1', destination: '/dest1', permanent: false },
			{ source: '/page2', destination: '/dest2', permanent: false },
		];

		const result = processRedirects(request, rules);
		expect(result.matched).toBe(false);
	});

	it('handles empty rules array', () => {
		const request = new Request('https://example.com/page');
		const result = processRedirects(request, []);
		expect(result.matched).toBe(false);
	});
});

describe('createRedirectResponse', () => {
	it('creates 307 temporary redirect', () => {
		const response = createRedirectResponse('https://example.com/new', 307);
		expect(response.status).toBe(307);
		expect(response.headers.get('Location')).toBe('https://example.com/new');
	});

	it('creates 308 permanent redirect', () => {
		const response = createRedirectResponse('https://example.com/new', 308);
		expect(response.status).toBe(308);
	});
});

describe('isExternalUrl', () => {
	it('identifies external URLs', () => {
		expect(isExternalUrl('https://other.com/page')).toBe(true);
		expect(isExternalUrl('http://other.com/page')).toBe(true);
	});

	it('identifies internal paths', () => {
		expect(isExternalUrl('/page')).toBe(false);
		expect(isExternalUrl('./page')).toBe(false);
	});

	it('compares with origin', () => {
		expect(isExternalUrl('https://example.com/page', 'https://example.com')).toBe(false);
		expect(isExternalUrl('https://other.com/page', 'https://example.com')).toBe(true);
	});
});
