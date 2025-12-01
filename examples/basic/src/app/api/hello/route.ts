/**
 * Example: GET /api/hello
 * Basic hello world endpoint
 */

import { NextResponse } from "@foxen/core";
import type { NextRequest } from "@foxen/core";

export async function GET(request: NextRequest) {
    return NextResponse.json({
        message: "Hello, World!",
        timestamp: new Date().toISOString(),
    });
}
