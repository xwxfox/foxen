# Basic Example

This example demonstrates using Foxen to create Next.js-style API routes with Elysia, including full support for `next.config.ts` and `middleware.ts`.

## Structure

```
src/
  app/
    api/
      hello/
        route.ts      # GET /api/hello
      users/
        route.ts      # GET, POST /api/users
        [id]/
          route.ts    # GET, PUT, DELETE /api/users/:id
      info/
        route.ts      # GET /api/info (shows request info)

next.config.ts        # Redirects, rewrites, headers configuration
middleware.ts         # Request middleware for auth, logging, etc.
```

## Features Demonstrated

### Next.js Config Features (next.config.ts)

- **Redirects**: `/old-api/*` → `/api/*` (308 permanent)
- **Redirects**: `/v1/users/:id` → `/api/users/:id` (307 temporary)
- **Rewrites**: `/legacy/hello` → `/api/hello` (transparent)
- **Headers**: Custom headers on all `/api/*` routes

### Middleware Features (middleware.ts)

- **Request logging**: Logs all requests with request ID
- **Blocking**: `/api/blocked` returns 403
- **Redirect**: `/redirect-me` → `/api/hello`
- **Rewrite**: `/rewrite-me` → `/api/info`
- **Header injection**: Adds `X-Request-ID` to all responses

## Running

```bash
bun run start
```

This loads routes dynamically at runtime using the adapter with full config support.

## API Endpoints

### Basic Routes
- `GET /health` - Health check
- `GET /api/hello` - Hello world
- `GET /api/users` - List all users
- `POST /api/users` - Create a new user
- `GET /api/users/:id` - Get a specific user
- `PUT /api/users/:id` - Update a user
- `DELETE /api/users/:id` - Delete a user
- `GET /api/info` - Show request information

### Config Features
- `GET /old-api/hello` - Redirects to `/api/hello` (308)
- `GET /v1/users/123` - Redirects to `/api/users/123` (307)
- `GET /legacy/hello` - Rewrites to `/api/hello`

### Middleware Features
- `GET /redirect-me` - Middleware redirect to `/api/hello`
- `GET /rewrite-me` - Middleware rewrite to `/api/info`
- `GET /api/blocked` - Returns 403 (blocked by middleware)

## Testing

```bash
# Basic endpoints
curl http://localhost:3000/api/hello
curl http://localhost:3000/api/users
curl http://localhost:3000/api/info

# Test redirects (follow redirects with -L)
curl -L http://localhost:3000/old-api/hello
curl -L http://localhost:3000/v1/users/123

# Test rewrites (transparent - same URL)
curl http://localhost:3000/legacy/hello

# Test middleware redirect
curl -L http://localhost:3000/redirect-me

# Test middleware rewrite  
curl http://localhost:3000/rewrite-me

# Test blocked endpoint
curl http://localhost:3000/api/blocked

# Check response headers (shows X-Request-ID, X-Powered-By, etc.)
curl -v http://localhost:3000/api/hello 2>&1 | grep -i "x-"
```
