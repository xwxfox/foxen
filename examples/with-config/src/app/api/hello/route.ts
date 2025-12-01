/**
 * Hello endpoint
 *
 * GET /api/hello - Returns a hello message
 */

import { NextRequest, NextResponse } from "@foxen/core";

export async function GET(request: NextRequest) {
    return NextResponse.json({
        message: "Hello from Foxen!",
        timestamp: new Date().toISOString(),
        url: request.nextUrl.pathname,
    });
}
