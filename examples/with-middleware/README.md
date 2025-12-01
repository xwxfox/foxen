# With Middleware Example

This example demonstrates using Foxen with `middleware.ts` for request processing:

- **Authentication**: Check for auth tokens and protect routes
- **Logging**: Log all requests with timing information
- **Path-based rules**: Apply middleware only to matching paths
- **Request/Response modification**: Modify headers, cookies, etc.

## Structure

```
src/
  app/
    api/
      public/
        route.ts      # GET /api/public (no auth required)
      protected/
        route.ts      # GET /api/protected (requires auth)
      admin/
        route.ts      # GET /api/admin (requires admin role)
      users/
        route.ts      # GET /api/users

middleware.ts         # Request middleware
foxen.config.ts       # Foxen configuration
server.ts             # Server entry point
```

## Features Demonstrated

### Basic Middleware

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "@foxen/core";

export function middleware(request: NextRequest) {
    // Log request
    console.log(`${request.method} ${request.nextUrl.pathname}`);

    // Add request ID header
    const response = NextResponse.next();
    response.headers.set("X-Request-ID", crypto.randomUUID());

    return response;
}
```

### Middleware Config with Matchers

```typescript
// middleware.ts
export const config = {
    matcher: [
        // Match all API routes except public ones
        "/api/((?!public).*)",
        // Or use specific paths
        "/api/protected/:path*",
        "/api/admin/:path*",
    ],
};
```

### Authentication Middleware

```typescript
export function middleware(request: NextRequest) {
    const token = request.cookies.get("token")?.value;

    if (!token) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
        );
    }

    // Validate token and proceed
    return NextResponse.next();
}
```

### Redirect and Rewrite

```typescript
export function middleware(request: NextRequest) {
    // Redirect example
    if (request.nextUrl.pathname === "/old-path") {
        return NextResponse.redirect(new URL("/new-path", request.url));
    }

    // Rewrite example (URL stays same, content from different path)
    if (request.nextUrl.pathname === "/alias") {
        return NextResponse.rewrite(new URL("/api/actual", request.url));
    }

    return NextResponse.next();
}
```

## Running

```bash
# Install dependencies
bun install

# Start the server
bun run start
```

## Testing

```bash
# Public endpoint (no auth needed)
curl http://localhost:3000/api/public

# Protected endpoint without token (401)
curl http://localhost:3000/api/protected

# Protected endpoint with token
curl -H "Authorization: Bearer test-token" http://localhost:3000/api/protected

# Admin endpoint without admin role (403)
curl -H "Authorization: Bearer user-token" http://localhost:3000/api/admin

# Admin endpoint with admin role
curl -H "Authorization: Bearer admin-token" http://localhost:3000/api/admin

# Check request ID header
curl -v http://localhost:3000/api/users 2>&1 | grep "X-Request-ID"
```

## API Endpoints

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/api/public` | No | Public endpoint |
| GET | `/api/protected` | Yes | Protected endpoint |
| GET | `/api/admin` | Admin only | Admin endpoint |
| GET | `/api/users` | Yes | List users |

## Learn More

- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Middleware Matchers](https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher)
