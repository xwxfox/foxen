# With Swagger Example

This example demonstrates using Foxen with Elysia's Swagger/OpenAPI plugin:

- **OpenAPI Documentation**: Auto-generated API docs
- **Swagger UI**: Interactive API explorer
- **Schema Validation**: Request/response validation with TypeBox
- **Type Safety**: End-to-end type safety with Eden Treaty

## Structure

```
src/
  app/
    api/
      users/
        route.ts      # GET, POST /api/users (with schema)
        [id]/
          route.ts    # GET, PUT, DELETE /api/users/:id (with schema)
      posts/
        route.ts      # GET, POST /api/posts (with schema)

foxen.config.ts       # Foxen configuration
server.ts             # Server entry point with Swagger plugin
```

## Features Demonstrated

### Schema Definition

```typescript
// route.ts
import { t } from "elysia";

export const schema = defineSchema({
    GET: {
        query: t.Object({
            page: t.Optional(t.Number({ default: 1 })),
            limit: t.Optional(t.Number({ default: 10 })),
        }),
        response: t.Object({
            users: t.Array(UserSchema),
            total: t.Number(),
        }),
        tags: ["users"],
        summary: "List all users",
    },
});
```

### Swagger Configuration

```typescript
import { swagger } from "@elysiajs/swagger";

const app = new Elysia()
    .use(swagger({
        documentation: {
            info: {
                title: "Foxen API",
                version: "1.0.0",
                description: "Example API with Swagger documentation",
            },
            tags: [
                { name: "users", description: "User operations" },
                { name: "posts", description: "Post operations" },
            ],
        },
    }))
    .use(router);
```

### Eden Treaty Types

```typescript
// client.ts
import { treaty } from "@elysiajs/eden";
import type { App } from "./generated";

const api = treaty<App>("localhost:3000");

// Fully typed API calls
const { data } = await api.api.users.get({ query: { page: 1 } });
```

## Running

```bash
# Install dependencies
bun install

# Start the server
bun run start
```

## API Documentation

Once running, visit:

- **Swagger UI**: http://localhost:3000/swagger
- **OpenAPI JSON**: http://localhost:3000/swagger/json
- **Health check**: http://localhost:3000/health

## API Endpoints

| Method | Path | Description | Tags |
|--------|------|-------------|------|
| GET | `/api/users` | List all users | users |
| POST | `/api/users` | Create a user | users |
| GET | `/api/users/:id` | Get user by ID | users |
| PUT | `/api/users/:id` | Update user | users |
| DELETE | `/api/users/:id` | Delete user | users |
| GET | `/api/posts` | List all posts | posts |
| POST | `/api/posts` | Create a post | posts |

## Testing

```bash
# List users
curl http://localhost:3000/api/users

# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"New User","email":"new@example.com"}'

# Get user by ID
curl http://localhost:3000/api/users/1

# Update user
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}'

# Delete user
curl -X DELETE http://localhost:3000/api/users/1
```

## Learn More

- [Elysia Swagger Plugin](https://elysiajs.com/plugins/swagger.html)
- [Eden Treaty](https://elysiajs.com/eden/overview.html)
- [TypeBox](https://github.com/sinclairzx81/typebox)
