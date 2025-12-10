import type { RequestCookie, ResponseCookie } from '@foxen/core';

/** Read-only view of request headers, mirroring Next.js's ReadonlyHeaders */
export interface ReadonlyHeaders extends Iterable<[string, string]> {
	get(name: string): string | null;
	has(name: string): boolean;
	entries(): IterableIterator<[string, string]>;
	keys(): IterableIterator<string>;
	values(): IterableIterator<string>;
	forEach(callback: (value: string, key: string, parent: ReadonlyHeaders) => void): void;
}

/** Draft/previews helper returned by draftMode() */
export interface FoxenDraftModeState {
	isEnabled: boolean;
	enable(): Promise<void> | void;
	disable(): Promise<void> | void;
}

/** Initialization options for a Foxen request context */
export interface FoxenRequestContextInit {
	request: Request;
	responseHeaders?: Headers;
}

/** Internal async-context payload shared across helpers */
export interface FoxenRequestContext {
	request: Request;
	requestHeaders: Headers;
	responseHeaders: Headers;
	cookies: FoxenCookieStore;
	readonlyHeaders?: ReadonlyHeaders;
	dynamicUsage: boolean;
	setDynamicFlag(): void;
}

/** Cookie jar exposed by cookies() */
export interface FoxenCookieJarIterator extends IterableIterator<[string, RequestCookie]> {}

export interface FoxenCookieStore extends Iterable<[string, RequestCookie]> {
	get(name: string): RequestCookie | undefined;
	getAll(name?: string): RequestCookie[];
	has(name: string): boolean;
	set(name: string, value: string, cookie?: Partial<ResponseCookie>): this;
	set(cookie: ResponseCookie): this;
	delete(name: string | { name: string; path?: string; domain?: string }): this;
	clear(): this;
	[Symbol.iterator](): FoxenCookieJarIterator;
}
