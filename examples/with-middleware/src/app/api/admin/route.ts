/**
 * Admin endpoint - requires admin role
 *
 * GET /api/admin
 */

import { NextRequest, NextResponse } from "@foxen/core";

export async function GET(request: NextRequest) {
    // User info is added by middleware
    const userId = request.headers.get("X-User-ID");
    const userRole = request.headers.get("X-User-Role");

    return NextResponse.json({
        message: "Welcome to the admin dashboard!",
        user: {
            id: userId,
            role: userRole,
        },
        adminFeatures: [
            "User management",
            "System configuration",
            "Analytics dashboard",
            "Audit logs",
        ],
        timestamp: new Date().toISOString(),
        requestId: request.headers.get("X-Request-ID"),
    });
}
