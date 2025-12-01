import type { RequestCookie, ResponseCookie } from './types.ts';

// ============================================
// Cookie Serialization
// ============================================

/**
 * Serialize a cookie to a string for the Set-Cookie header.
 */
export function stringifyCookie(c: ResponseCookie | RequestCookie): string {
	const attrs: string[] = [];

	if ('path' in c && c.path) attrs.push(`Path=${c.path}`);
	if ('expires' in c && (c.expires || c.expires === 0)) {
		const expires = typeof c.expires === 'number' ? new Date(c.expires) : c.expires;
		if (expires) attrs.push(`Expires=${expires.toUTCString()}`);
	}
	if ('maxAge' in c && typeof c.maxAge === 'number') attrs.push(`Max-Age=${c.maxAge}`);
	if ('domain' in c && c.domain) attrs.push(`Domain=${c.domain}`);
	if ('secure' in c && c.secure) attrs.push('Secure');
	if ('httpOnly' in c && c.httpOnly) attrs.push('HttpOnly');
	if ('sameSite' in c && c.sameSite) attrs.push(`SameSite=${c.sameSite}`);
	if ('partitioned' in c && c.partitioned) attrs.push('Partitioned');
	if ('priority' in c && c.priority) attrs.push(`Priority=${c.priority}`);

	const stringified = `${c.name}=${encodeURIComponent(c.value ?? '')}`;
	return attrs.length === 0 ? stringified : `${stringified}; ${attrs.join('; ')}`;
}

/**
 * Parse a Cookie header value into a Map.
 */
export function parseCookie(cookie: string): Map<string, string> {
	const map = new Map<string, string>();
	for (const pair of cookie.split(/; */)) {
		if (!pair) continue;
		const splitAt = pair.indexOf('=');
		if (splitAt === -1) {
			map.set(pair, 'true');
			continue;
		}
		const key = pair.slice(0, splitAt);
		const value = pair.slice(splitAt + 1);
		try {
			map.set(key, decodeURIComponent(value ?? 'true'));
		} catch {
			// Ignore invalid encoding
		}
	}
	return map;
}

/**
 * Parse a Set-Cookie header value.
 */
export function parseSetCookie(setCookie: string): ResponseCookie | undefined {
	if (!setCookie) return undefined;

	const parts = setCookie.split(';').map((p) => p.trim());
	if (parts.length === 0 || !parts[0]) return undefined;

	// First part is name=value
	const nameValue = parts[0];
	const eqIndex = nameValue.indexOf('=');
	if (eqIndex === -1) return undefined;

	const name = nameValue.slice(0, eqIndex);
	const value = decodeURIComponent(nameValue.slice(eqIndex + 1));

	// Parse attributes
	const attributes = new Map<string, string>();
	for (let i = 1; i < parts.length; i++) {
		const part = parts[i];
		if (!part) continue;
		const attrEq = part.indexOf('=');
		const key = (attrEq === -1 ? part : part.slice(0, attrEq)).toLowerCase().replace(/-/g, '');
		const attrValue = attrEq === -1 ? 'true' : part.slice(attrEq + 1);
		attributes.set(key, attrValue);
	}

	const cookie: ResponseCookie = { name, value };

	if (attributes.has('domain')) cookie.domain = attributes.get('domain');
	if (attributes.has('expires')) {
		const expires = attributes.get('expires');
		if (expires) cookie.expires = new Date(expires);
	}
	if (attributes.has('httponly')) cookie.httpOnly = true;
	if (attributes.has('maxage')) {
		const maxAge = attributes.get('maxage');
		if (maxAge) cookie.maxAge = Number(maxAge);
	}
	if (attributes.has('path')) cookie.path = attributes.get('path');
	if (attributes.has('samesite')) {
		const sameSite = attributes.get('samesite')?.toLowerCase();
		if (sameSite === 'strict' || sameSite === 'lax' || sameSite === 'none') {
			cookie.sameSite = sameSite;
		}
	}
	if (attributes.has('secure')) cookie.secure = true;
	if (attributes.has('priority')) {
		const priority = attributes.get('priority')?.toLowerCase();
		if (priority === 'low' || priority === 'medium' || priority === 'high') {
			cookie.priority = priority;
		}
	}
	if (attributes.has('partitioned')) cookie.partitioned = true;

	return cookie;
}

/**
 * Split a Set-Cookie header string that may contain multiple cookies.
 */
