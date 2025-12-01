import { describe, expect, it } from 'bun:test';
import { NextFetchEvent, createNextFetchEvent } from '../src/event.js';

describe('NextFetchEvent', () => {
	it('should create with default values', () => {
		const event = new NextFetchEvent();
		expect(event.sourcePage).toBe('');
		expect(event.pendingCount).toBe(0);
	});

	it('should create with custom sourcePage', () => {
		const event = new NextFetchEvent({ sourcePage: '/api/users' });
		expect(event.sourcePage).toBe('/api/users');
	});

	it('should track waitUntil promises', async () => {
		const event = new NextFetchEvent();

		event.waitUntil(Promise.resolve('done1'));
		event.waitUntil(Promise.resolve('done2'));

		expect(event.pendingCount).toBe(2);

		await event.waitForAll();
	});

	it('should handle rejected promises in waitUntil', async () => {
		const event = new NextFetchEvent();

		// This should not throw
		event.waitUntil(Promise.reject(new Error('test error')));

		// Wait should complete without throwing
		await event.waitForAll();
	});
});

describe('createNextFetchEvent', () => {
	it('should create NextFetchEvent instance', () => {
		const event = createNextFetchEvent();
		expect(event).toBeInstanceOf(NextFetchEvent);
	});

	it('should pass options through', () => {
		const event = createNextFetchEvent({ sourcePage: '/test' });
		expect(event.sourcePage).toBe('/test');
	});
});
