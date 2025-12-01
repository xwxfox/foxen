/**
 * Server entry point for with-config example
 *
 * Demonstrates using Foxen with next.config.ts features (redirects, rewrites, headers)
 */

import { Elysia } from "elysia";
import { appRouter } from "@foxen/adapter";

const app = new Elysia()
    // Health check endpoint
    .get("/health", () => ({
        status: "ok",
        timestamp: new Date().toISOString(),
    }))
    // Load routes with next.config.ts support
    .use(
        await appRouter({
            apiDir: "./src/app/api",
            projectRoot: import.meta.dir,
            // Enable next.config.ts features
            nextConfigPath: "./next.config.ts",
            // Feature flags
            features: {
                redirects: true,
                rewrites: true,
                headers: true,
            },
            verbose: true,
        }),
    )
    .listen(3000);

console.log(`
Foxen with-config example running at http://localhost:${app.server?.port}

📍 API Endpoints:
   GET  /api/hello        - Hello world
   GET  /api/users        - List users
   GET  /api/users/:id    - Get user by ID

🔀 Redirects (follow with curl -L):
   GET  /old-api/hello    → /api/hello (308 permanent)
   GET  /v1/users/123     → /api/users/123 (307 temporary)
   GET  /search           → /api/users (307 temporary)

Rewrites (transparent):
   GET  /legacy/hello     → /api/hello
   GET  /people           → /api/users
   GET  /person/123       → /api/users/123

📋 Headers (check with curl -v):
   All /api/* routes get custom headers:
   - X-Powered-By: Foxen
   - X-Custom-Header: Hello from next.config.ts
   - Access-Control-Allow-Origin: *

🔧 Health check:
   GET  /health
`);
