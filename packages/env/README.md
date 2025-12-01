# @foxen/env

Environment variable management for Foxen applications with Next.js-style .env file loading, automatic type inference, and TypeBox schema generation for validation.

## Installation

```bash
bun add @foxen/env @sinclair/typebox
```

## Quick Start

### Basic Usage

```typescript
import { bootstrapEnv, env } from '@foxen/env';

// At app startup
bootstrapEnv();

// Access env vars (typed based on inference)
console.log(env.DATABASE_URL);  // string
console.log(env.PORT);          // number (if value was "3000")
console.log(env.DEBUG);         // boolean (if value was "true")
```

### With Code Generation (Recommended)

Generate type-safe schema files for full TypeScript support:

```typescript
// scripts/generate-env.ts
import { generateAndWriteEnvFiles } from '@foxen/env';

await generateAndWriteEnvFiles({
  rootDir: process.cwd(),
  outputDir: '.foxen',
});
```

Then use the generated files:

```typescript
// src/index.ts
import { bootstrapEnv } from '@foxen/env';
import { EnvSchema, env } from './.foxen';
import type { Env } from './.foxen';

// Bootstrap with schema validation
bootstrapEnv({}, EnvSchema);

// Full type safety!
const port: number = env.PORT;
const debug: boolean = env.DEBUG;
```

## .env File Hierarchy

Files are loaded in this order (later overrides earlier):

1. `.env` - Base environment
2. `.env.local` - Local overrides (not in test mode)
3. `.env.[mode]` - Mode-specific (`.env.development`, `.env.production`, `.env.test`)
4. `.env.[mode].local` - Mode-specific local (not in test mode)

This matches Next.js behavior exactly.

## Configuration

```typescript
import { bootstrapEnv, generateEnvFiles } from '@foxen/env';

// Bootstrap options
bootstrapEnv({
  rootDir: process.cwd(),      // Where to look for .env files
  mode: 'development',          // 'development' | 'test' | 'production'
  strict: false,                // Throw on validation errors
  validate: true,               // Validate against schema
  injectToProcessEnv: true,     // Inject into process.env
});

// Generation options
await generateEnvFiles({
  rootDir: process.cwd(),
  outputDir: '.foxen',
  prefix: 'APP_',              // Only include vars starting with prefix
  stripPrefix: true,           // Remove prefix in generated types
  exclude: ['SECRET_KEY'],     // Variables to exclude
  typeOverrides: {             // Override inferred types
    PORT: 'integer',
    DEBUG: 'boolean',
  },
});
```

## Type Inference

Values are automatically typed based on their content:

| Value | Inferred Type | TypeScript Type |
|-------|---------------|-----------------|
| `true`, `false`, `yes`, `no`, `on`, `off`, `1`, `0` | boolean | `boolean` |
| `-?\d+` (integers) | integer | `number` |
| `-?\d+\.\d+` (decimals) | number | `number` |
| Everything else | string | `string` |

Override with `typeOverrides` when needed:

```typescript
await generateEnvFiles({
  typeOverrides: {
    PORT: 'string',  // Keep as string even though it looks like a number
  },
});
```

## Generated Files

When you run code generation, these files are created:

```
.foxen/
├── env.schema.ts    # TypeBox schema for validation
├── env.d.ts         # ProcessEnv type augmentation  
├── env.types.ts     # Env interface definition
├── env.runtime.ts   # Runtime env accessor
└── index.ts         # Re-exports everything
```

### env.schema.ts

```typescript
import { Type, type Static } from "@sinclair/typebox";

export const EnvSchema = Type.Object({
  DATABASE_URL: Type.String(),
  PORT: Type.Transform(Type.String())
    .Decode((v) => parseInt(v, 10))
    .Encode((v) => String(v)),
  DEBUG: Type.Transform(Type.String())
    .Decode((v) => v === "true")
    .Encode((v) => String(v)),
});

export type EnvSchemaType = Static<typeof EnvSchema>;
```

