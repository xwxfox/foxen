# @foxen/cli

Command-line tools for Foxen projects. Provides commands for initializing, developing, generating, and migrating.

## Installation

```bash
# Global installation
bun add -g @foxen/cli

# Or use with bunx
bunx foxen <command>
```

## Commands

### foxen init

Initialize a new `foxen.config.ts` file:

```bash
foxen init
foxen init --force    # Overwrite existing
foxen init --js       # Create JavaScript config
```

### foxen generate

Generate Elysia routes from your Next.js API structure:

```bash
foxen generate
foxen generate --watch           # Watch mode
foxen generate -r ./src/api      # Custom routes directory
foxen generate -o ./src/gen      # Custom output directory
foxen generate -v                # Verbose output
```

### foxen dev

Start development server with hot reload:

```bash
foxen dev
foxen dev --port 8080            # Custom port
foxen dev --host 0.0.0.0         # Custom host
foxen dev -c ./custom.config.ts  # Custom config
```

### foxen migrate

Migrate a Next.js project to standalone Elysia:

```bash
foxen migrate ./my-nextjs-app
foxen migrate ./source -o ./dest   # Custom output
foxen migrate --dry-run            # Preview only
foxen migrate --docker             # Include Docker files
foxen migrate --tests              # Include test stubs
```

## Configuration

Create a `foxen.config.ts` in your project root:

```typescript
import { defineConfig } from "@foxen/cli";

export default defineConfig({
    // Directory containing Next.js App Router API routes
    routesDir: "./src/app/api",

    // Output directory for generated code
    outputDir: "./src/generated",

    // Base path for all API routes
    basePath: "/api",

    // Output format: "ts" or "js"
    format: "ts",

    // Generate barrel export (index.ts)
    generateBarrel: true,

    // Group routes by directory
    useGroups: false,

    // Import alias for routes (e.g., "@/app/api")
    routesAlias: undefined,

    // Path to tsconfig.json
    tsConfigPath: "./tsconfig.json",

    // Patterns to ignore
    ignorePatterns: ["**/*.test.ts", "**/__tests__/**"],

    // Name of Elysia instance in generated code
    elysiaInstanceName: "app",
});
```

## Options Reference

### Global Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help |
| `--version` | Show version |

### generate

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Path to config file |
| `-r, --routes <path>` | Routes directory |
| `-o, --output <path>` | Output directory |
| `-w, --watch` | Watch mode |
| `-v, --verbose` | Verbose output |

### dev

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Path to config file |
| `-p, --port <port>` | Server port (default: 3000) |
| `-h, --host <host>` | Server host (default: localhost) |

### migrate

| Option | Description |
|--------|-------------|
| `-o, --output <path>` | Output directory |
| `-n, --name <name>` | Project name |
| `-r, --runtime <runtime>` | Target runtime: bun or node |
| `-f, --force` | Overwrite existing |
| `-d, --dry-run` | Preview only |
| `--tests` | Generate test stubs |
| `--docker` | Generate Docker files |
| `-v, --verbose` | Verbose output |

## Programmatic Usage

You can also use the CLI commands programmatically:

```typescript
import { generate, dev, init } from "@foxen/cli";

// Generate routes
await generate({
    routes: "./src/app/api",
    output: "./src/generated",
    watch: false,
    verbose: true,
});

// Start dev server
await dev({
    port: 3000,
    host: "localhost",
});

// Initialize config
await init({
    force: false,
    typescript: true,
});
```

## Examples

### Quick Start

```bash
# Initialize new project
mkdir my-api && cd my-api
bun init
bun add @foxen/cli @foxen/adapter @foxen/core elysia

# Create config
bunx foxen init

# Create a route
mkdir -p src/app/api/hello
cat > src/app/api/hello/route.ts << 'EOF'
import { NextRequest, NextResponse } from "@foxen/core";

export async function GET(request: NextRequest) {
    return NextResponse.json({ message: "Hello, World!" });
}
EOF

# Generate and run
bunx foxen generate
bunx foxen dev
```

### Development Workflow

```bash
# Start dev server with hot reload
bunx foxen dev

# Or use generate with watch mode
bunx foxen generate --watch
```

### Production Build

```bash
# Generate optimized routes
bunx foxen generate

# Build your app
bun build ./src/index.ts --outdir ./dist
```

## License

MIT
