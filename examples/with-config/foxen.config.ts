/**
 * Foxen configuration for with-config example
 */

import { defineConfig } from "@foxen/cli";

export default defineConfig({
    // API routes directory
    routesDir: "./src/app/api",

    // Generated output directory
    outputDir: "./src/generated",

    // Base path for all routes
    basePath: "/api",

    // Output TypeScript
    format: "ts",

    // Generate index.ts barrel export
    generateBarrel: true,
});
