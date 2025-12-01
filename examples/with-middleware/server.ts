/**
 * Server entry point for with-middleware example
 *
 * Demonstrates using Foxen with middleware.ts for authentication and logging
 */

import { Elysia } from "elysia";
import { appRouter } from "@foxen/adapter";

const app = new Elysia()
    // Health check endpoint
    .get("/health", () => ({
        status: "ok",
        timestamp: new Date().toISOString(),
    }))
    // Load routes with middleware support
    .use(
        await appRouter({
            apiDir: "./src/app/api",
            projectRoot: import.meta.dir,
            // Enable middleware.ts
            middlewarePath: "./middleware.ts",
            // Feature flags
            features: {
                middleware: true,
            },
            verbose: true,
        }),
    )
    .listen(3000);

console.log(`
Foxen with-middleware example running at http://localhost:${app.server?.port}

📍 API Endpoints:
   GET  /api/public       - Public endpoint (no auth)
   GET  /api/protected    - Protected endpoint (requires token)
   GET  /api/admin        - Admin endpoint (requires admin token)
   GET  /api/users        - List users (requires token)

🔐 Authentication:
   Use Authorization header with Bearer token:
   
   curl -H "Authorization: Bearer test-token" http://localhost:3000/api/protected
   
   Available test tokens:
   - test-token  → user role
   - user-token  → user role
   - admin-token → admin role

🧪 Testing:

   # Public (no auth needed)
   curl http://localhost:3000/api/public

   # Protected without token (401)
   curl http://localhost:3000/api/protected

   # Protected with token (200)
   curl -H "Authorization: Bearer test-token" http://localhost:3000/api/protected

   # Admin without admin role (403)
   curl -H "Authorization: Bearer user-token" http://localhost:3000/api/admin

   # Admin with admin role (200)
   curl -H "Authorization: Bearer admin-token" http://localhost:3000/api/admin

🔧 Health check:
   GET  /health
`);
