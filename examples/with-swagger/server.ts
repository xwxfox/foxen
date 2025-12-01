/**
 * Server entry point for with-swagger example
 *
 * Demonstrates using Foxen with Elysia's Swagger plugin for OpenAPI documentation
 */

import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { appRouter } from "@foxen/adapter";

const app = new Elysia()
    // Add Swagger plugin for API documentation
    .use(
        swagger({
            path: "/swagger",
            documentation: {
                info: {
                    title: "Foxen API Example",
                    version: "1.0.0",
                    description:
                        "Example API demonstrating Foxen with Swagger/OpenAPI documentation",
                    contact: {
                        name: "Foxen",
                        url: "https://github.com/foxen/foxen",
                    },
                },
                tags: [
                    {
                        name: "users",
                        description: "User management operations",
                    },
                    { name: "posts", description: "Post management operations" },
                    { name: "health", description: "Health check endpoints" },
                ],
            },
        }),
    )
    // Health check endpoint with schema
    .get(
        "/health",
        () => ({
            status: "ok" as const,
            timestamp: new Date().toISOString(),
            version: "1.0.0",
        }),
        {
            detail: {
                tags: ["health"],
                summary: "Health check",
                description: "Returns the health status of the API",
            },
            response: t.Object({
                status: t.Literal("ok"),
                timestamp: t.String(),
                version: t.String(),
            }),
        },
    )
    // Load routes from app/api directory
    .use(
        await appRouter({
            apiDir: "./src/app/api",
            projectRoot: import.meta.dir,
            verbose: true,
        }),
    )
    .listen(3000);

console.log(`
Foxen with-swagger example running at http://localhost:${app.server?.port}

📚 API Documentation:
   Swagger UI: http://localhost:3000/swagger
   OpenAPI JSON: http://localhost:3000/swagger/json

📍 API Endpoints:
   GET    /api/users        - List all users
   POST   /api/users        - Create a user
   GET    /api/users/:id    - Get user by ID
   PUT    /api/users/:id    - Update user
   DELETE /api/users/:id    - Delete user
   GET    /api/posts        - List all posts
   POST   /api/posts        - Create a post

🔧 Health check:
   GET  /health
`);

// Export type for Eden Treaty
export type App = typeof app;
