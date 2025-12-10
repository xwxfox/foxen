# @foxen/navigation

Next.js 16-style request helpers for Foxen.

- `headers()` / `cookies()` accessors with automatic dynamic rendering opt-in
- `draftMode()` preview toggles
- Redirect/interrupt helpers (`redirect`, `permanentRedirect`, `notFound`, etc.)
- Request-scoped async context bridging Foxen routes

```ts
import { headers, cookies, redirect } from '@foxen/navigation';

export async function GET() {
	const hdrs = await headers();
	const session = (await cookies()).get('session');
	if (!session) redirect('/login');
	return Response.json({ ok: true, forwardedFor: hdrs.get('x-forwarded-for') });
}
```

## Helper Parity

| Next.js API | Foxen helper | Status |
|-------------|--------------|--------|
| `import { headers } from "next/headers"` | `await headers()` | ✅ Supported (marks route dynamic) |
| `import { cookies } from "next/headers"` | `await cookies()` | ✅ Supported (returns mutable cookie store) |
| `import { draftMode } from "next/headers"` | `await draftMode()` | ✅ Supported (`enable()/disable()` mutate preview cookies) |
| `import { redirect } from "next/navigation"` | `redirect()` / `permanentRedirect()` / `temporaryRedirect()` | ✅ Supported (throws interrupt) |
| `import { notFound } from "next/navigation"` | `notFound()` | ✅ Supported |
| `import { unauthorized } from "next/navigation"` | `unauthorized()` | ✅ Supported |
| `import { forbidden } from "next/navigation"` | `forbidden()` | ✅ Supported |

> ℹ️ All helpers except the interrupt functions return a `Promise`. Always `await` `headers()`, `cookies()`, and `draftMode()` so Foxen can capture dynamic usage.

## Usage Notes

- `headers()` returns a read-only snapshot. Iterating or reading marks the handler as dynamic and sets the `x-foxn-dynamic` response header.
- `cookies()` exposes the Next.js-compatible cookie jar. Mutations update the outgoing response headers in the active request context.
- `draftMode()` resolves to `{ isEnabled, enable(), disable() }`, mirroring Next.js preview behavior.
- Redirect and status helpers throw typed interrupts; make sure the `foxnInterruptHandler` middleware is installed in custom Elysia apps.

## Migration

- Legacy helpers like `NextResponse.unauthorized()` and `NextResponse.forbidden()` from `@foxen/core` are deprecated. Call the corresponding interrupt helpers exported from `@foxen/navigation` instead for consistent handling across runtimes.
