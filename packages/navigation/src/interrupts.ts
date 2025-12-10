import type {
	ForbiddenInterrupt,
	FoxenInterrupt,
	NotFoundInterrupt,
	RedirectInterrupt,
	UnauthorizedInterrupt,
} from './errors.ts';

export interface FoxenInterruptResponseOptions {
	headers?: HeadersInit;
	onRedirect?(interrupt: RedirectInterrupt): Response;
	onNotFound?(interrupt: NotFoundInterrupt): Response;
	onUnauthorized?(interrupt: UnauthorizedInterrupt): Response;
	onForbidden?(interrupt: ForbiddenInterrupt): Response;
}

function buildHeaders(base?: HeadersInit): Headers {
	return new Headers(base);
}

function jsonResponse(status: number, body: Record<string, unknown>, headers?: HeadersInit): Response {
	const merged = buildHeaders(headers);
	if (!merged.has('content-type')) {
		merged.set('Content-Type', 'application/json');
	}
	return new Response(JSON.stringify(body), { status, headers: merged });
}

function redirectResponse(interrupt: RedirectInterrupt, headers?: HeadersInit): Response {
	const status = interrupt.status ?? (interrupt.permanent ? 308 : 307);
	const merged = buildHeaders(headers);
	merged.set('Location', interrupt.location);
	return new Response(null, { status, headers: merged });
}

export function createInterruptResponse(
	interrupt: FoxenInterrupt,
	options: FoxenInterruptResponseOptions = {},
): Response {
	switch (interrupt.code) {
		case 'FOXEN_REDIRECT':
			return options.onRedirect?.(interrupt) ?? redirectResponse(interrupt, options.headers);
		case 'FOXEN_NOT_FOUND':
			return (
				options.onNotFound?.(interrupt) ?? jsonResponse(404, { error: 'Not Found' }, options.headers)
			);
		case 'FOXEN_UNAUTHORIZED':
			return (
				options.onUnauthorized?.(interrupt) ??
				jsonResponse(401, { error: 'Unauthorized' }, options.headers)
			);
		case 'FOXEN_FORBIDDEN':
			return (
				options.onForbidden?.(interrupt) ?? jsonResponse(403, { error: 'Forbidden' }, options.headers)
			);
		default:
			return jsonResponse(500, { error: 'Unhandled interrupt' }, options.headers);
	}
}
