import type { NextFetchEvent as INextFetchEvent } from './types.js';

/**
 * NextFetchEvent implementation
 *
 * In Next.js edge runtime, this provides access to the fetch event
 * and allows scheduling background work with waitUntil().
 *
 * In Bun/Foxen, waitUntil() simply executes the promise (no background
 * workers needed), but the API is preserved for compatibility.
 *
 * @example
 * ```ts
 * export function middleware(request: NextRequest, event: NextFetchEvent) {
 *   // Schedule background work
 *   event.waitUntil(
 *     analytics.track({ event: 'pageview', url: request.url })
 *   );
 *
 *   return NextResponse.next();
 * }
 * ```
 */
export class NextFetchEvent implements INextFetchEvent {
	private _promises: Promise<unknown>[] = [];
	private _sourcePage: string;

	constructor(options: { sourcePage?: string } = {}) {
		this._sourcePage = options.sourcePage ?? '';
	}

	/**
	 * Extends the lifetime of the event to wait for the promise to resolve.
	 * In Bun, this simply runs the promise and catches any errors.
	 *
	 * @param promise - Promise to wait for
	 */
	waitUntil(promise: Promise<unknown>): void {
		this._promises.push(
			promise.catch((error) => {
				console.error('[foxen:middleware] waitUntil promise rejected:', error);
			}),
		);
	}

	/**
	 * The page that triggered this event.
	 * In Foxen context, this is typically empty.
	 */
	get sourcePage(): string {
		return this._sourcePage;
	}

	/**
	 * Wait for all waitUntil promises to complete.
	 * This is a Foxen extension for testing/debugging.
	 */
	async waitForAll(): Promise<void> {
		await Promise.all(this._promises);
	}

	/**
	 * Get the number of pending promises.
	 * This is a Foxen extension for testing/debugging.
	 */
	get pendingCount(): number {
		return this._promises.length;
	}
}

/**
 * Create a new NextFetchEvent instance
 *
 * @param options - Event options
 * @returns NextFetchEvent instance
 */
export function createNextFetchEvent(options: { sourcePage?: string } = {}): NextFetchEvent {
	return new NextFetchEvent(options);
}
