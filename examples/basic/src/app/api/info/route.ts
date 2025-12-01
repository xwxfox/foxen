/**
 * Example: /api/info route
 * Shows request information using helpers
 */

import { NextResponse } from "@foxen/core";
import type { NextRequest } from "@foxen/core";
import { userAgent, getIP, getGeo } from "@foxen/helpers";

export async function GET(request: NextRequest) {
    // Parse user agent
    const ua = userAgent(request);

    // Get client information
    const ip = getIP(request);
    const geo = getGeo(request);

    return NextResponse.json({
        userAgent: {
            browser: ua.browser,
            os: ua.os,
            device: ua.device,
            isBot: ua.isBot,
        },
        ip,
        geo,
        url: {
            pathname: request.nextUrl.pathname,
            search: request.nextUrl.search,
            host: request.nextUrl.host,
        },
        headers: {
            accept: request.headers.get("accept"),
            contentType: request.headers.get("content-type"),
        },
    });
}