export function splitCookiesString(cookiesString: string): string[] {
	if (!cookiesString) return [];

	const cookiesStrings: string[] = [];
	let pos = 0;
	let start: number;
	let ch: string;
	let lastComma = 0;
	let nextStart = 0;
	let cookiesSeparatorFound: boolean;

	function skipWhitespace(): boolean {
		while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
			pos += 1;
		}
		return pos < cookiesString.length;
	}

	function notSpecialChar(): boolean {
		ch = cookiesString.charAt(pos);
		return ch !== '=' && ch !== ';' && ch !== ',';
	}

	while (pos < cookiesString.length) {
		start = pos;
		cookiesSeparatorFound = false;

		while (skipWhitespace()) {
			ch = cookiesString.charAt(pos);
			if (ch === ',') {
				lastComma = pos;
				pos += 1;
				skipWhitespace();
				nextStart = pos;

				while (pos < cookiesString.length && notSpecialChar()) {
					pos += 1;
				}

				if (pos < cookiesString.length && cookiesString.charAt(pos) === '=') {
					cookiesSeparatorFound = true;
					pos = nextStart;
					cookiesStrings.push(cookiesString.substring(start, lastComma));
					start = pos;
				} else {
					pos = lastComma + 1;
				}
			} else {
				pos += 1;
			}
		}

		if (!cookiesSeparatorFound || pos >= cookiesString.length) {
			cookiesStrings.push(cookiesString.substring(start, cookiesString.length));
		}
	}

	return cookiesStrings;
}

// ============================================
// RequestCookies Class
// ============================================

/**
 * A class for manipulating Request cookies (Cookie header).
 *
 * This is a 1:1 implementation of Next.js's RequestCookies from @edge-runtime/cookies.
 */
export class RequestCookies {
	/** @internal */
	readonly _parsed: Map<string, RequestCookie>;
	private _headers: Headers;

	constructor(requestHeaders: Headers) {
		this._parsed = new Map();
		this._headers = requestHeaders;
		const header = requestHeaders.get('cookie');
		if (header) {
			const parsed = parseCookie(header);
			for (const [name, value] of parsed) {
				this._parsed.set(name, { name, value });
			}
		}
	}

	/**
	 * Returns the Map's iterator.
	 */
	[Symbol.iterator](): MapIterator<[string, RequestCookie]> {
		return this._parsed[Symbol.iterator]();
	}

	/**
	 * The amount of cookies received from the client.
	 */
	get size(): number {
		return this._parsed.size;
	}

	/**
	 * Returns an iterator of [name, cookie] pairs.
	 */
	entries(): MapIterator<[string, RequestCookie]> {
		return this._parsed.entries();
	}

	/**
	 * Returns an iterator of cookie names.
	 */
	keys(): MapIterator<string> {
		return this._parsed.keys();
	}

	/**
	 * Returns an iterator of cookie values.
	 */
	values(): MapIterator<RequestCookie> {
		return this._parsed.values();
	}

	/**
	 * Executes a provided function once for each cookie.
	 */
	forEach(
		callback: (cookie: RequestCookie, name: string, map: Map<string, RequestCookie>) => void,
		thisArg?: unknown,
	): void {
		this._parsed.forEach((value, key) => {
			callback.call(thisArg, value, key, this._parsed);
		});
	}

	/**
	 * Get a cookie by name.
	 */
	get(...args: [name: string] | [RequestCookie]): RequestCookie | undefined {
		const name = typeof args[0] === 'string' ? args[0] : args[0].name;
		return this._parsed.get(name);
	}

	/**
	 * Get all cookies, optionally filtered by name.
	 */
	getAll(...args: [name: string] | [RequestCookie] | []): RequestCookie[] {
		const all = Array.from(this._parsed);
		if (!args.length) {
			return all.map(([_, value]) => value);
		}
		const name = typeof args[0] === 'string' ? args[0] : args[0]?.name;
		return all.filter(([n]) => n === name).map(([_, value]) => value);
	}

	/**
	 * Check if a cookie exists.
	 */
	has(name: string): boolean {
		return this._parsed.has(name);
	}

	/**
	 * Set a cookie on the request.
	 */
	set(...args: [key: string, value: string] | [options: RequestCookie]): this {
		const [name, value] = args.length === 1 ? [args[0].name, args[0].value] : args;
		const map = this._parsed;
		map.set(name, { name, value });
		this._headers.set(
			'cookie',
			Array.from(map)
				.map(([_, val]) => stringifyCookie(val))
				.join('; '),
		);
		return this;
	}

	/**
	 * Delete cookies matching the passed name or names.
	 */
	delete(names: string | string[]): boolean | boolean[] {
		const map = this._parsed;
		const result = !Array.isArray(names)
			? map.delete(names)
			: names.map((name) => map.delete(name));
		this._headers.set(
			'cookie',
			Array.from(map)
				.map(([_, val]) => stringifyCookie(val))
				.join('; '),
		);
		return result;
	}

	/**
	 * Delete all cookies in the request.
	 */
	clear(): this {
		this._parsed.clear();
		this._headers.delete('cookie');
		return this;
	}

	/**
	 * Format the cookies for logging.
	 */
	[Symbol.for('edge-runtime.inspect.custom')](): string {
		return `RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`;
	}

	/**
	 * Convert to string.
	 */
	toString(): string {
		return [...this._parsed.values()]
			.map((v) => `${v.name}=${encodeURIComponent(v.value)}`)
			.join('; ');
	}
}

