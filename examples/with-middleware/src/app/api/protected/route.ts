/**
 * Protected endpoint - requires authentication
 *
 * GET /api/protected
 */

import { NextRequest, NextResponse } from "@foxen/core";

export async function GET(request: NextRequest) {
    // User info is added by middleware
    const userId = request.headers.get("X-User-ID");
    const userRole = request.headers.get("X-User-Role");

    return NextResponse.json({
        message: "Welcome to the protected endpoint!",
        user: {
            id: userId,
            role: userRole,
        },
        timestamp: new Date().toISOString(),
        requestId: request.headers.get("X-Request-ID"),
    });
}
