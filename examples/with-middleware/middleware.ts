/**
 * Middleware for request processing
 *
 * This middleware demonstrates:
 * - Request logging with timing
 * - Authentication and authorization
 * - Request ID injection
 * - Conditional route handling
 */

import { NextRequest, NextResponse } from "@foxen/core";

// Simple token validation (in production, use proper JWT validation)
const TOKENS: Record<string, { userId: string; role: string }> = {
    "test-token": { userId: "1", role: "user" },
    "user-token": { userId: "2", role: "user" },
    "admin-token": { userId: "3", role: "admin" },
};

/**
 * Main middleware function
 */
export function middleware(request: NextRequest) {
    const startTime = performance.now();
    const requestId = crypto.randomUUID();
    const pathname = request.nextUrl.pathname;

    // Log incoming request
    console.log(`→ ${request.method} ${pathname} [${requestId}]`);

    // =========================================================================
    // Public routes - no auth required
    // =========================================================================
    if (pathname.startsWith("/api/public") || pathname === "/health") {
        const response = NextResponse.next();
        response.headers.set("X-Request-ID", requestId);
        logTiming(startTime, pathname, 200);
        return response;
    }

    // =========================================================================
    // Protected routes - require authentication
    // =========================================================================
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || request.cookies.get("token")?.value;

    if (!token) {
        logTiming(startTime, pathname, 401);
        return NextResponse.json(
            {
                error: "Unauthorized",
                message: "Authentication required. Provide a Bearer token.",
                code: "UNAUTHORIZED",
            },
            {
                status: 401,
                headers: {
                    "X-Request-ID": requestId,
                    "WWW-Authenticate": 'Bearer realm="api"',
                },
            },
        );
    }

    // Validate token
    const user = TOKENS[token];
    if (!user) {
        logTiming(startTime, pathname, 401);
        return NextResponse.json(
            {
                error: "Invalid token",
                message: "The provided token is not valid.",
                code: "INVALID_TOKEN",
            },
            {
                status: 401,
                headers: { "X-Request-ID": requestId },
            },
        );
    }

    // =========================================================================
    // Admin routes - require admin role
    // =========================================================================
    if (pathname.startsWith("/api/admin") && user.role !== "admin") {
        logTiming(startTime, pathname, 403);
        return NextResponse.json(
            {
                error: "Forbidden",
                message: "Admin access required for this endpoint.",
                code: "FORBIDDEN",
            },
            {
                status: 403,
                headers: { "X-Request-ID": requestId },
            },
        );
    }

    // =========================================================================
    // Proceed with authenticated request
    // =========================================================================
    const response = NextResponse.next();

    // Add request metadata headers
    response.headers.set("X-Request-ID", requestId);
    response.headers.set("X-User-ID", user.userId);
    response.headers.set("X-User-Role", user.role);

    logTiming(startTime, pathname, 200);
    return response;
}

/**
 * Log request timing
 */
function logTiming(startTime: number, pathname: string, status: number) {
    const duration = (performance.now() - startTime).toFixed(2);
    const statusIndicator = status < 400 ? "OK" : "ERR";
    console.log(`<- [${statusIndicator}] ${pathname} ${status} (${duration}ms)`);
}

/**
 * Middleware configuration
 *
 * The matcher defines which routes this middleware applies to.
 * Routes not matching will skip the middleware entirely.
 */
export const config = {
    matcher: [
        // Match all API routes
        "/api/:path*",
        // Match health check
        "/health",
    ],
};
