import { describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import {
	ForbiddenInterrupt,
	NotFoundInterrupt,
	RedirectInterrupt,
	UnauthorizedInterrupt,
} from '@foxen/navigation';
import { foxenInterruptHandler, type FoxenInterruptResponseOptions } from '../src/index.js';

async function handleRequest(
	handler: () => unknown,
	options?: FoxenInterruptResponseOptions,
): Promise<Response> {
	const app = new Elysia().use(foxenInterruptHandler(options)).get('/test', handler);
	return app.handle(new Request('https://example.com/test'));
}

describe('foxenInterruptHandler', () => {
	test('converts redirect interrupts into redirect responses', async () => {
		const response = await handleRequest(() => {
			throw new RedirectInterrupt('/login');
		});

		expect(response.status).toBe(307);
		expect(response.headers.get('location')).toBe('/login');
	});

	test('falls back to JSON responses for status interrupts', async () => {
		const response = await handleRequest(() => {
			throw new NotFoundInterrupt();
		});

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: 'Not Found' });
	});

	test('supports custom interrupt overrides', async () => {
		const response = await handleRequest(
			() => {
				throw new UnauthorizedInterrupt();
			},
			{
				onUnauthorized() {
					return new Response('nope', { status: 418, headers: { 'x-test': 'override' } });
				},
			},
		);

		expect(response.status).toBe(418);
		expect(response.headers.get('x-test')).toBe('override');
		await expect(response.text()).resolves.toBe('nope');
	});

	test('propagates forbidden interrupts', async () => {
		const response = await handleRequest(() => {
			throw new ForbiddenInterrupt();
		});

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
	});
});