### env.d.ts

```typescript
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL: string;
      readonly PORT: string;
      readonly DEBUG: string;
    }
  }
}

export {};
```

### env.types.ts

```typescript
export interface Env {
  readonly DATABASE_URL: string;
  readonly PORT: number;
  readonly DEBUG: boolean;
}

export type EnvKey = keyof Env;
```

## API Reference

### Bootstrap & Lifecycle

```typescript
// Load .env files
bootstrapEnv(options?: BootstrapOptions, schema?: TObject): void

// Reset state (for testing)
resetEnv(): void

// Check if loaded
isEnvLoaded(): boolean

// Get loaded file paths
getLoadedFiles(): readonly string[]
```

### Typed Access

```typescript
// Get single value
getEnv<T>(key: string, defaultValue?: T): T

// Get all decoded values
getAllEnv(): Readonly<Record<string, unknown>>

// Get raw string values
getRawEnv(): Readonly<Record<string, string>>

// Create typed proxy
createEnvProxy<T>(): T

// Default proxy instance
env: Record<string, unknown>
```

### Validation

```typescript
// Validate against schema
validateEnv(schema: TObject): ValidationResult

// Check required variables
checkRequired(required: readonly string[]): ValidationResult

// Build schema dynamically
buildEnvSchema(): TObject
```

### Generation

```typescript
// Generate files (returns content)
generateEnvFiles(config?: EnvConfig): Promise<GenerationResult>

// Generate and write to disk
generateAndWriteEnvFiles(config?: EnvConfig): Promise<GenerationResult>

// Check if regeneration needed
needsRegeneration(config?: EnvConfig): boolean
```

### Loading

```typescript
// Load env files
loadEnvFiles(config?: EnvConfig): LoadResult

// Get file hierarchy
getEnvFileHierarchy(mode: EnvMode): readonly string[]

// Get existing files
getExistingEnvFiles(rootDir: string, mode: EnvMode): readonly string[]
```

### Parsing

```typescript
// Parse .env content
parseEnvFile(source: string, filePath?: string): ParsedEnv

// Parse single line
parseEnvLine(line: string, existingEnv?: ParsedEnv): { key: string; value: string } | null

// Convert to .env format
stringifyEnvFile(env: ParsedEnv, options?: StringifyOptions): string
```

## Integration with Foxen CLI

The `@foxen/env` package is designed to work seamlessly with the Foxen CLI:

```bash
# Generate env files
foxen env generate

# Start dev server (auto-loads env)
foxen dev
```

The CLI will automatically:
1. Load `.env` files based on NODE_ENV
2. Inject variables into process.env
3. Regenerate schema files when `.env` changes

## Best Practices

1. **Add `.env.local` to `.gitignore`** - Contains local secrets
2. **Create `.env.example`** - Document required variables
3. **Use prefix for app-specific vars** - `APP_`, `MYAPP_`
4. **Run generation in CI** - Catch missing vars early
5. **Use strict mode in production** - Fail fast on invalid env

## Example: Full Setup

```typescript
// foxen.config.ts
import { defineEnvConfig } from '@foxen/env';

export const envConfig = defineEnvConfig({
  prefix: 'APP_',
  stripPrefix: true,
  validateExample: true,
  typeOverrides: {
    APP_PORT: 'integer',
    APP_RATE_LIMIT: 'integer',
  },
});
```

```typescript
// src/env.ts
import { bootstrapEnv } from '@foxen/env';
import { EnvSchema, env } from '../.foxen';
import type { Env } from '../.foxen';

export function setupEnv(): void {
  bootstrapEnv({ strict: process.env.NODE_ENV === 'production' }, EnvSchema);
}

export { env };
export type { Env };
```

```typescript
// src/index.ts
import { setupEnv, env } from './env';

setupEnv();

console.log(`Starting server on port ${env.PORT}`);
```

## License

MIT
