/**
 * Middleware example for Foxen
 *
 * This demonstrates how Foxen supports Next.js middleware.ts:
 * - Request interception
 * - Header modification
 * - Redirects
 * - Rewrites
 */

import { NextResponse } from "@foxen/core";
import type { NextRequest } from "@foxen/core";

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const requestId = crypto.randomUUID().slice(0, 8);

    console.log(`[middleware] ${request.method} ${pathname} (${requestId})`);

    // Example: Block requests to /api/blocked
    if (pathname === "/api/blocked") {
        return new Response(JSON.stringify({ error: "This endpoint is blocked" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Example: Add request ID header to all requests
    const response = NextResponse.next({
        request: {
            headers: new Headers(request.headers),
        },
    });

    // Add custom headers to response
    response.headers.set("X-Request-ID", requestId);
    response.headers.set("X-Middleware-Ran", "true");

    // Example: Redirect /redirect-me to /api/hello
    if (pathname === "/redirect-me") {
        return NextResponse.redirect(new URL("/api/hello", request.url));
    }

    // Example: Rewrite /rewrite-me to /api/info
    if (pathname === "/rewrite-me") {
        return NextResponse.rewrite(new URL("/api/info", request.url));
    }

    return response;
}

// Configure which paths middleware runs on
export const config = {
    matcher: [
        // Match all API routes
        "/api/:path*",
        // Also match these special paths
        "/redirect-me",
        "/rewrite-me",
        "/api/blocked",
    ],
};
