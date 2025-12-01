# @foxen/helpers

Utility functions that complement `@foxen/core`, including user agent parsing, geolocation, IP detection, and path matching.

## Installation

```bash
bun add @foxen/helpers
```

## Usage

### User Agent Parsing

```typescript
import { userAgent } from "@foxen/helpers";
import type { NextRequest } from "@foxen/core";

export async function GET(request: NextRequest) {
    const ua = userAgent(request);

    return NextResponse.json({
        browser: ua.browser, // { name: 'Chrome', version: '120.0.0' }
        os: ua.os, // { name: 'macOS', version: '14.0' }
        device: ua.device, // { type: 'desktop', vendor: 'Apple', model: 'Macintosh' }
        engine: ua.engine, // { name: 'Blink', version: '120.0.0' }
        cpu: ua.cpu, // { architecture: 'arm64' }
        isBot: ua.isBot, // false
    });
}
```

### Geolocation

```typescript
import { geolocation } from "@foxen/helpers";
import type { NextRequest } from "@foxen/core";

export async function GET(request: NextRequest) {
    const geo = geolocation(request);

    return NextResponse.json({
        city: geo.city, // 'San Francisco'
        country: geo.country, // 'US'
        region: geo.region, // 'CA'
        latitude: geo.latitude, // '37.7749'
        longitude: geo.longitude, // '-122.4194'
    });
}
```

### IP Address Detection

```typescript
import { ipAddress } from "@foxen/helpers";
import type { NextRequest } from "@foxen/core";

export async function GET(request: NextRequest) {
    const ip = ipAddress(request);

    return NextResponse.json({
        ip, // '192.168.1.1' or '::1'
    });
}
```

### Path Matching

```typescript
import { pathMatcher, matchPath } from "@foxen/helpers";

// Create a matcher function
const isApiRoute = pathMatcher("/api/:path*");
const isUserRoute = pathMatcher("/api/users/:id");

// Check paths
isApiRoute("/api/users"); // true
isApiRoute("/api/users/123"); // true
isApiRoute("/about"); // false

isUserRoute("/api/users/123"); // true
isUserRoute("/api/users"); // false

// Extract params
const match = matchPath("/api/users/:id", "/api/users/123");
// { params: { id: '123' }, matched: true }
```

### Request Matchers

```typescript
import { matchesMiddleware } from "@foxen/helpers";

const config = {
    matcher: ["/api/:path*", "/dashboard/:path*"],
};

// Check if request matches middleware config
const request = new NextRequest("https://example.com/api/users");
const matches = matchesMiddleware(request, config.matcher);
// true
```

## API Reference

### userAgent(request)

Parse the User-Agent header from a request.

```typescript
function userAgent(request: NextRequest | Request): UserAgent;

interface UserAgent {
    isBot: boolean;
    browser: { name?: string; version?: string };
    device: { type?: string; vendor?: string; model?: string };
    engine: { name?: string; version?: string };
    os: { name?: string; version?: string };
    cpu: { architecture?: string };
}
```

### geolocation(request)

Extract geolocation data from request headers.

```typescript
function geolocation(request: NextRequest | Request): Geo;

interface Geo {
    city?: string;
    country?: string;
    region?: string;
    latitude?: string;
    longitude?: string;
}
```

### ipAddress(request)

Get the client's IP address from various headers.

```typescript
function ipAddress(request: NextRequest | Request): string | undefined;
```

Checks these headers in order:
1. `x-real-ip`
2. `x-forwarded-for` (first IP)
3. `cf-connecting-ip` (Cloudflare)
4. `x-client-ip`
5. `x-cluster-client-ip`

### pathMatcher(pattern)

Create a function to match paths against a pattern.

```typescript
function pathMatcher(pattern: string): (path: string) => boolean;

// Supported patterns:
// - /exact/path
// - /with/:param
// - /with/:param*  (catch-all)
// - /with/:param?  (optional)
```

### matchPath(pattern, path)

Match a path against a pattern and extract params.

```typescript
function matchPath(
    pattern: string,
    path: string,
): { matched: boolean; params: Record<string, string> };
```

## Compatibility with Next.js

These helpers mirror the Next.js server utilities:

| Next.js | Foxen |
|---------|-------|
| `import { userAgent } from 'next/server'` | `import { userAgent } from '@foxen/helpers'` |
| `import { geolocation } from 'next/server'` | `import { geolocation } from '@foxen/helpers'` |
| `import { ipAddress } from 'next/server'` | `import { ipAddress } from '@foxen/helpers'` |

## License

MIT
