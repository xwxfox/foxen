# @foxen/core

Core runtime for Next.js App Router compatibility. Provides 1:1 compatible implementations of Next.js server APIs for use with Elysia and Bun.

## Installation

```bash
bun add @foxen/core
```

## Usage

### NextRequest

```typescript
import { NextRequest } from "@foxen/core";

export async function GET(request: NextRequest) {
    // URL and path info
    const pathname = request.nextUrl.pathname;
    const searchParams = request.nextUrl.searchParams;

    // Headers
    const userAgent = request.headers.get("user-agent");

    // Cookies
    const token = request.cookies.get("token");

    // Geo and IP (when available)
    const ip = request.ip;
    const geo = request.geo;

    return NextResponse.json({ pathname, userAgent });
}
```

### NextResponse

```typescript
import { NextResponse } from "@foxen/core";

// JSON response
return NextResponse.json({ message: "Hello" });

// With status code
return NextResponse.json({ error: "Not found" }, { status: 404 });

// Redirect
return NextResponse.redirect(new URL("/login", request.url));

// Rewrite (transparent)
return NextResponse.rewrite(new URL("/api/v2/users", request.url));

// Continue to next handler (middleware)
return NextResponse.next();

// With headers
const response = NextResponse.json({ data: "..." });
response.headers.set("X-Custom-Header", "value");
return response;

// With cookies
const response = NextResponse.json({ success: true });
response.cookies.set("session", "abc123", { httpOnly: true });
return response;
```

### Cookies

```typescript
import { NextRequest, NextResponse } from "@foxen/core";

export async function POST(request: NextRequest) {
    // Read cookies from request
    const sessionId = request.cookies.get("session")?.value;
    const allCookies = request.cookies.getAll();

    // Create response with cookies
    const response = NextResponse.json({ success: true });

    // Set cookie
    response.cookies.set("token", "abc123", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 60 * 60 * 24, // 1 day
    });

    // Delete cookie
    response.cookies.delete("old-cookie");

    return response;
}
```

### Error Handling

```typescript
import { FoxenError, ConfigError, RouteError, formatError } from "@foxen/core";

// Throw specific error types
throw new ConfigError("Config file not found", "CONFIG_NOT_FOUND", {
    path: "./foxen.config.ts",
});

throw new RouteError("No handlers exported", "ROUTE_NO_HANDLERS", {
    filePath: "./src/app/api/users/route.ts",
});

// Format errors for CLI display
try {
    // ... some operation
} catch (error) {
    console.error(formatError(error));
    // Output includes error message, code, phase, details, and suggestion
}
```

## API Reference

### NextRequest

| Property/Method | Description |
|-----------------|-------------|
| `nextUrl` | NextURL instance with pathname, searchParams, etc. |
| `cookies` | RequestCookies instance |
| `headers` | Standard Headers object |
| `method` | HTTP method (GET, POST, etc.) |
| `ip` | Client IP address (when available) |
| `geo` | Geolocation data (when available) |

### NextResponse

| Method | Description |
|--------|-------------|
| `NextResponse.json(body, init?)` | Create JSON response |
| `NextResponse.redirect(url, status?)` | Create redirect response |
| `NextResponse.rewrite(url)` | Create rewrite response |
| `NextResponse.next(init?)` | Continue to next handler |
| `response.cookies` | ResponseCookies instance |
| `response.headers` | Standard Headers object |

### Error Types

| Error Class | Use Case |
|-------------|----------|
| `FoxenError` | Base error class |
| `ConfigError` | Configuration issues |
| `RouteError` | Route loading issues |
| `MiddlewareError` | Middleware issues |
| `SchemaError` | Schema validation issues |
| `CompileError` | Compilation issues |
| `RuntimeError` | Runtime issues |

## Compatibility

This package aims for 100% API compatibility with Next.js server components:

- NextRequest
- NextResponse
- NextURL
- RequestCookies
- ResponseCookies
- cookies() (via request.cookies)
- headers() (via request.headers)

## License

MIT
