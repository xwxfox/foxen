import type { HttpMethod, NextRequest, NextRouteHandler } from '@foxen/core';
import {
	applyFoxenResponseContext,
	createFoxenRequestContext,
	createInterruptResponse,
	isInterruptError,
	withFoxenRequestContext,
} from '@foxen/navigation';
import {
	createNextRequest as createNextRequestFromContext,
	createParamsPromise,
	getFoxenContext,
	normalizeParams,
} from './context.js';
import type {
	ElysiaContext,
	ElysiaHandler,
	HandlerAdapter,
	ParamInfo,
	RouteInfo,
	RuntimeContext,
} from './types.js';

/**
 * Creates a NextRequest from Elysia context with proper handling.
 */
function createNextRequest(ctx: ElysiaContext, basePath?: string): NextRequest {
	// Check if middleware modified the request
	const foxenCtx = getFoxenContext(ctx) as RuntimeContext;
	const request = foxenCtx._modifiedRequest ?? ctx.request;

	// If Elysia has parsed the body (from schema validation),
	// we need to create a new Request with that body
	if (ctx.body !== undefined && ctx.body !== null) {
		const headers = new Headers(request.headers);
		const bodyRequest = new Request(request.url, {
			method: request.method,
			headers,
			body: JSON.stringify(ctx.body),
		});
		return createNextRequestFromContext(bodyRequest, {
			basePath: basePath ?? foxenCtx._basePath,
			ip: foxenCtx._ip,
			geo: foxenCtx._geo,
		});
	}

	return createNextRequestFromContext(request, {
		basePath: basePath ?? foxenCtx._basePath,
		ip: foxenCtx._ip,
		geo: foxenCtx._geo,
	});
}

/**
 * Creates Next.js style params context.
 * Next.js 15+ uses async params via Promise.
 */
function createNextParams(
	elysiaParams: Record<string, string | string[]> | undefined,
	paramInfo: ParamInfo[],
): Promise<Record<string, string | string[]>> & Record<string, string | string[]> {
	const nextParams: Record<string, string | string[]> = {};

	if (!elysiaParams) {
		return createParamsPromise(nextParams);
	}

	// Find catch-all param name
	const catchAllParam = paramInfo.find((p) => p.isCatchAll);
	const catchAllName = catchAllParam?.name;

	// Normalize params (handle * -> slug conversion, etc.)
	const normalized = normalizeParams(elysiaParams, catchAllName);

	// Copy normalized params
	for (const [key, value] of Object.entries(normalized)) {
		nextParams[key] = value;
	}

	// Handle optional catch-all with empty value
	if (catchAllParam?.isOptional && nextParams[catchAllParam.name] === undefined) {
		nextParams[catchAllParam.name] = [];
	}

	// Copy regular params that weren't normalized
	for (const param of paramInfo) {
		if (
			!param.isCatchAll &&
			elysiaParams[param.name] !== undefined &&
			nextParams[param.name] === undefined
		) {
			nextParams[param.name] = elysiaParams[param.name] as string | string[];
		}
	}

	return createParamsPromise(nextParams);
}

/**
 * Default adapter that wraps Next.js handlers for Elysia.
 *
 * Features:
 * - Converts Elysia context to NextRequest
 * - Handles params as Promise (Next.js 15+ style)
 * - Respects middleware modifications
 * - Proper error handling
 */
export const defaultAdapter: HandlerAdapter = (
	handler: NextRouteHandler,
	routeInfo: RouteInfo,
	_method: HttpMethod,
): ElysiaHandler => {
	return async (ctx: ElysiaContext): Promise<Response> => {
		const request = createNextRequest(ctx);
		const params = createNextParams(ctx.params, routeInfo.params);

		return handleFoxenRequest(request, routeInfo, async () => {
			const result = await handler(request, { params });
			return normalizeResponse(result);
		});
	};
};

/**
 * Adapter for handlers that don't need params (simpler routes).
 */
export const simpleAdapter: HandlerAdapter = (
	handler: NextRouteHandler,
	routeInfo: RouteInfo,
	_method: HttpMethod,
): ElysiaHandler => {
	return async (ctx: ElysiaContext): Promise<Response> => {
		const request = createNextRequest(ctx);
		return handleFoxenRequest(request, routeInfo, async () => {
			const result = await handler(request);
			return normalizeResponse(result);
		});
	};
};

/**
 * Creates an adapter with custom middleware-like behavior.
 */
export function createMiddlewareAdapter(
	beforeHandler?: (ctx: ElysiaContext, routeInfo: RouteInfo) => Promise<undefined | Response>,
	afterHandler?: (
		response: Response,
		ctx: ElysiaContext,
		routeInfo: RouteInfo,
	) => Promise<Response>,
): HandlerAdapter {
	return (handler: NextRouteHandler, routeInfo: RouteInfo, _method: HttpMethod): ElysiaHandler => {
		return async (ctx: ElysiaContext): Promise<Response> => {
			const request = createNextRequest(ctx);
			const params = createNextParams(ctx.params, routeInfo.params);

			return handleFoxenRequest(request, routeInfo, async () => {
				if (beforeHandler) {
					const result = await beforeHandler(ctx, routeInfo);
					if (result instanceof Response) {
						return result;
					}
				}

				let response = await handler(request, { params });
				response = normalizeResponse(response);

				if (afterHandler) {
					response = await afterHandler(response, ctx, routeInfo);
				}

				return response;
			});
		};
	};
}

function normalizeResponse(payload: unknown): Response {
	if (payload instanceof Response) {
		return payload;
	}

	if (payload !== null && payload !== undefined) {
		return new Response(JSON.stringify(payload), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	return new Response(null, { status: 204 });
}

async function handleFoxenRequest(
	request: NextRequest,
	routeInfo: RouteInfo,
	exec: () => Promise<Response>,
): Promise<Response> {
	const foxnContext = createFoxenRequestContext({ request });
	try {
		const response = await withFoxenRequestContext(foxnContext, exec);
		return applyFoxenResponseContext(response, foxnContext);
	} catch (error) {
		if (isInterruptError(error)) {
			const interruptResponse = createInterruptResponse(error);
			return applyFoxenResponseContext(interruptResponse, foxnContext);
		}

		console.error(`[foxen] Error in route ${routeInfo.elysiaPath}:`, error);
		const fallback = new Response(JSON.stringify({ error: 'Internal Server Error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
		return applyFoxenResponseContext(fallback, foxnContext);
	}
}
