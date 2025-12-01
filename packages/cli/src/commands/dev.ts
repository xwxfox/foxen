import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { type CompilerOptions, watchAndCompile } from '@foxen/compiler';
import { Elysia } from 'elysia';
import { loadConfig, validateConfig } from '../config.js';
import {
	createLogger,
	formatDuration,
	formatError,
	printBanner,
	printBoxTable,
	printReload,
	printServerStart,
	printStatus,
	printWatching,
} from '../logger.js';
import type { DevOptions } from '../types.js';

/**
 * Run the dev command
 */
export async function dev(options: DevOptions): Promise<void> {
	const logger = createLogger(true, 'dev');

	printBanner();

	// Load configuration
	logger.debug(`Loading config from ${options.config ?? 'auto-detect'}`);

	let config: Awaited<ReturnType<typeof loadConfig>>['config'];

	try {
		const loaded = await loadConfig(options.config);
		config = loaded.config;
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

	// Check routes directory exists
	if (!existsSync(config.routesDir)) {
		logger.error(`Routes directory not found: ${config.routesDir}`);
		logger.info('Create the directory or update routesDir in your config');
		process.exit(1);
	}

	const port = options.port ?? 3000;
	const host = options.host ?? 'localhost';

	logger.info(`Routes directory: ${config.routesDir}`);
	logger.info(`Output directory: ${config.outputDir}`);

	// Build compiler options
	const compilerOptions: CompilerOptions = {
		analyzer: {
			rootDir: config.routesDir,
			tsConfigPath: config.tsConfigPath,
			excludePatterns: config.ignorePatterns,
		},
		generator: {
			outputPath: config.outputDir,
			format: 'ts',
			generateBarrel: true,
			routesAlias: config.routesAlias,
			useGroups: config.useGroups,
			elysiaInstanceName: config.elysiaInstanceName,
			basePath: config.basePath,
		},
		verbose: true,
	};

	let server: ReturnType<Elysia['listen']> | null = null;
	let app: Elysia | null = null;
	let isFirstCompile = true;
	let lastCompileTime = 0;

	// Debounce rapid reloads (minimum 100ms between reloads)
	const DEBOUNCE_MS = 100;

	// Start watching and compiling
	const stopWatch = await watchAndCompile(compilerOptions, async (result) => {
		const now = Date.now();

		// Debounce rapid changes
		if (now - lastCompileTime < DEBOUNCE_MS && !isFirstCompile) {
			logger.debug('Debouncing rapid change...');
			return;
		}
		lastCompileTime = now;

		if (!isFirstCompile) {
			printReload('File changed');
		}

		logger.success(`Compiled in ${formatDuration(result.duration)}`);

		// Show route table on first compile
		if (isFirstCompile && result.analysis.routes.length > 0) {
			const routes = result.analysis.routes.map((r) => ({
				path: r.elysiaPath,
				methods: r.handlers.map((h) => h.method),
				file: r.relativePath,
			}));
			printBoxTable(routes);

			// Print status info
			printStatus(
				{ enabled: false, matcherCount: 0 },
				{ redirectCount: 0, rewriteCount: 0, headerRuleCount: 0 },
			);
		}

		// Hot reload: restart server with new routes
		if (server) {
			try {
				// Stop previous server
				await server.stop();
				logger.debug('Previous server stopped');
			} catch {
				// Ignore stop errors
			}
		}

		try {
			// Import the generated router
			const routerPath = resolve(config.outputDir, 'router.ts');

			// Clear module cache for hot reload (Bun-specific)
			// In Bun, we use cache-busting query params
			const cacheBuster = `?t=${Date.now()}`;

			// Dynamic import with cache busting
			const routerModule = await import(`${routerPath}${cacheBuster}`);
			const router = routerModule.createRouter?.() ?? routerModule.router;

			if (!router) {
				logger.error('No router exported from generated file');
				logger.info("Ensure your generator creates a 'router' export or 'createRouter' function");
				return;
			}

			// Create new Elysia app with the router
			app = new Elysia()
				.use(router)
				.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }));

			server = app.listen({ port, hostname: host });

			if (isFirstCompile) {
				printServerStart(port, host, config.basePath);

				// Print watching paths
				printWatching([
					relative(process.cwd(), config.routesDir),
					options.config ?? 'foxen.config.ts',
				]);

				isFirstCompile = false;
			} else {
				logger.success(`Server restarted on http://${host}:${port}`);
			}
		} catch (error) {
			logger.error(`Failed to start server: ${formatError(error)}`);

			if (error instanceof Error && error.stack) {
				logger.debug(error.stack);
			}
		}
	});

	// Handle graceful shutdown
	const shutdown = async () => {
		console.log(); // New line after ^C
		logger.info('Shutting down gracefully...');

		stopWatch();

		if (server) {
			try {
				await server.stop();
				logger.debug('Server stopped');
			} catch {
				// Ignore
			}
		}

		logger.success('Goodbye!');
		process.exit(0);
	};

	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
}
