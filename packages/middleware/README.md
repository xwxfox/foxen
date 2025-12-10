# @foxen/middleware

Handles loading and executing `middleware.ts` (and `proxy.ts`) files, providing full Next.js middleware compatibility.

## Installation

```bash
bun add @foxen/middleware
```

## Usage

### Basic Usage

```typescript
import { loadMiddleware, executeMiddleware } from "@foxen/middleware";
import { NextRequest } from "@foxen/core";

// Load middleware from project
const middleware = await loadMiddleware({
    projectRoot: process.cwd(),
});

// Execute for a request
const request = new NextRequest("https://example.com/api/users");
const result = await executeMiddleware(request, middleware);

if (result.response) {
    // Middleware returned a response (redirect, error, etc.)
    return result.response;
}

// Continue to route handler
// Headers from middleware are in result.headers
```

### Checking Path Matching

```typescript
import {
    loadMiddleware,
    shouldRunMiddleware,
    executeMiddleware,
} from "@foxen/middleware";

const middleware = await loadMiddleware({ projectRoot: "." });

if (middleware) {
    const pathname = new URL(request.url).pathname;

    // Check if middleware should run for this path
    if (shouldRunMiddleware(pathname, middleware.matchers)) {
        const result = await executeMiddleware(request, middleware.handler);
        // ...
    }
}
```

### Writing Middleware

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "@foxen/core";

export function middleware(request: NextRequest) {
    // Check auth
    const token = request.cookies.get("token");
    if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Add headers
    const response = NextResponse.next();
    response.headers.set("X-Custom-Header", "value");
    return response;
}

export const config = {
    matcher: ["/api/:path*", "/dashboard/:path*"],
};
```

## Middleware Response Types

Middleware can return different types of responses:

```typescript
// Continue to handler (with optional header modifications)
return NextResponse.next();

// Redirect
return NextResponse.redirect(new URL("/new-path", request.url));

// Rewrite (transparent URL change)
return NextResponse.rewrite(new URL("/actual-path", request.url));

// Return response directly
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Return nothing (implicit next())
return;
```

## Matcher Configuration

### Simple Patterns

```typescript
export const config = {
    matcher: "/api/:path*", // Single pattern
};

export const config = {
    matcher: ["/api/:path*", "/admin/:path*"], // Multiple patterns
};
```

### Complex Matchers

```typescript
export const config = {
    matcher: [
        {
            source: "/api/:path*",
            has: [{ type: "header", key: "authorization" }],
        },
        {
            source: "/admin/:path*",
            missing: [{ type: "cookie", key: "admin-session" }],
        },
    ],
};
```

### Pattern Syntax

| Pattern | Description | Example |
|---------|-------------|---------|
| `/path` | Exact match | `/api/users` |
| `/path/:param` | Named parameter | `/api/users/:id` |
| `/path/:param*` | Catch-all | `/api/:path*` |
| `/path/:param?` | Optional parameter | `/api/users/:id?` |
| `/(group)/path` | Route group (ignored) | `/(auth)/login` |

## API Reference

### Loading

| Function | Description |
|----------|-------------|
| `loadMiddleware(options)` | Load middleware from project |
| `normalizeMatchers(config)` | Normalize matcher configuration |
| `middlewareFileExists(projectRoot)` | Check if middleware file exists |

### Matching

| Function | Description |
|----------|-------------|
| `shouldRunMiddleware(pathname, matchers)` | Check if middleware should run |
| `pathToRegex(pattern)` | Convert pattern to regex |
| `compileMatchers(matchers)` | Compile matchers for fast matching |
| `testPathMatch(pathname, pattern)` | Test single path pattern |

### Execution

| Function | Description |
|----------|-------------|
| `executeMiddleware(request, handler)` | Execute middleware handler |
| `parseMiddlewareResponse(response)` | Parse middleware response type |
| `applyMiddlewareHeaders(response, headers)` | Apply headers from middleware |

### Interrupt Handling

Foxen routes can throw interrupts from `@foxen/navigation` (for example, `redirect()` or `notFound()`).
Use the `foxnInterruptHandler` plugin to translate those interrupts into HTTP responses when building
your own Elysia apps.

```typescript
import { Elysia } from "elysia";
import { foxnInterruptHandler } from "@foxen/middleware";
import { redirect } from "@foxen/navigation";

const app = new Elysia()
    .use(foxnInterruptHandler({
        onUnauthorized: () => new Response("nope", { status: 401 }),
    }))
    .get("/api/secure", () => {
        redirect("/login");
    });
```

The handler accepts `FoxnInterruptResponseOptions`, allowing custom overrides for redirect/not-found/
unauthorized/forbidden interrupts and default headers that should be applied to every generated
response.

### Event

| Function | Description |
|----------|-------------|
| `NextFetchEvent` | Fetch event class |
| `createNextFetchEvent(request)` | Create fetch event for middleware |

## Types

```typescript
// Middleware handler function
type MiddlewareHandler = (
    request: NextRequest,
    event?: NextFetchEvent,
) => NextResponse | Response | void | Promise<NextResponse | Response | void>;

// Middleware configuration
interface MiddlewareConfig {
    matcher?: string | string[] | MiddlewareMatcher[];
}

// Complex matcher
interface MiddlewareMatcher {
    source: string;
    has?: RouteCondition[];
    missing?: RouteCondition[];
}

// Route condition
interface RouteCondition {
    type: "header" | "cookie" | "query" | "host";
    key: string;
    value?: string;
}

// Execution result
interface MiddlewareResult {
    response?: Response;
    headers: Headers;
    rewriteUrl?: string;
    redirectUrl?: string;
    continue: boolean;
}
```

## Examples

### Authentication Middleware

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "@foxen/core";
import { verifyJWT } from "./lib/jwt";

export async function middleware(request: NextRequest) {
    const token = request.cookies.get("token")?.value;

    if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
        const user = await verifyJWT(token);
        const response = NextResponse.next();
        response.headers.set("X-User-ID", user.id);
        return response;
    } catch {
        return NextResponse.redirect(new URL("/login", request.url));
    }
}

export const config = {
    matcher: ["/api/((?!public).*)", "/dashboard/:path*"],
};
```

### Rate Limiting Middleware

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "@foxen/core";

const rateLimit = new Map<string, number[]>();

export function middleware(request: NextRequest) {
    const ip = request.ip ?? "unknown";
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const max = 100; // Max requests per window

    const requests = rateLimit.get(ip) ?? [];
    const windowStart = now - windowMs;
    const recentRequests = requests.filter((t) => t > windowStart);

    if (recentRequests.length >= max) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429 },
        );
    }

    recentRequests.push(now);
    rateLimit.set(ip, recentRequests);

    return NextResponse.next();
}

export const config = {
    matcher: "/api/:path*",
};
```

## License

MIT
