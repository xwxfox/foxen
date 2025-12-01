import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Elysia } from 'elysia';
import { loadConfig, validateConfig } from '../config.js';
import {
	createLogger,
	formatDuration,
	formatError,
	printBanner,
	printServerStart,
} from '../logger.js';
import type { StartOptions } from '../types.js';

// Import env package dynamically to handle if not installed
async function loadEnvModule() {
	try {
		return await import('@foxen/env');
	} catch {
		return null;
	}
}

/**
 * Run the start command
 */
export async function start(options: StartOptions): Promise<void> {
	const startTime = Date.now();
	const logger = createLogger(options.verbose ?? false, 'start');

	printBanner();

	// Set NODE_ENV to production if not set
	process.env.NODE_ENV ??= 'production';
	const mode = process.env.NODE_ENV as 'development' | 'test' | 'production';

	// Load configuration
	logger.debug(`Loading config from ${options.config ?? 'auto-detect'}`);

	let config: Awaited<ReturnType<typeof loadConfig>>['config'];
	let configDir: string;

	try {
		const loaded = await loadConfig(options.config);
		config = loaded.config;
		configDir = loaded.configDir;
	} catch (error) {
		logger.error(formatError(error));
		process.exit(1);
	}

	// Validate config
	const errors = validateConfig(config);
	if (errors.length > 0) {
		for (const error of errors) {
			logger.error(error);
		}
		process.exit(1);
	}

	// =========================================================================
	// Environment Loading & Validation
	// =========================================================================

	const envModule = await loadEnvModule();

	if (envModule) {
		logger.info('Loading environment variables...');

		try {
			const rootDir = options.rootDir ?? configDir ?? process.cwd();

			// Bootstrap environment with production strictness
			envModule.bootstrapEnv({
				rootDir,
				mode,
				strict: options.strict ?? mode === 'production',
				validate: true,
				injectToProcessEnv: true,
			});

			const loadedFiles = envModule.getLoadedFiles();
			if (loadedFiles.length > 0) {
				logger.success(`Loaded ${loadedFiles.length} env file(s)`);
				if (options.verbose) {
					for (const file of loadedFiles) {
						logger.debug(`  - ${file}`);
					}
				}
			} else {
				logger.warn('No .env files found');
			}

			// Validate against .env.example if it exists
			const missing = envModule.validateAgainstExample(rootDir, envModule.getRawEnv());
			if (missing.length > 0) {
				logger.warn(`Missing variables from .env.example: ${missing.join(', ')}`);
				if (options.strict) {
					logger.error('Strict mode enabled - missing required environment variables');
					process.exit(1);
				}
			}
		} catch (error) {
			if (envModule.isEnvError?.(error)) {
				const envError = error as Error & { code: string };
				logger.error(`Environment error: ${envError.message}`);
				const code = envError.code as keyof typeof envModule.envErrorSuggestions;
				const suggestion = envModule.envErrorSuggestions?.[code];
				if (suggestion) {
					logger.info(`Suggestion: ${suggestion}`);
				}
			} else {
				logger.error(formatError(error));
			}

			if (options.strict ?? mode === 'production') {
				process.exit(1);
			}
		}
	} else {
		logger.debug('@foxen/env not installed - skipping environment validation');
	}

	// =========================================================================
	// Server Setup
	// =========================================================================

	const port = options.port ?? Number(process.env.PORT) ?? 3000;
	const host = options.host ?? process.env.HOST ?? '0.0.0.0';
	const routerPath = resolve(config.outputDir, 'router.ts');

	// Check that generated routes exist
	if (!existsSync(routerPath)) {
		logger.error(`Generated router not found: ${routerPath}`);
		logger.info("Run 'foxen generate' first to create the router");
		process.exit(1);
	}

	logger.info(`Starting server in ${mode} mode...`);

	try {
		// Import the generated router
		const routerModule = await import(routerPath);
		const router = routerModule.createRouter?.() ?? routerModule.router;

		if (!router) {
			logger.error('No router exported from generated file');
			logger.info("Ensure your generator creates a 'router' export or 'createRouter' function");
			process.exit(1);
		}

		// Create Elysia app
		const app = new Elysia().use(router).get('/health', () => ({
			status: 'ok',
			timestamp: new Date().toISOString(),
			mode,
			uptime: process.uptime(),
		}));

		// Start server
		const server = app.listen({
			port,
			hostname: host,
		});

		const bootTime = Date.now() - startTime;

		printServerStart(port, host, config.basePath);
		logger.success(`Server ready in ${formatDuration(bootTime)}`);
		logger.info(`Mode: ${mode}`);
		logger.log('');

		// Handle graceful shutdown
		const shutdown = async (signal: string) => {
			console.log(); // New line after ^C
			logger.info(`Received ${signal}, shutting down gracefully...`);

			try {
				await server.stop();
				logger.success('Server stopped');
			} catch (error) {
				logger.debug(`Error stopping server: ${formatError(error)}`);
			}

			process.exit(0);
		};

		process.on('SIGINT', () => shutdown('SIGINT'));
		process.on('SIGTERM', () => shutdown('SIGTERM'));

		// Keep process alive
		// (Elysia's listen keeps the process running)
	} catch (error) {
		logger.error(`Failed to start server: ${formatError(error)}`);

		if (error instanceof Error && error.stack && options.verbose) {
			logger.debug(error.stack);
		}

		process.exit(1);
	}
}
