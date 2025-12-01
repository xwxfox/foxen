/**
 * Foxen configuration for with-swagger example
 */

import { defineConfig } from "@foxen/cli";

export default defineConfig({
    routesDir: "./src/app/api",
    outputDir: "./src/generated",
    basePath: "/api",
    format: "ts",
    generateBarrel: true,
});
