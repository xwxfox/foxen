# @foxen/compiler

Code generation for Elysia routes using ts-morph. Generates optimized Elysia routes from your Next.js-style API structure with full typing for Eden Treaty.

## Installation

```bash
bun add @foxen/compiler
```

## Usage

### Basic Compilation

```typescript
import { compileAndWrite } from "@foxen/compiler";

const result = await compileAndWrite({
    analyzer: {
        rootDir: "./src/app/api",
    },
    generator: {
        outputPath: "./src/generated",
    },
});

console.log(`Generated ${result.output.files.length} files`);
```

### Watch Mode

```typescript
import { watchAndCompile } from "@foxen/compiler";

const stop = await watchAndCompile(
    {
        analyzer: { rootDir: "./src/app/api" },
        generator: { outputPath: "./src/generated" },
    },
    (result) => {
        console.log(`Compiled in ${result.duration}ms`);
    },
);

// Later: stop watching
stop();
```

### Using Generated Routes

```typescript
// Generated: src/generated/router.ts
import { Elysia } from "elysia";

const app = new Elysia()
    .use(router)
    .listen(3000);

// Export type for Eden Treaty
export type App = typeof app;
```

### Eden Treaty Client

```typescript
// client.ts
import { treaty } from "@elysiajs/eden";
import type { App } from "./generated/router";

const api = treaty<App>("localhost:3000");

// Fully typed API calls
const { data } = await api.api.users.get();
const user = await api.api.users({ id: "123" }).get();
```

## Configuration

### Analyzer Options

```typescript
interface AnalyzerOptions {
    // Root directory containing route files
    rootDir: string;

    // Path to tsconfig.json (optional)
    tsConfigPath?: string;

    // Patterns to exclude (glob)
    excludePatterns?: string[];
}
```

### Generator Options

```typescript
interface GeneratorOptions {
    // Output directory for generated files
    outputPath: string;

    // Output format: 'ts' or 'js'
    format?: "ts" | "js";

    // Generate barrel export (index.ts)
    generateBarrel?: boolean;

    // Import alias for route files
    routesAlias?: string;

    // Group routes by directory
    useGroups?: boolean;

    // Base path for all routes
    basePath?: string;

    // Name of Elysia instance in generated code
    elysiaInstanceName?: string;
}
```

### Full Example

```typescript
import { compileAndWrite, type CompilerOptions } from "@foxen/compiler";

const options: CompilerOptions = {
    analyzer: {
        rootDir: "./src/app/api",
        tsConfigPath: "./tsconfig.json",
        excludePatterns: ["**/*.test.ts", "**/__tests__/**"],
    },
    generator: {
        outputPath: "./src/generated",
        format: "ts",
        generateBarrel: true,
        basePath: "/api",
        useGroups: true,
    },
    verbose: true,
};

const result = await compileAndWrite(options);
```

## Generated Output

The compiler generates several files:

### router.ts

Main router with all routes:

```typescript
import { Elysia } from "elysia";
import * as usersRoute from "../app/api/users/route";
import * as userByIdRoute from "../app/api/users/[id]/route";

export function createRouter() {
    return new Elysia({ prefix: "/api" })
        .get("/users", async (ctx) => {
            const request = createNextRequest(ctx);
            return usersRoute.GET(request);
        })
        .post("/users", async (ctx) => {
            const request = createNextRequest(ctx);
            return usersRoute.POST(request);
        })
        .get("/users/:id", async (ctx) => {
            const request = createNextRequest(ctx);
            const params = Promise.resolve({ id: ctx.params.id });
            return userByIdRoute.GET(request, { params });
        });
}

export const router = createRouter();
export type App = typeof router;
```

### index.ts (barrel)

Re-exports everything:

```typescript
export { router, createRouter, type App } from "./router";
```

## API Reference

### compile(options)

Analyze and generate code without writing to disk.

```typescript
const result = await compile(options);
// result.analysis - Analyzed routes
// result.output - Generated code
// result.duration - Time taken
```

### compileAndWrite(options)

Analyze, generate, and write to disk.

```typescript
const result = await compileAndWrite(options);
// Files written to options.generator.outputPath
```

### watchAndCompile(options, callback)

Watch for changes and recompile.

```typescript
const stop = await watchAndCompile(options, (result) => {
    console.log("Recompiled!");
});

// Stop watching
stop();
```

### RouteAnalyzer

Low-level analyzer class:

```typescript
import { RouteAnalyzer } from "@foxen/compiler";

const analyzer = new RouteAnalyzer(options);
const result = await analyzer.analyze();
```

### CodeGenerator

Low-level generator class:

```typescript
import { CodeGenerator } from "@foxen/compiler";

const generator = new CodeGenerator(options);
const output = await generator.generate(analysisResult);
```

## Schema Support

Routes can export schema definitions for validation and OpenAPI:

```typescript
// route.ts
import { t } from "elysia";

export async function GET(request: NextRequest) {
    // ...
}

export const schema = {
    GET: {
        query: t.Object({
            page: t.Optional(t.Number()),
        }),
        response: t.Object({
            users: t.Array(UserSchema),
        }),
        tags: ["users"],
        summary: "List users",
    },
};
```

The compiler extracts these schemas and applies them to generated routes.

## License

MIT
