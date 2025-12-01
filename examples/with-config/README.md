# With Config Example

This example demonstrates using Foxen with `next.config.ts` features:

- **Redirects**: Redirect requests from one URL to another
- **Rewrites**: Transparently proxy requests to a different URL
- **Headers**: Add custom headers to responses

## Structure

```
src/
  app/
    api/
      hello/
        route.ts      # GET /api/hello
      users/
        route.ts      # GET /api/users
        [id]/
          route.ts    # GET /api/users/:id

next.config.ts        # Redirects, rewrites, headers configuration
foxen.config.ts       # Foxen configuration
server.ts             # Server entry point
```

## Features Demonstrated

### Redirects

```typescript
// next.config.ts
async redirects() {
  return [
    // Permanent redirect (308)
    { source: '/old-api/:path*', destination: '/api/:path*', permanent: true },
    // Temporary redirect (307)
    { source: '/v1/users/:id', destination: '/api/users/:id', permanent: false },
  ];
}
```

### Rewrites

```typescript
// next.config.ts
async rewrites() {
  return [
    // Transparent rewrite - URL stays the same but content comes from different path
    { source: '/legacy/hello', destination: '/api/hello' },
  ];
}
```

### Headers

```typescript
// next.config.ts
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'X-Custom-Header', value: 'my-value' },
        { key: 'X-Powered-By', value: 'Foxen' },
      ],
    },
  ];
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
# Test basic endpoint
curl http://localhost:3000/api/hello

# Test redirect (follow with -L)
curl -L http://localhost:3000/old-api/hello
curl -L http://localhost:3000/v1/users/123

# Test rewrite (transparent - same URL)
curl http://localhost:3000/legacy/hello

# Check response headers
curl -v http://localhost:3000/api/hello 2>&1 | grep -i "x-"
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/hello` | Returns hello message |
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get user by ID |

## Config Features

| Original URL | Action | Destination |
|--------------|--------|-------------|
| `/old-api/*` | Redirect (308) | `/api/*` |
| `/v1/users/:id` | Redirect (307) | `/api/users/:id` |
| `/legacy/hello` | Rewrite | `/api/hello` |

## Learn More

- [Next.js Redirects](https://nextjs.org/docs/app/api-reference/next-config-js/redirects)
- [Next.js Rewrites](https://nextjs.org/docs/app/api-reference/next-config-js/rewrites)
- [Next.js Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)
