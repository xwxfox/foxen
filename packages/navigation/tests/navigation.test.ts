import { describe, expect, test } from 'bun:test';
import {
	RedirectInterrupt,
	ForbiddenInterrupt,
	NotFoundInterrupt,
	UnauthorizedInterrupt,
	applyFoxenResponseContext,
	cookies,
	createFoxenRequestContext,
	draftMode,
	headers,
	isInterruptError,
	notFound,
	permanentRedirect,
	redirect,
	temporaryRedirect,
	unauthorized,
	forbidden,
	withFoxenRequestContext,
} from '../src/index.js';

async function runWithContext(cb: () => Promise<void> | void) {
	const request = new Request('https://example.com/api/test', {
		headers: new Headers({
			cookie: 'foo=bar',
			'x-test': 'value',
		}),
	});
	const context = createFoxenRequestContext({ request });
	await withFoxenRequestContext(context, cb);
	return context;
}

describe('@foxen/navigation helpers', () => {
	test('headers() exposes read-only snapshot and marks dynamic usage', async () => {
		const context = await runWithContext(async () => {
			const hdrs = await headers();
			expect(hdrs.get('x-test')).toBe('value');
			let iterations = 0;
			for (const _entry of hdrs) {
				iterations += 1;
			}
			expect(iterations).toBeGreaterThan(0);
		});

		expect(context.dynamicUsage).toBe(true);
	});

	test('cookies().set writes Set-Cookie headers', async () => {
		const context = await runWithContext(async () => {
			const jar = await cookies();
			jar.set('session', '123', { httpOnly: true });
		});

		const merged = applyFoxenResponseContext(new Response(), context);
		expect(merged.headers.get('set-cookie')).toContain('session=123');
	});

	test('draftMode toggles preview cookies', async () => {
		const context = await runWithContext(async () => {
			const state = await draftMode();
			expect(state.isEnabled).toBe(false);
			await state.enable();
			expect(state.isEnabled).toBe(true);
			await state.disable();
			expect(state.isEnabled).toBe(false);
		});

		const response = applyFoxenResponseContext(new Response(), context);
		const cookieHeader = response.headers.get('set-cookie') ?? '';
		expect(cookieHeader).toContain('__next_preview_data');
	});

	test('redirect helpers throw interrupt errors', async () => {
		await expect(
			runWithContext(async () => {
				redirect('/login');
			}),
		).rejects.toBeInstanceOf(RedirectInterrupt);

		await expect(
			runWithContext(async () => {
				permanentRedirect('/login');
			}),
		).rejects.toBeInstanceOf(RedirectInterrupt);

		await expect(
			runWithContext(async () => {
				temporaryRedirect('/login');
			}),
		).rejects.toBeInstanceOf(RedirectInterrupt);
	});

	test('status helpers throw typed interrupts', async () => {
		await expect(
			runWithContext(async () => {
				notFound();
			}),
		).rejects.toBeInstanceOf(NotFoundInterrupt);

		await expect(
			runWithContext(async () => {
				unauthorized();
			}),
		).rejects.toBeInstanceOf(UnauthorizedInterrupt);

		await expect(
			runWithContext(async () => {
				forbidden();
			}),
		).rejects.toBeInstanceOf(ForbiddenInterrupt);
	});

	test('helpers throw outside of request context', async () => {
		await expect(headers()).rejects.toThrow(/foxen request/i);
		await expect(cookies()).rejects.toThrow(/foxen request/i);
	});

	test('isInterruptError identifies custom errors', () => {
		expect(isInterruptError(new RedirectInterrupt('/test'))).toBe(true);
		expect(isInterruptError(new Error('nope'))).toBe(false);
	});
});
