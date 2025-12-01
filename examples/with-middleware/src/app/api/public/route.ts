/**
 * Public endpoint - no authentication required
 *
 * GET /api/public
 */

import { NextRequest, NextResponse } from "@foxen/core";

export async function GET(request: NextRequest) {
    return NextResponse.json({
        message: "This is a public endpoint - no auth required!",
        timestamp: new Date().toISOString(),
        requestId: request.headers.get("X-Request-ID"),
    });
}
