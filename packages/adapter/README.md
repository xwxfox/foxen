# @foxen/adapter

Runtime Elysia plugin for loading and executing Next.js App Router style routes.

## Installation

```bash
bun add @foxen/adapter
```

## Usage

### Basic Setup

```typescript
import { Elysia } from "elysia";
import { appRouter } from "@foxen/adapter";

const app = new Elysia()
    .use(
        await appRouter({
            apiDir: "./src/app/api",
        }),
    )
    .listen(3000);
```

### With All Features

```typescript
import { Elysia } from "elysia";
import { appRouter } from "@foxen/adapter";

const app = new Elysia()
    .use(
        await appRouter({
            // Required: API routes directory
            apiDir: "./src/app/api",

            // Optional: Project root for resolving relative paths
            projectRoot: import.meta.dir,

            // Optional: Path to next.config.ts for redirects/rewrites/headers
            nextConfigPath: "./next.config.ts",

            // Optional: Path to middleware.ts
            middlewarePath: "./middleware.ts",

            // Optional: Feature flags
            features: {
                redirects: true,
                rewrites: true,
                headers: true,
                middleware: true,
            },

            // Optional: Verbose logging
            verbose: true,
        }),
    )
    .listen(3000);
```

### Route File Structure

Routes follow the Next.js App Router convention:

```
src/app/api/
├── users/
│   ├── route.ts           # GET, POST /api/users
│   └── [id]/
│       └── route.ts       # GET, PUT, DELETE /api/users/:id
├── posts/
│   └── [[...slug]]/
│       └── route.ts       # /api/posts, /api/posts/a, /api/posts/a/b/c
└── health/
    └── route.ts           # GET /api/health
```

### Writing Routes

```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "@foxen/core";

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

### Dynamic Routes

```typescript
// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from "@foxen/core";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const user = await getUser(id);

    if (!user) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiDir` | `string` | - | **Required.** Path to API routes directory |
| `projectRoot` | `string` | `process.cwd()` | Project root for resolving paths |
| `nextConfigPath` | `string` | - | Path to `next.config.ts` |
| `middlewarePath` | `string` | - | Path to `middleware.ts` |
| `features` | `object` | All enabled | Feature flags |
| `verbose` | `boolean` | `false` | Enable verbose logging |

### Feature Flags

```typescript
features: {
    redirects: true,   // Enable next.config.ts redirects
    rewrites: true,    // Enable next.config.ts rewrites
    headers: true,     // Enable next.config.ts headers
    middleware: true,  // Enable middleware.ts
}
```

## API Reference

### appRouter(options)

Create an Elysia plugin that loads routes from a directory.

```typescript
import { appRouter } from "@foxen/adapter";

const plugin = await appRouter(options);
app.use(plugin);
```

### createApp(options)

Create a complete Elysia app with routes loaded.

```typescript
import { createApp } from "@foxen/adapter";

const app = await createApp({
    apiDir: "./src/app/api",
    port: 3000,
});
```

### Context Utilities

```typescript
import { createNextRequest, getFoxenContext } from "@foxen/adapter";

// Create NextRequest from Elysia context
const nextRequest = createNextRequest(elysiaContext);

// Get Foxen context from Elysia context
const foxenCtx = getFoxenContext(elysiaContext);
```

## License

MIT
