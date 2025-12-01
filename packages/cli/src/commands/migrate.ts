import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import pc from 'picocolors';
import { createLogger, printBanner } from '../logger.js';
import {
	type ScaffoldOptions,
	analyzeNextJsProject,
	generateDockerFiles,
	generatePlaceholderConfig,
	generateTestStubs,
	getDependencySummary,
	getProjectSummary,
	resolveDependencies,
	scaffoldProject,
	transformAllRoutes,
	transformConfig,
} from '../migrate/index.js';

interface MigrateCommandOptions {
	output?: string;
	name?: string;
	runtime?: 'bun' | 'node';
	force?: boolean;
	dryRun?: boolean;
	verbose?: boolean;
	tests?: boolean;
	docker?: boolean;
}

/**
 * Run the migrate command
 */
export async function migrate(
	source: string | undefined,
	options: MigrateCommandOptions,
): Promise<void> {
	const logger = createLogger(options.verbose ?? false);
	const sourcePath = resolve(process.cwd(), source || '.');

	printBanner();
	logger.log('');
	logger.info('Foxen Migration Tool');
	logger.log('');

	// Validate source exists
	if (!existsSync(sourcePath)) {
		logger.error(`Source directory not found: ${sourcePath}`);
		process.exit(1);
	}

	// Check for package.json
	if (!existsSync(resolve(sourcePath, 'package.json'))) {
		logger.error('No package.json found in source directory');
		logger.info("Make sure you're pointing to a Next.js project root");
		process.exit(1);
	}

	logger.info(`Analyzing project: ${pc.cyan(sourcePath)}`);
	logger.log('');

	try {
		// Step 1: Analyze the Next.js project
		logger.log(pc.dim('Step 1/5: Analyzing project structure...'));
		const analysis = await analyzeNextJsProject(sourcePath);

		if (options.verbose) {
			logger.log('');
			logger.log(pc.dim(getProjectSummary(analysis)));
			logger.log('');
		}

		if (analysis.routes.length === 0) {
			logger.warn('No API routes found in the project');
			logger.info('Make sure you have route.ts files in your app/api directory');
			process.exit(1);
		}

		logger.success(`Found ${pc.cyan(String(analysis.routes.length))} routes`);

		// Step 2: Resolve dependencies
		logger.log(pc.dim('Step 2/5: Resolving dependencies...'));
		const deps = resolveDependencies(analysis);

		if (options.verbose) {
			logger.log('');
			logger.log(pc.dim(getDependencySummary(deps)));
			logger.log('');
		}

		logger.success(
			`Dependencies resolved (${deps.add.length} new, ${deps.keep.length} kept, ${deps.remove.length} removed)`,
		);

		// Determine output directory
		const outputDir = options.output
			? resolve(process.cwd(), options.output)
			: resolve(process.cwd(), `${basename(sourcePath)}-elysia`);

		// Check if output exists
		if (existsSync(outputDir) && !options.force) {
			logger.error(`Output directory already exists: ${outputDir}`);
			logger.info('Use --force to overwrite');
			process.exit(1);
		}

		// Dry run mode
		if (options.dryRun) {
			logger.log('');
			logger.info(pc.yellow('DRY RUN - No files will be created'));
			logger.log('');
			logger.log(`Would create project at: ${pc.cyan(outputDir)}`);
			logger.log('');
			logger.log('Routes to migrate:');
			for (const route of analysis.routes) {
				const methods = route.handlers.map((h) => h.method).join(', ');
				logger.log(`  ${pc.cyan(route.elysiaPath)} (${methods})`);
			}
			logger.log('');

			if (analysis.hasMiddleware) {
				logger.log(`Middleware: ${pc.cyan(analysis.middlewarePath)}`);
			}
			if (analysis.hasNextConfig) {
				logger.log(
					`Config features: ${
						[
							analysis.usesRedirects && 'redirects',
							analysis.usesRewrites && 'rewrites',
							analysis.usesHeaders && 'headers',
						]
							.filter(Boolean)
							.join(', ') || 'none'
					}`,
				);
			}

			return;
		}

		// Step 3: Scaffold project
		logger.log(pc.dim('Step 3/5: Scaffolding project...'));

		const scaffoldOptions: Partial<ScaffoldOptions> = {
			projectName: options.name || `${analysis.name}-elysia`,
			runtime: options.runtime || 'bun',
			createGitignore: true,
			createReadme: true,
			formatter: 'biome',
		};

		const scaffoldResult = await scaffoldProject(analysis, outputDir, scaffoldOptions);

		if (!scaffoldResult.success) {
			logger.error('Failed to scaffold project');
			for (const err of scaffoldResult.errors) {
				logger.error(`  ${err}`);
			}
			process.exit(1);
		}

		logger.success(`Scaffolded at ${pc.cyan(outputDir)}`);

		// Step 4: Transform routes
		logger.log(pc.dim('Step 4/5: Transforming routes...'));
		const transformedRoutes = await transformAllRoutes(analysis, outputDir);

		const successCount = transformedRoutes.filter((r) => r.success).length;
		const failCount = transformedRoutes.filter((r) => !r.success).length;

		if (successCount > 0) {
			logger.success(`Transformed ${pc.cyan(String(successCount))} routes`);
		}

		if (failCount > 0) {
			logger.warn(`Failed to transform ${failCount} routes:`);
			for (const route of transformedRoutes.filter((r) => !r.success)) {
				logger.warn(`  ${route.originalPath}: ${route.error}`);
			}
		}

		// Step 5: Transform config
		logger.log(pc.dim('Step 5/5: Processing configuration...'));

		if (analysis.hasNextConfig) {
			const configResult = await transformConfig(analysis, outputDir);

			if (configResult.success) {
				const features = [
					configResult.hasRedirects && 'redirects',
					configResult.hasRewrites && 'rewrites',
					configResult.hasHeaders && 'headers',
				].filter(Boolean);

				if (features.length > 0) {
					logger.success(`Transformed config: ${features.join(', ')}`);
				} else {
					logger.log(pc.dim('  No config features to transform'));
					await generatePlaceholderConfig(outputDir);
				}
			} else {
				logger.warn(`Config transformation failed: ${configResult.error}`);
				await generatePlaceholderConfig(outputDir);
			}
		} else {
			await generatePlaceholderConfig(outputDir);
			logger.log(pc.dim('  No next.config found'));
		}

		// Generate test stubs if requested
		if (options.tests) {
			logger.log('');
			logger.log(pc.dim('Generating test stubs...'));
			const testFiles = await generateTestStubs(analysis, outputDir, transformedRoutes);
			logger.success(`Generated ${pc.cyan(String(testFiles.length))} test files`);
		}

		// Generate Docker files if requested
		if (options.docker) {
			logger.log('');
			logger.log(pc.dim('Generating Docker files...'));
			const dockerFiles = await generateDockerFiles(outputDir, scaffoldOptions);
			logger.success(`Generated ${pc.cyan(String(dockerFiles.length))} Docker files`);
		}

		// Done!
		logger.log('');
		logger.log(pc.green('Migration complete!'));
		logger.log('');

		// Print summary
		logger.info('Summary:');
		logger.log(`  Project:     ${pc.cyan(scaffoldOptions.projectName)}`);
		logger.log(`  Output:      ${pc.cyan(outputDir)}`);
		logger.log(`  Routes:      ${pc.cyan(String(successCount))} migrated`);
		logger.log(`  Runtime:     ${pc.cyan(scaffoldOptions.runtime || 'bun')}`);
		logger.log('');

		// Print next steps
		logger.info('Next steps:');
		logger.log(`  1. ${pc.cyan(`cd ${basename(outputDir)}`)}`);
		logger.log(`  2. ${pc.cyan('bun install')}`);
		logger.log(`  3. Review generated routes in ${pc.cyan('src/routes/')}`);
		logger.log(`  4. ${pc.cyan('bun dev')} to start the server`);
		logger.log('');

		// Warnings
		if (scaffoldResult.warnings.length > 0 || deps.warnings.length > 0) {
			logger.warn('Warnings:');
			for (const warning of [...scaffoldResult.warnings, ...deps.warnings]) {
				logger.log(`  ${warning}`);
			}
			logger.log('');
		}

		logger.info('Notes:');
		logger.log('  • Review transformed routes for correctness');
		logger.log('  • Check middleware integration');
		logger.log('  • Update environment variables if needed');
		logger.log('  • Run tests to verify functionality');
		logger.log('');
	} catch (error) {
		logger.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
		if (options.verbose && error instanceof Error && error.stack) {
			logger.log(pc.dim(error.stack));
		}
		process.exit(1);
	}
}
