import { assertRequestContext } from './context.ts';
import type { ReadonlyHeaders } from './types.ts';

class FoxenReadonlyHeaders implements ReadonlyHeaders {
	constructor(private readonly source: Headers) {}

	get(name: string): string | null {
		return this.source.get(name);
	}

	has(name: string): boolean {
		return this.source.has(name);
	}

	entries(): IterableIterator<[string, string]> {
		return this.source.entries();
	}

	keys(): IterableIterator<string> {
		return this.source.keys();
	}

	values(): IterableIterator<string> {
		return this.source.values();
	}

	forEach(callback: (value: string, key: string, parent: ReadonlyHeaders) => void): void {
		for (const [key, value] of this.source.entries()) {
			callback(value, key, this);
		}
	}

	[Symbol.iterator](): IterableIterator<[string, string]> {
		return this.source.entries();
	}
}

export async function headers(): Promise<ReadonlyHeaders> {
	const context = assertRequestContext('headers');
	context.setDynamicFlag();
	if (!context.readonlyHeaders) {
		context.readonlyHeaders = new FoxenReadonlyHeaders(context.requestHeaders);
	}
	return context.readonlyHeaders;
}

export { FoxenReadonlyHeaders };
