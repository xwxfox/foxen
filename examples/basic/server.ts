/**
 * Basic example server using Foxen
 *
 * This demonstrates using the adapter with full next.config.ts and middleware.ts support.
 * For production, use the CLI to generate optimized routes.
 */

import { Elysia } from "elysia";
import { appRouter } from "@foxen/adapter";

const app = new Elysia()
    // Health check endpoint
    .get("/health", () => ({ status: "ok" }))
    // Load routes from app/api directory with full config support
    .use(
        await appRouter({
            apiDir: "./src/app/api",
            projectRoot: import.meta.dir,
            // Enable next.config.ts features
            nextConfigPath: "./next.config.ts",
            // Enable middleware.ts
            middlewarePath: "./middleware.ts",
            // Feature flags (all enabled by default)
            features: {
                redirects: true,
                rewrites: true,
                headers: true,
                middleware: true,
            },
            verbose: true,
        }),
    )
    .listen(3000);

console.log(`Server running at http://localhost:${app.server?.port}`);
console.log("\nAvailable routes:");
console.log("  GET  /health           - Health check");
console.log("  GET  /api/hello        - Hello world");
console.log("  GET  /api/users        - List users");
console.log("  POST /api/users        - Create user");
console.log("  GET  /api/users/:id    - Get user");
console.log("  PUT  /api/users/:id    - Update user");
console.log("  DELETE /api/users/:id  - Delete user");
console.log("  GET  /api/info         - Request info");
console.log("\nConfig features:");
console.log("  GET  /old-api/hello    - Redirects to /api/hello (308)");
console.log("  GET  /v1/users/123     - Redirects to /api/users/123 (307)");
console.log("  GET  /legacy/hello     - Rewrites to /api/hello");
console.log("\nMiddleware features:");
console.log("  GET  /redirect-me      - Middleware redirect to /api/hello");
console.log("  GET  /rewrite-me       - Middleware rewrite to /api/info");
console.log("  GET  /api/blocked      - Returns 403 (blocked by middleware)");
