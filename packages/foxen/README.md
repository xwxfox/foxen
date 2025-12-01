# foxen

Meta package that re-exports everything from all Foxen packages, providing a single import for the complete framework.

## Installation

```bash
bun add foxen
```

This installs all Foxen packages:
- `@foxen/core` - NextRequest, NextResponse, cookies
- `@foxen/helpers` - userAgent, geo, IP detection
- `@foxen/config` - Configuration and next.config.ts support
- `@foxen/middleware` - middleware.ts support
- `@foxen/adapter` - Runtime Elysia plugin
- `@foxen/cli` - Command-line tools

## Quick Start

```typescript
import { Elysia } from "elysia";
import { NextRequest, NextResponse, appRouter, defineConfig } from "foxen";

// Create server with routes
const app = new Elysia()
    .use(await appRouter({ apiDir: "./src/app/api" }))
    .listen(3000);
```

## What's Included

### Core Runtime

```typescript
import {
    // Request/Response
    NextRequest,
    NextResponse,
    NextURL,

    // Cookies
    RequestCookies,
    ResponseCookies,

    // Types
    type HttpMethod,
    type NextRouteHandler,
} from "foxen";
```

### Helpers

```typescript
import {
    userAgent,
    type UserAgent,
} from "foxen";
```

### Configuration

```typescript
import {
    // Config loading
    loadFoxenConfig,
    loadNextConfig,
    defineConfig,
    defineFoxenConfig,

    // Path matching
    matchPath,
    matchConditions,
    applyParams,

    // Request processing
    processRedirects,
    processRewrites,
    processHeaders,
} from "foxen";
```

### Adapter

```typescript
import {
    appRouter,
    createApp,
    scanDirectory,
    convertPathToElysia,
    type AppRouterConfig,
} from "foxen";
```

### Middleware

```typescript
import {
    loadMiddleware,
    executeMiddleware,
    shouldRunMiddleware,
    NextFetchEvent,
} from "foxen";
```

### CLI Configuration

```typescript
import { defineConfig, type Config } from "foxen";

// foxen.config.ts
export default defineConfig({
    routesDir: "./src/app/api",
    outputDir: "./src/generated",
    basePath: "/api",
});
```

### TypeBox (from Elysia)

```typescript
import { t } from "foxen";

// Use for schemas
const UserSchema = t.Object({
    id: t.String(),
    name: t.String(),
    email: t.String({ format: "email" }),
});
```

## Usage Example

```typescript
// server.ts
import { Elysia } from "elysia";
import { appRouter, NextRequest, NextResponse } from "foxen";

const app = new Elysia()
    .get("/health", () => ({ status: "ok" }))
    .use(
        await appRouter({
            apiDir: "./src/app/api",
            middlewarePath: "./middleware.ts",
            nextConfigPath: "./next.config.ts",
            features: {
                redirects: true,
                rewrites: true,
                headers: true,
                middleware: true,
            },
        }),
    )
    .listen(3000);
```

```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "foxen";

export async function GET(request: NextRequest) {
    const users = await getUsers();
    return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const user = await createUser(body);
    return NextResponse.json(user, { status: 201 });
}
```

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "foxen";

export function middleware(request: NextRequest) {
    const token = request.cookies.get("token");

    if (!token && request.nextUrl.pathname.startsWith("/api/protected")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: "/api/:path*",
};
```

## CLI Commands

```bash
# Initialize configuration
bunx foxen init

# Generate routes
bunx foxen generate

# Start dev server
bunx foxen dev

# Migrate Next.js project
bunx foxen migrate ./my-app
```

## When to Use

**Use `foxen` when:**
- You want the simplest setup
- You need all features
- You're building a new project

**Use individual packages when:**
- You only need specific functionality
- You want minimal bundle size
- You're integrating with existing code

## Package Structure

```
foxen (meta package)
├── @foxen/core      → NextRequest, NextResponse
├── @foxen/helpers   → userAgent, geo, IP
├── @foxen/config    → Configuration, next.config.ts
├── @foxen/middleware → middleware.ts support
├── @foxen/adapter   → Elysia runtime plugin
└── @foxen/cli       → CLI tools
```

## License

MIT
