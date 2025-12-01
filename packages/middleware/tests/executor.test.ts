import { describe, expect, it } from 'bun:test';
import { type NextRequest, NextResponse } from '@foxen/core';
import {
	applyMiddlewareHeaders,
	createRewrittenRequest,
	executeMiddleware,
	parseMiddlewareResponse,
} from '../src/executor.js';
import type { MiddlewareHandler } from '../src/types.js';

describe('executeMiddleware', () => {
	it('should return continue when middleware returns void', async () => {
		const handler: MiddlewareHandler = () => {
			// No return
		};

		const request = new Request('http://localhost/api/users');
		const result = await executeMiddleware(request, handler);

		expect(result.continue).toBe(true);
		expect(result.response).toBeUndefined();
	});

	it('should return continue when middleware returns NextResponse.next()', async () => {
		const handler: MiddlewareHandler = () => {
			return NextResponse.next();
		};

		const request = new Request('http://localhost/api/users');
		const result = await executeMiddleware(request, handler);

		expect(result.continue).toBe(true);
		expect(result.response).toBeUndefined();
	});

	it('should return redirect when middleware returns NextResponse.redirect()', async () => {
		const handler: MiddlewareHandler = () => {
			return NextResponse.redirect(new URL('http://localhost/login'));
		};

		const request = new Request('http://localhost/api/users');
		const result = await executeMiddleware(request, handler);

		expect(result.continue).toBe(false);
		expect(result.response).toBeDefined();
		expect(result.response?.status).toBe(307);
		expect(result.response?.headers.get('location')).toBe('http://localhost/login');
	});

	it('should handle rewrite response', async () => {
		const handler: MiddlewareHandler = () => {
			return NextResponse.rewrite(new URL('http://localhost/api/v2/users'));
		};

		const request = new Request('http://localhost/api/users');
		const result = await executeMiddleware(request, handler);

		expect(result.continue).toBe(true);
		expect(result.rewriteTo).toBe('http://localhost/api/v2/users');
	});

	it('should return error response on middleware error', async () => {
		const handler: MiddlewareHandler = () => {
			throw new Error('Middleware failed');
		};

		const request = new Request('http://localhost/api/users');
		const result = await executeMiddleware(request, handler);

		expect(result.continue).toBe(false);
		expect(result.response?.status).toBe(500);
	});

	it('should continue on error when continueOnError is true', async () => {
		const handler: MiddlewareHandler = () => {
			throw new Error('Middleware failed');
		};

		const request = new Request('http://localhost/api/users');
		const result = await executeMiddleware(request, handler, { continueOnError: true });

		expect(result.continue).toBe(true);
	});

	it('should handle request header modifications', async () => {
		const handler: MiddlewareHandler = () => {
			return NextResponse.next({
				request: {
					headers: new Headers({ 'x-custom-header': 'value' }),
				},
			});
		};

		const request = new Request('http://localhost/api/users');
		const result = await executeMiddleware(request, handler);

		expect(result.continue).toBe(true);
		expect(result.request).toBeDefined();
		expect(result.request?.headers.get('x-custom-header')).toBe('value');
	});

	it('should provide NextRequest to handler', async () => {
		let receivedRequest: NextRequest | undefined;

		const handler: MiddlewareHandler = (req) => {
			receivedRequest = req;
			return NextResponse.next();
		};

		const request = new Request('http://localhost/api/users?page=1');
		await executeMiddleware(request, handler);

		expect(receivedRequest).toBeDefined();
		expect(receivedRequest?.nextUrl.pathname).toBe('/api/users');
		expect(receivedRequest?.nextUrl.searchParams.get('page')).toBe('1');
	});
});

describe('parseMiddlewareResponse', () => {
	it('should return continue for void', () => {
		const result = parseMiddlewareResponse(undefined, new Request('http://localhost'));
		expect(result.continue).toBe(true);
	});

	it('should return continue for null', () => {
		const result = parseMiddlewareResponse(null, new Request('http://localhost'));
		expect(result.continue).toBe(true);
	});

	it('should handle regular Response', () => {
		const response = new Response('Hello', { status: 200 });
		const result = parseMiddlewareResponse(response, new Request('http://localhost'));

		expect(result.continue).toBe(false);
		expect(result.response).toBe(response);
	});

	it('should detect redirect response', () => {
		const response = new Response(null, {
			status: 302,
			headers: { location: 'http://localhost/login' },
		});
		const result = parseMiddlewareResponse(response, new Request('http://localhost'));

		expect(result.continue).toBe(false);
		expect(result.response?.status).toBe(302);
	});
});

describe('applyMiddlewareHeaders', () => {
	it('should return original response when no middleware headers', () => {
		const response = new Response('Hello');
		const result = applyMiddlewareHeaders(response, { continue: true });
		expect(result).toBe(response);
	});

	it('should apply response headers', () => {
		const response = new Response('Hello');
		const responseHeaders = new Headers();
		responseHeaders.append('Set-Cookie', 'session=abc');

		const result = applyMiddlewareHeaders(response, {
			continue: true,
			responseHeaders,
		});

		expect(result.headers.get('Set-Cookie')).toBe('session=abc');
	});
});

describe('createRewrittenRequest', () => {
	it('should create request with new URL', () => {
		const original = new Request('http://localhost/api/users', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		});

		const rewritten = createRewrittenRequest(original, '/api/v2/users');

		expect(new URL(rewritten.url).pathname).toBe('/api/v2/users');
		expect(rewritten.method).toBe('POST');
		expect(rewritten.headers.get('Content-Type')).toBe('application/json');
	});

	it('should handle absolute URLs', () => {
		const original = new Request('http://localhost/api/users');
		const rewritten = createRewrittenRequest(original, 'http://other-host.com/api/users');

		expect(rewritten.url).toBe('http://other-host.com/api/users');
	});
});
