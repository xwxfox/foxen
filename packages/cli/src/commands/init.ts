import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { createLogger, printBanner } from '../logger.js';

const CONFIG_TEMPLATE = `/**
 * Foxen configuration
 * @see https://github.com/xwxfox/foxen
 */

import { defineConfig } from "@foxen/cli";

export default defineConfig({
  // Directory containing your Next.js App Router API routes
  routesDir: "./src/app/api",

  // Output directory for generated Elysia router
  outputDir: "./src/generated",

  // Base path for all API routes
  basePath: "/api",

  // Output format: "ts" or "js"
  format: "ts",

  // Generate barrel export (index.ts)
  generateBarrel: true,

  // Import alias for route files (used in generated imports)
  routesAlias: "@/app/api",

  // Group routes by path prefix
  useGroups: true,

  // Name of the Elysia instance in generated code
  elysiaInstanceName: "app",

  // Patterns to ignore
  ignorePatterns: [
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
  ],
});
`;

interface InitOptions {
	force?: boolean;
	typescript?: boolean;
}

/**
 * Run the init command
 */
export async function init(options: InitOptions): Promise<void> {
	const logger = createLogger(true);

	printBanner();

	const configFileName = options.typescript !== false ? 'foxen.config.ts' : 'foxen.config.js';

	const configPath = resolve(process.cwd(), configFileName);

	if (existsSync(configPath) && !options.force) {
		logger.error(`Config file already exists: ${configFileName}`);
		logger.info('Use --force to overwrite');
		process.exit(1);
	}

	try {
		writeFileSync(configPath, CONFIG_TEMPLATE, 'utf-8');
		logger.success(`Created ${pc.cyan(configFileName)}`);
		logger.log('');
		logger.info('Next steps:');
		logger.log(`  1. Edit ${pc.cyan(configFileName)} to match your project`);
		logger.log(`  2. Run ${pc.cyan('foxen generate')} to generate routes`);
		logger.log(`  3. Run ${pc.cyan('foxen dev')} to start development server`);
		logger.log('');
	} catch (error) {
		logger.error(
			`Failed to create config: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}
