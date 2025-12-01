# @foxen/config

Configuration loading and Next.js config support for Foxen. Handles loading and processing `foxen.config.ts` files with full support for `next.config.ts` features like redirects, rewrites, and headers.

## Installation

```bash
bun add @foxen/config
```

## Usage

### Loading Configuration

```typescript
import { loadFoxenConfig, loadNextConfig } from "@foxen/config";

// Load foxen.config.ts
const foxenConfig = await loadFoxenConfig({
    configPath: "./foxen.config.ts",
});

// Load next.config.ts
const nextConfig = await loadNextConfig({
    configPath: "./next.config.ts",
});
```

### Processing Redirects

```typescript
import { processRedirects, createRedirectResponse } from "@foxen/config";

// In your middleware or handler
const redirect = processRedirects(request.url, nextConfig.redirects);

if (redirect.matched) {
    return createRedirectResponse(redirect.destination, redirect.permanent);
}
```

### Processing Rewrites

```typescript
import { processRewrites, createRewrittenRequest } from "@foxen/config";

const rewrite = processRewrites(request.url, nextConfig.rewrites);

if (rewrite.matched) {
    // Create new request with rewritten URL
    const newRequest = createRewrittenRequest(request, rewrite.destination);
    // Process with new URL...
}
```

### Processing Headers

```typescript
import { processHeaders, applyHeadersToResponse } from "@foxen/config";

// Get headers that should be applied
const headerRules = processHeaders(request.url, nextConfig.headers);

// Apply to response
const response = new Response("OK");
applyHeadersToResponse(response, headerRules);
```

### Path Matching

```typescript
import { matchPath, applyParams } from "@foxen/config";

// Match a path pattern
const result = matchPath("/users/:id", "/users/123");
// { matched: true, params: { id: "123" } }

// Apply params to a destination
const dest = applyParams("/api/users/:id", { id: "123" });
// "/api/users/123"
```

## Configuration Types

### Foxen Config

```typescript
interface FoxenConfig {
    routesDir: string;
    outputDir: string;
    basePath?: string;
    format?: "ts" | "js";
    generateBarrel?: boolean;
    useGroups?: boolean;
    routesAlias?: string;
    tsConfigPath?: string;
    ignorePatterns?: string[];
    elysiaInstanceName?: string;
}
```

### Next.js Config Features

```typescript
// Redirects
interface NextRedirect {
    source: string;
    destination: string;
    permanent: boolean;
    has?: RouteCondition[];
    missing?: RouteCondition[];
}

// Rewrites
interface NextRewrite {
    source: string;
    destination: string;
    has?: RouteCondition[];
    missing?: RouteCondition[];
}

// Headers
interface NextHeader {
    source: string;
    headers: Array<{ key: string; value: string }>;
    has?: RouteCondition[];
    missing?: RouteCondition[];
}
```

## API Reference

### Config Loading

| Function | Description |
|----------|-------------|
| `loadFoxenConfig(options?)` | Load foxen.config.ts |
| `loadNextConfig(options?)` | Load next.config.ts |
| `defineConfig(config)` | Type-safe config helper |
| `findConfigFile(dir)` | Find config file in directory |

### Path Matching

| Function | Description |
|----------|-------------|
| `matchPath(pattern, path)` | Match path against pattern |
| `matchConditions(request, conditions)` | Check route conditions |
| `applyParams(template, params)` | Apply params to template |
| `parsePath(pattern)` | Parse path into segments |

### Redirects

| Function | Description |
|----------|-------------|
| `processRedirects(url, redirects)` | Find matching redirect |
| `processRedirect(url, redirect)` | Process single redirect |
| `createRedirectResponse(url, permanent)` | Create redirect response |

### Rewrites

| Function | Description |
|----------|-------------|
| `processRewrites(url, rewrites)` | Find matching rewrite |
| `processRewrite(url, rewrite)` | Process single rewrite |
| `createRewrittenRequest(request, url)` | Create rewritten request |

### Headers

| Function | Description |
|----------|-------------|
| `processHeaders(url, headers)` | Find matching headers |
| `applyHeadersToResponse(response, headers)` | Apply headers to response |
| `createCorsHeaders(options)` | Generate CORS headers |
| `SECURITY_HEADERS` | Common security headers |

## Examples

### Full next.config.ts Support

```typescript
import {
    loadNextConfig,
    processRedirects,
    processRewrites,
    processHeaders,
} from "@foxen/config";

const config = await loadNextConfig();

// In request handler
function handleRequest(request: Request) {
    const url = new URL(request.url);

    // Check redirects
    const redirect = processRedirects(url.pathname, config.redirects);
    if (redirect.matched) {
        return Response.redirect(redirect.destination, redirect.statusCode);
    }

    // Check rewrites
    const rewrite = processRewrites(url.pathname, config.rewrites);
    if (rewrite.matched) {
        url.pathname = rewrite.destination;
        // Continue with new URL
    }

    // Get response headers
    const headerRules = processHeaders(url.pathname, config.headers);

    // Create response and apply headers
    const response = await handleRoute(request);
    for (const rule of headerRules) {
        for (const h of rule.headers) {
            response.headers.set(h.key, h.value);
        }
    }

    return response;
}
```

## License

MIT
