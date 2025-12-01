#!/usr/bin/env bun
import { cac } from 'cac';
import pc from 'picocolors';
import { dev, generate, init, migrate, start } from './commands/index.js';
import { printBanner } from './logger.js';

const cli = cac('foxen');

// Version from package.json
cli.version('0.1.0');

// ============================================================================
// Commands
// ============================================================================

// Init command
cli
	.command('init', 'Initialize a new foxen.config.ts file')
	.option('-f, --force', 'Overwrite existing config file')
	.option('--js', 'Create JavaScript config instead of TypeScript')
	.example('foxen init')
	.example('foxen init --js')
	.action(async (options) => {
		await init({
			force: options.force,
			typescript: !options.js,
		});
	});

// Generate command
cli
	.command('generate', 'Generate Elysia routes from Next.js App Router structure')
	.alias('gen')
	.alias('g')
	.option('-c, --config <path>', 'Path to foxen.config.ts file')
	.option('-r, --routes <path>', 'Routes directory (overrides config)')
	.option('-o, --output <path>', 'Output directory (overrides config)')
	.option('-w, --watch', 'Watch mode - recompile on file changes')
	.option('-v, --verbose', 'Show detailed output')
	.example('foxen generate')
	.example('foxen generate --watch')
	.example('foxen generate -r ./src/app/api -o ./src/generated')
	.action(async (options) => {
		await generate({
			config: options.config,
			routes: options.routes,
			output: options.output,
			watch: options.watch,
			verbose: options.verbose,
		});
	});

// Dev command
cli
	.command('dev', 'Start development server with hot reload')
	.option('-c, --config <path>', 'Path to foxen.config.ts file')
	.option('-p, --port <port>', 'Server port', { default: 3000 })
	.option('-h, --host <host>', 'Server host', { default: 'localhost' })
	.example('foxen dev')
	.example('foxen dev --port 8080')
	.example('foxen dev --host 0.0.0.0')
	.action(async (options) => {
		await dev({
			config: options.config,
			port: Number(options.port),
			host: options.host,
		});
	});

// Start command (production)
cli
	.command('start', 'Start production server with environment validation')
	.option('-c, --config <path>', 'Path to foxen.config.ts file')
	.option('-p, --port <port>', 'Server port (default: PORT env or 3000)')
	.option('-H, --host <host>', 'Server host (default: HOST env or 0.0.0.0)')
	.option('-r, --root-dir <path>', 'Root directory for .env files')
	.option('--strict', 'Fail on environment validation errors')
	.option('--no-strict', 'Continue despite environment validation errors')
	.option('-v, --verbose', 'Show detailed output')
	.example('foxen start')
	.example('foxen start --port 8080')
	.example('foxen start --strict')
	.example('NODE_ENV=production foxen start')
	.action(async (options) => {
		await start({
			config: options.config,
			port: options.port ? Number(options.port) : undefined,
			host: options.host,
			rootDir: options.rootDir,
			strict: options.strict,
			verbose: options.verbose,
		});
	});

// Migrate command
cli
	.command('migrate [source]', 'Migrate a Next.js API project to standalone Elysia')
	.alias('m')
	.option('-o, --output <path>', 'Output directory for migrated project')
	.option('-n, --name <name>', 'Name for the new project')
	.option('-r, --runtime <runtime>', 'Target runtime: bun or node', { default: 'bun' })
	.option('-f, --force', 'Overwrite existing output directory')
	.option('-d, --dry-run', 'Preview migration without creating files')
	.option('--tests', 'Generate test file stubs')
	.option('--docker', 'Generate Dockerfile and docker-compose.yml')
	.option('-v, --verbose', 'Show detailed output')
	.example('foxen migrate ./my-nextjs-app')
	.example('foxen migrate ./my-nextjs-app -o ./my-elysia-app')
	.example('foxen migrate --dry-run')
	.action(async (source, options) => {
		await migrate(source, {
			output: options.output,
			name: options.name,
			runtime: options.runtime as 'bun' | 'node',
			force: options.force,
			dryRun: options.dryRun,
			tests: options.tests,
			docker: options.docker,
			verbose: options.verbose,
		});
	});

// ============================================================================
// Default and Help
// ============================================================================

// Default command (no args) - show help with banner
cli.command('', 'Show help').action(() => {
	printBanner();
	cli.outputHelp();
});

// Customize help output
cli.help((sections) => {
	// Add banner at the top
	sections.splice(0, 0, {
		body: `${pc.bold(pc.cyan('foxen'))} - ${pc.dim('Next.js App Router → Elysia')}\n`,
	});

	// Add examples section at the bottom
	sections.push({
		title: pc.bold('\nQuick Start'),
		body: `  ${pc.dim('$')} foxen init              ${pc.dim('# Create config file')}
  ${pc.dim('$')} foxen generate           ${pc.dim('# Generate routes')}
  ${pc.dim('$')} foxen dev                ${pc.dim('# Start dev server')}
  ${pc.dim('$')} foxen start              ${pc.dim('# Start production server')}
  ${pc.dim('$')} foxen migrate ./app      ${pc.dim('# Migrate Next.js project')}`,
	});

	sections.push({
		title: pc.bold('\nDocumentation'),
		body: `  ${pc.cyan('https://github.com/foxen/foxen')}`,
	});

	return sections;
});

// Parse and run
cli.parse();