// ============================================
// ResponseCookies Class
// ============================================

/**
 * A class for manipulating Response cookies (Set-Cookie header).
 *
 * This is a 1:1 implementation of Next.js's ResponseCookies from @edge-runtime/cookies.
 */
export class ResponseCookies {
	/** @internal */
	readonly _parsed: Map<string, ResponseCookie>;
	private _headers: Headers;

	constructor(responseHeaders: Headers) {
		this._parsed = new Map();
		this._headers = responseHeaders;

		// Parse existing Set-Cookie headers
		const setCookie = responseHeaders.getSetCookie?.() ?? responseHeaders.get('set-cookie') ?? [];
		const cookieStrings = Array.isArray(setCookie) ? setCookie : splitCookiesString(setCookie);

		for (const cookieString of cookieStrings) {
			const parsed = parseSetCookie(cookieString);
			if (parsed) {
				this._parsed.set(parsed.name, parsed);
			}
		}
	}

	/**
	 * Get a cookie by name.
	 */
	get(...args: [key: string] | [options: ResponseCookie]): ResponseCookie | undefined {
		const key = typeof args[0] === 'string' ? args[0] : args[0].name;
		return this._parsed.get(key);
	}

	/**
	 * The number of cookies.
	 */
	get size(): number {
		return this._parsed.size;
	}

	/**
	 * Returns the Map's iterator.
	 */
	[Symbol.iterator](): MapIterator<[string, ResponseCookie]> {
		return this._parsed[Symbol.iterator]();
	}

	/**
	 * Get all cookies, optionally filtered by name.
	 */
	getAll(...args: [key: string] | [options: ResponseCookie] | []): ResponseCookie[] {
		const all = Array.from(this._parsed.values());
		if (!args.length) {
			return all;
		}
		const key = typeof args[0] === 'string' ? args[0] : args[0]?.name;
		return all.filter((c) => c.name === key);
	}

	/**
	 * Check if a cookie exists.
	 */
	has(name: string): boolean {
		return this._parsed.has(name);
	}

	/**
	 * Set a cookie on the response.
	 */
	set(
		...args:
			| [key: string, value: string, cookie?: Partial<ResponseCookie>]
			| [options: ResponseCookie]
	): this {
		const [name, value, cookie] = args.length === 1 ? [args[0].name, args[0].value, args[0]] : args;

		const normalizedCookie: ResponseCookie = {
			name,
			value,
			...cookie,
		};

		// Normalize the cookie values
		if (normalizedCookie.path === undefined) {
			normalizedCookie.path = '/';
		}

		this._parsed.set(name, normalizedCookie);
		this._updateHeaders();
		return this;
	}

	/**
	 * Delete a cookie.
	 */
	delete(
		...args: [key: string] | [keys: string[]] | [options: Omit<ResponseCookie, 'value' | 'expires'>]
	): this {
		// Handle array of names
		if (Array.isArray(args[0])) {
			for (const name of args[0]) {
				this._deleteSingle(name, '/', undefined);
			}
			this._updateHeaders();
			return this;
		}

		const name = typeof args[0] === 'string' ? args[0] : args[0].name;
		const path = typeof args[0] === 'string' ? '/' : (args[0].path ?? '/');
		const domain = typeof args[0] === 'string' ? undefined : args[0].domain;

		this._deleteSingle(name, path, domain);
		this._updateHeaders();
		return this;
	}

	/**
	 * Delete a single cookie by marking it as expired.
	 */
	private _deleteSingle(name: string, path: string, domain: string | undefined): void {
		this._parsed.set(name, {
			name,
			value: '',
			path,
			domain,
			expires: new Date(0),
			maxAge: 0,
		});
	}

	/**
	 * Delete all cookies by marking them as expired.
	 */
	clear(): this {
		const names = Array.from(this._parsed.keys());
		for (const name of names) {
			const cookie = this._parsed.get(name);
			this._parsed.set(name, {
				name,
				value: '',
				path: cookie?.path ?? '/',
				domain: cookie?.domain,
				expires: new Date(0),
				maxAge: 0,
			});
		}
		this._updateHeaders();
		return this;
	}

	/**
	 * Update the Set-Cookie headers based on parsed cookies.
	 */
	private _updateHeaders(): void {
		// Delete all existing Set-Cookie headers
		this._headers.delete('set-cookie');

		// Add each cookie as a Set-Cookie header
		for (const cookie of this._parsed.values()) {
			this._headers.append('set-cookie', stringifyCookie(cookie));
		}
	}

	/**
	 * Format the cookies for logging.
	 */
	[Symbol.for('edge-runtime.inspect.custom')](): string {
		return `ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`;
	}

	/**
	 * Convert to string.
	 */
	toString(): string {
		return [...this._parsed.values()].map((cookie) => stringifyCookie(cookie)).join('; ');
	}
}
