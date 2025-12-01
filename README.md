# Foxen

Making Elysia accessible for soydevs & triangle enthusiasts.

> work in progress - do NOT use this for anything important (yet) :3


[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white&style=for-the-badge)](https://bun.sh)
[![Elysia](https://img.shields.io/badge/Elysia-7c3aed.svg?style=for-the-badge)](https://elysiajs.com)
[![NextJS](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)

## Features

- Compatible `NextRequest`, `NextResponse`, `cookies()`, `headers()` APIs
- Create full-fledged Elysia projects from your NextJS api.
- Aiming to be a drop-in replacement for NextJS's API server
- Adding the NextJS sugar, and DX to Elysia :3
- Next.js App Router file-based routing conventions
- TypeScript support with Eden Treaty integration
- Runtime mode for dev, compiled mode for production
- OpenAPI/Swagger generation from TypeBox schemas
- Supports `next.config.ts` and `middleware.ts`

---

## Packages

| Package | Description |
|---------|-------------|
| [`foxen`](./packages/foxen) | Meta package - batteries included |
| [`@foxen/core`](./packages/core) | NextRequest, NextResponse, cookies, headers |
| [`@foxen/helpers`](./packages/helpers) | userAgent, geolocation, IP detection |
| [`@foxen/adapter`](./packages/adapter) | Runtime Elysia plugin |
| [`@foxen/compiler`](./packages/compiler) | Code generation with ts-morph |
| [`@foxen/cli`](./packages/cli) | CLI tools (init, dev, generate, migrate) |
| [`@foxen/config`](./packages/config) | Configuration + next.config.ts support |
| [`@foxen/middleware`](./packages/middleware) | middleware.ts support |
| [`@foxen/env`](./packages/env) | .env loader with type-safety & added sugar |

---

## Quick Start

```bash
# Install the meta package (includes everything)
bun add foxen elysia

# Or install individual packages
bun add @foxen/cli @foxen/adapter @foxen/core elysia
```

### 1. Initialize

```bash
bunx foxen init
```

### 2. Create a Route

```typescript
// src/app/api/hello/route.ts
import { NextRequest, NextResponse } from '@foxen/core';

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Hello from Foxen!' });
}
```

### 3. Start Development

```bash
bunx foxen dev
```

### 4. Generate for Production

```bash
bunx foxen generate
```

---

## Usage Modes

### Runtime Mode (Development)

Load routes dynamically at runtime - perfect for development:

```typescript
import { Elysia } from 'elysia';
import { appRouter } from '@foxen/adapter';

const app = new Elysia()
  .use(await appRouter({
    apiDir: './src/app/api',
    middlewarePath: './middleware.ts',
    nextConfigPath: './next.config.ts',
  }))
  .listen(3000);

console.log('Server running on http://localhost:3000');
```

### Compiled Mode (Production)

Generate optimized Elysia routes with full type safety:

```typescript
import { Elysia } from 'elysia';
import { router } from './generated/router';

const app = new Elysia()
  .use(router)
  .listen(3000);

// Export type for Eden Treaty
export type App = typeof app;
```

---

## Writing Routes

Routes work exactly like Next.js App Router:

```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from '@foxen/core';

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get('page') ?? '1';
  const users = await getUsers({ page: parseInt(page) });
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
import { NextRequest, NextResponse } from '@foxen/core';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUser(id);
  
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  return NextResponse.json(user);
}
```

### Catch-All Routes

```typescript
// src/app/api/docs/[...slug]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  // slug = ['guides', 'getting-started'] for /api/docs/guides/getting-started
  return NextResponse.json({ path: slug.join('/') });
}
```

---

### Middleware

```typescript
// middleware.ts
import { NextRequest, NextResponse } from '@foxen/core';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token');
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const response = NextResponse.next();
  response.headers.set('X-Request-ID', crypto.randomUUID());
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

---

## Configuration

### foxen.config.ts

```typescript
import { defineConfig } from '@foxen/cli';

export default defineConfig({
  routesDir: './src/app/api',
  outputDir: './src/generated',
  basePath: '/api',
  format: 'ts',
  generateBarrel: true,
});
```

### next.config.ts Support

Foxen supports `next.config.ts` features like redirects, rewrites, and headers:

```typescript
// next.config.ts
export default {
  async redirects() {
    return [
      { source: '/old-api/:path*', destination: '/api/:path*', permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: '/v1/users', destination: '/api/users' },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Powered-By', value: 'Foxen' },
        ],
      },
    ];
  },
};
```

---

## Type Safety with Schemas

Add schemas for OpenAPI documentation and end-to-end type safety:

```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from '@foxen/core';
import { t } from 'elysia';

export async function GET(request: NextRequest) {
  return NextResponse.json({ users: [] });
}

// Schema for OpenAPI + Eden Treaty
export const schema = {
  GET: {
    query: t.Object({
      page: t.Optional(t.Number({ default: 1 })),
      limit: t.Optional(t.Number({ default: 10 })),
    }),
    response: t.Object({
      users: t.Array(t.Object({
        id: t.String(),
        name: t.String(),
        email: t.String(),
      })),
    }),
    tags: ['users'],
    summary: 'List all users',
  },
};
```

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `foxen init` | Initialize foxen.config.ts |
| `foxen dev` | Start dev server with hot reload |
| `foxen dev --port 8080` | Custom port |
| `foxen generate` | Generate optimized routes |
| `foxen generate --watch` | Watch mode |
| `foxen migrate <src> <dest>` | Migrate Next.js project |

---

## Examples

See the [examples](./examples) directory:

| Example | Description |
|---------|-------------|
| [basic](./examples/basic) | Simple routes with middleware and config |
| [with-config](./examples/with-config) | Redirects, rewrites, headers |
| [with-middleware](./examples/with-middleware) | Authentication middleware |
| [with-swagger](./examples/with-swagger) | OpenAPI/Swagger integration |

---

## Migration from Next.js

### Step 1: Install Foxen

```bash
bun add foxen elysia
```

### Step 2: Update Imports

```diff
- import { NextRequest, NextResponse } from 'next/server';
+ import { NextRequest, NextResponse } from '@foxen/core';
```

### Step 3: Create Server Entry

```typescript
// server.ts
import { Elysia } from 'elysia';
import { appRouter } from '@foxen/adapter';

const app = new Elysia()
  .use(await appRouter({ apiDir: './src/app/api' }))
  .listen(3000);
```

### Step 4: Run

```bash
bun run server.ts
```

---

## FAQ

<details>
<summary><strong>Can I use this alongside Next.js?</strong></summary>

Yes! You can run Foxen on a separate port for your API while keeping your Next.js frontend. This is a great way to incrementally migrate.
</details>

<details>
<summary><strong>What about edge runtime?</strong></summary>

Foxen runs on Bun, not edge. If you need edge, consider keeping those routes in Next.js.
</details>

<details>
<summary><strong>Is params a Promise?</strong></summary>

Yes! Following Next.js 15's async params pattern, route params are accessed via `await params` for better consistency.
</details>

<details>
<summary><strong>Can I use database ORMs?</strong></summary>

Absolutely! Prisma, Drizzle, and other ORMs work great with Bun. Just import and use them in your route handlers.
</details>

---

## Comparison

| Feature | Next.js | Foxen |
|---------|---------|-------|
| File-based routing | Yes | Yes |
| NextRequest/NextResponse | Yes | Yes |
| Middleware | Yes | Yes |
| cookies()/headers() | Yes | Yes |
| Dynamic routes | Yes | Yes |
| Catch-all routes | Yes | Yes |
| next.config.ts features | Yes | Yes |
| Runtime | Node.js | Bun |
| Framework | Next.js | Elysia |
| OpenAPI generation | No | Yes |
| Eden Treaty types | No | Yes |
| Performance | Baseline | ~10x faster |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                      │
├─────────────────────────────────────────────────────────┤
│  app/api/                                                │
│  ├── users/route.ts      → GET, POST /api/users         │
│  └── users/[id]/route.ts → GET, PUT  /api/users/:id     │
├─────────────────────────────────────────────────────────┤
│                    @foxen/compiler                       │
│       Analyzes → Generates optimized Elysia code        │
├─────────────────────────────────────────────────────────┤
│                    @foxen/adapter                        │
│       NextRequest/Response → Elysia context             │
├─────────────────────────────────────────────────────────┤
│                     @foxen/core                          │
│    1:1 Next.js compatible: NextRequest, NextResponse    │
├─────────────────────────────────────────────────────────┤
│                        Elysia                            │
│         Type-safe, high-performance framework           │
├─────────────────────────────────────────────────────────┤
│                          Bun                             │
│                Fast JavaScript runtime                   │
└─────────────────────────────────────────────────────────┘
```

---

## Contributing

Contributions are welcome! Please open an issue or PR.

```bash
# Clone and install
git clone https://github.com/your-username/foxen.git
cd foxen
bun install

# Run tests
bun test

# Build all packages
bun run build
```

---

## License

MIT
