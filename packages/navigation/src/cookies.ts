import { RequestCookies, ResponseCookies, type RequestCookie, type ResponseCookie } from '@foxen/core';
import type { FoxenCookieStore } from './types.ts';

function mirrorRequestHeaders(headers: Headers): Headers {
	const mirror = new Headers();
	for (const [key, value] of headers.entries()) {
		mirror.append(key, value);
	}
	return mirror;
}

function normalizeCookieInput(
	...args: [name: string, value: string, cookie?: Partial<ResponseCookie>] | [ResponseCookie]
): ResponseCookie {
	if (typeof args[0] === 'string') {
		const [name, value, cookie] = args as [string, string, Partial<ResponseCookie>?];
		return {
			name,
			value,
			path: '/',
			...cookie,
		};
	}

	const [cookie] = args;
	if (typeof cookie.value !== 'string') {
		throw new TypeError('Cookie value is required');
	}
	return {
		...cookie,
		value: cookie.value,
		path: cookie.path ?? '/',
	};
}

export class FoxenCookieJar implements FoxenCookieStore {
	private readonly requestCookies: RequestCookies;
	private readonly responseCookies: ResponseCookies;

	constructor(requestCookies: RequestCookies, responseCookies: ResponseCookies) {
		this.requestCookies = requestCookies;
		this.responseCookies = responseCookies;
	}

	get(name: string): RequestCookie | undefined {
		return this.requestCookies.get(name);
	}

	getAll(name?: string): RequestCookie[] {
		return this.requestCookies.getAll(...(name ? [name] : []));
	}

	has(name: string): boolean {
		return this.requestCookies.has(name);
	}

	set(name: string, value: string, cookie?: Partial<ResponseCookie>): this;
	set(cookie: ResponseCookie): this;
	set(...args: [string, string, Partial<ResponseCookie>?] | [ResponseCookie]): this {
		const normalized = normalizeCookieInput(...args);
		this.requestCookies.set(normalized.name, normalized.value);
		this.responseCookies.set(normalized);
		return this;
	}

	delete(name: string | { name: string; path?: string; domain?: string }): this {
		const target = typeof name === 'string' ? { name, path: '/' } : { path: '/', ...name };
		this.requestCookies.delete(target.name);
		this.responseCookies.delete({ name: target.name, path: target.path, domain: target.domain });
		return this;
	}

	clear(): this {
		this.requestCookies.clear();
		this.responseCookies.clear();
		return this;
	}

	[Symbol.iterator](): IterableIterator<[string, RequestCookie]> {
		return this.requestCookies[Symbol.iterator]();
	}
}

export function createCookieStore(requestHeaders: Headers, responseHeaders: Headers): FoxenCookieStore {
	const mirroredHeaders = mirrorRequestHeaders(requestHeaders);
	const requestCookies = new RequestCookies(mirroredHeaders);
	const responseCookies = new ResponseCookies(responseHeaders);
	return new FoxenCookieJar(requestCookies, responseCookies);
}
