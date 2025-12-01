import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { type CompilerOptions, compileAndWrite, watchAndCompile } from '@foxen/compiler';
import { loadConfig, validateConfig } from '../config.js';
import { createLogger, formatDuration, printBanner, printRouteTable } from '../logger.js';
import type { GenerateOptions } from '../types.js';

/**
 * Run the generate command
 */
export async function generate(options: GenerateOptions): Promise<void> {
	const logger = createLogger(options.verbose);

	printBanner();

	// Load configuration
	logger.debug(`Loading config from ${options.config ?? 'auto-detect'}`);
	const { config } = await loadConfig(options.config);

	// Override with CLI options
	if (options.routes) {
		config.routesDir = resolve(process.cwd(), options.routes);
	}
	if (options.output) {
		config.outputDir = resolve(process.cwd(), options.output);
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
		process.exit(1);
	}

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
			format: config.format,
			generateBarrel: config.generateBarrel,
			routesAlias: config.routesAlias,
			useGroups: config.useGroups,
			elysiaInstanceName: config.elysiaInstanceName,
			basePath: config.basePath,
		},
		verbose: options.verbose,
	};

	if (options.watch) {
		// Watch mode
		logger.info('Starting watch mode...');

		const stop = await watchAndCompile(compilerOptions, (result) => {
			const routes = result.analysis.routes.map((r) => ({
				path: r.elysiaPath,
				methods: r.handlers.map((h) => h.method),
				file: r.relativePath,
			}));

			if (routes.length > 0) {
				printRouteTable(routes);
			}

			logger.success(`Compiled in ${formatDuration(result.duration)}`);
		});

		// Handle graceful shutdown
		process.on('SIGINT', () => {
			logger.info('Stopping watch mode...');
			stop();
			process.exit(0);
		});

		process.on('SIGTERM', () => {
			stop();
			process.exit(0);
		});
	} else {
		// Single compile
		try {
			const result = await compileAndWrite(compilerOptions);

			const routes = result.analysis.routes.map((r) => ({
				path: r.elysiaPath,
				methods: r.handlers.map((h) => h.method),
				file: r.relativePath,
			}));

			if (routes.length > 0) {
				printRouteTable(routes);
			}

			if (result.analysis.errors.length > 0) {
				logger.warn(`${result.analysis.errors.length} warnings during analysis:`);
				for (const error of result.analysis.errors) {
					logger.warn(`  ${error.filePath}: ${error.message}`);
				}
			}

			logger.success(
				`Generated ${result.output.files.length} files in ${formatDuration(result.duration)}`,
			);

			for (const file of result.output.files) {
				logger.debug(`  ${file.path}`);
			}
		} catch (error) {
			logger.error(`Compilation failed: ${error instanceof Error ? error.message : String(error)}`);
			process.exit(1);
		}
	}
}
