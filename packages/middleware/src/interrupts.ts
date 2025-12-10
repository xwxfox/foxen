import type { Elysia } from 'elysia';
import {
	createInterruptResponse,
	isInterruptError,
	type FoxenInterruptResponseOptions,
} from '@foxen/navigation';

/**
 * Elysia plugin that converts Foxen interrupt errors into HTTP responses.
 */
export function foxenInterruptHandler(options?: FoxenInterruptResponseOptions) {
	return (app: Elysia) =>
		app.onError(({ error, set }) => {
			if (isInterruptError(error)) {
				const response = createInterruptResponse(error, options);
				set.status = response.status;
				return response;
			}
		});
}
