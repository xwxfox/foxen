import { AsyncLocalStorage } from 'node:async_hooks';
import { createCookieStore } from './cookies.ts';
import type { FoxenRequestContext, FoxenRequestContextInit } from './types.ts';

const storage = new AsyncLocalStorage<FoxenRequestContext>();

export function createFoxenRequestContext(init: FoxenRequestContextInit): FoxenRequestContext {
	const responseHeaders = init.responseHeaders ?? new Headers();
	const requestHeaders = new Headers(init.request.headers);
	const cookies = createCookieStore(init.request.headers, responseHeaders);

	const context: FoxenRequestContext = {
		request: init.request,
		requestHeaders,
		responseHeaders,
		cookies,
		readonlyHeaders: undefined,
		dynamicUsage: false,
		setDynamicFlag: () => {
			context.dynamicUsage = true;
		},
	};

	return context;
}

export function withFoxenRequestContext<T>(context: FoxenRequestContext, run: () => T): T;
export function withFoxenRequestContext<T>(
	context: FoxenRequestContext,
	run: () => Promise<T>,
): Promise<T>;
export function withFoxenRequestContext<T>(
	context: FoxenRequestContext,
	run: () => T | Promise<T>,
): T | Promise<T> {
	return storage.run(context, run);
}

export function getFoxenRequestContext(): FoxenRequestContext | undefined {
	return storage.getStore();
}

export function assertRequestContext(apiName: string): FoxenRequestContext {
	const context = getFoxenRequestContext();
	if (!context) {
		throw new Error(`${apiName}() can only be used while handling a Foxen request`);
	}
	return context;
}

export function applyFoxenResponseContext(response: Response, context: FoxenRequestContext): Response {
	for (const [key, value] of context.responseHeaders.entries()) {
		if (key.toLowerCase() === 'set-cookie') {
			response.headers.append(key, value);
			continue;
		}
		response.headers.set(key, value);
	}

	if (context.dynamicUsage) {
		response.headers.set('x-foxen-dynamic', '1');
	}

	return response;
}
