import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import {
	IndentationText,
	NewLineKind,
	Project,
	QuoteKind,
	VariableDeclarationKind,
} from 'ts-morph';
import type { MigrationResult, NextJsProjectAnalysis, ScaffoldOptions } from './types.js';

const jsonRequire = createRequire(import.meta.url);
const FALLBACK_FOXEN_VERSION = '^1.4.0';

function resolveFoxenVersion(): string {
	try {
		const pkg = jsonRequire('foxn/package.json') as { version?: string };
		if (pkg?.version) {
			return `^${pkg.version}`;
		}
	} catch {
		// Ignore - fallback covers cases where foxn isn't locally resolvable
	}

	return FALLBACK_FOXEN_VERSION;
}

const FOXEN_VERSION = resolveFoxenVersion();

/**
 * Default scaffold options
 */
const DEFAULT_OPTIONS: Partial<ScaffoldOptions> = {
	createGitignore: true,
	createReadme: true,
	runtime: 'bun',
	formatter: 'biome',
	useStrict: true,
};

/**
 * Scaffold a new Elysia project
 */
export async function scaffoldProject(
	analysis: NextJsProjectAnalysis,
	outputDir: string,
	options: Partial<ScaffoldOptions> = {},
): Promise<MigrationResult> {
	const opts = { ...DEFAULT_OPTIONS, ...options } as ScaffoldOptions;
	const warnings: string[] = [];
	const errors: string[] = [];

	// Create output directory
	if (!existsSync(outputDir)) {
		await mkdir(outputDir, { recursive: true });
	}

	// Create directory structure
	await createDirectories(outputDir);

	// Generate package.json
	await writePackageJson(outputDir, analysis, opts);

	// Generate tsconfig.json
	await writeTsConfig(outputDir, opts);

	// Generate main entry point
	await writeMainEntry(outputDir, opts);

	// Generate formatter config
	if (opts.formatter === 'biome') {
		await writeBiomeConfig(outputDir);
	}

	// Generate .gitignore if requested
	if (opts.createGitignore) {
		await writeGitignore(outputDir, opts);
	}

	// Generate README if requested
	if (opts.createReadme) {
		await writeReadme(outputDir, analysis);
	}

	return {
		success: errors.length === 0,
		outputDir,
		routes: [], // Routes will be added during transformation
		warnings,
		errors,
	};
}

/**
 * Create the project directory structure
 */
async function createDirectories(outputDir: string): Promise<void> {
	const directories = ['src', 'src/routes', 'src/middleware', 'src/types', 'src/utils'];

	for (const dir of directories) {
		const fullPath = join(outputDir, dir);
		if (!existsSync(fullPath)) {
			await mkdir(fullPath, { recursive: true });
		}
	}
}

/**
 * Generate package.json using ts-morph for JSON
 */
async function writePackageJson(
	outputDir: string,
	analysis: NextJsProjectAnalysis,
	options: ScaffoldOptions,
): Promise<void> {
	const name = options.projectName || `${analysis.name}-elysia`;
	const isBun = options.runtime === 'bun';

	const packageJson = {
		name,
		version: '0.0.1',
		type: 'module' as const,
		scripts: {
			dev: isBun ? 'bun run --hot src/index.ts' : 'tsx watch src/index.ts',
			build: isBun ? 'bun build src/index.ts --outdir dist --target bun' : 'tsc',
			start: isBun ? 'bun dist/index.js' : 'node dist/index.js',
			lint: options.formatter === 'biome' ? 'biome check .' : 'eslint .',
			format: options.formatter === 'biome' ? 'biome format --write .' : 'prettier --write .',
			test: isBun ? 'bun test' : 'vitest',
		},
		dependencies: {
			foxn: FOXEN_VERSION,
			elysia: '^1.3.0',
			'@elysiajs/cors': '^1.3.0',
			'@elysiajs/swagger': '^1.3.0',
		} as Record<string, string>,
		devDependencies: {
			typescript: '^5.8.0',
			'@types/node': '^22.0.0',
		} as Record<string, string>,
	};

	// Add runtime-specific dependencies
	if (isBun) {
		packageJson.devDependencies['@types/bun'] = 'latest';
	} else {
		packageJson.devDependencies.tsx = '^4.20.0';
		packageJson.devDependencies.vitest = '^3.0.0';
	}

	// Add formatter dependencies
	if (options.formatter === 'biome') {
		packageJson.devDependencies['@biomejs/biome'] = '1.9.4';
	} else if (options.formatter === 'eslint') {
		packageJson.devDependencies.eslint = '^9.0.0';
		packageJson.devDependencies['@eslint/js'] = '^9.0.0';
	}

	await writeFile(join(outputDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
}

/**
 * Generate tsconfig.json using ts-morph
 */
async function writeTsConfig(outputDir: string, options: ScaffoldOptions): Promise<void> {
	const isBun = options.runtime === 'bun';

	const tsconfig = {
		compilerOptions: {
			target: 'ESNext',
			module: 'ESNext',
			moduleResolution: isBun ? 'bundler' : 'node',
			esModuleInterop: true,
			strict: options.useStrict !== false,
			skipLibCheck: true,
			declaration: true,
			outDir: './dist',
			rootDir: './src',
			types: isBun ? ['bun-types'] : ['node'],
			resolveJsonModule: true,
			isolatedModules: true,
			noEmit: isBun,
		},
		include: ['src/**/*'],
		exclude: ['node_modules', 'dist'],
	};

	await writeFile(join(outputDir, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);
}

/**
 * Generate main entry point using ts-morph
 */
async function writeMainEntry(outputDir: string, _options: ScaffoldOptions): Promise<void> {
	const project = new Project({
		manipulationSettings: {
			indentationText: IndentationText.TwoSpaces,
			newLineKind: NewLineKind.LineFeed,
			quoteKind: QuoteKind.Double,
			usePrefixAndSuffixTextForRename: false,
			useTrailingCommas: true,
		},
	});

	const sourceFile = project.createSourceFile(join(outputDir, 'src/index.ts'), '', {
		overwrite: true,
	});

	// Add imports
	sourceFile.addImportDeclaration({
		moduleSpecifier: 'elysia',
		namedImports: ['Elysia'],
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: '@elysiajs/swagger',
		namedImports: ['swagger'],
	});

	sourceFile.addImportDeclaration({
		moduleSpecifier: '@elysiajs/cors',
		namedImports: ['cors'],
	});

	// Add newline
	sourceFile.addStatements('\n');

	// Add port constant
	sourceFile.addVariableStatement({
		isExported: false,
		declarationKind: VariableDeclarationKind.Const,
		declarations: [
			{
				name: 'PORT',
				initializer: 'process.env.PORT || 3000',
			},
		],
	});

	// Add newline
	sourceFile.addStatements('\n');

	// Add app initialization
	sourceFile.addVariableStatement({
		isExported: true,
		declarationKind: VariableDeclarationKind.Const,
		declarations: [
			{
				name: 'app',
				initializer: `new Elysia()
  .use(swagger())
  .use(cors())
  .get("/health", () => ({ status: "ok" }))
  .listen(PORT)`,
			},
		],
	});

	// Add newline
	sourceFile.addStatements('\n');

	// Add console.log for startup
	sourceFile.addStatements(
		'console.log(`Elysia server running at ${app.server?.hostname}:${app.server?.port}`);',
	);

	await sourceFile.save();
}

/**
 * Generate biome.json config
 */
async function writeBiomeConfig(outputDir: string): Promise<void> {
	const biomeConfig = {
		$schema: 'https://biomejs.dev/schemas/1.9.4/schema.json',
		vcs: {
			enabled: true,
			clientKind: 'git',
			useIgnoreFile: true,
		},
		organizeImports: {
			enabled: true,
		},
		linter: {
			enabled: true,
			rules: {
				recommended: true,
			},
		},
		formatter: {
			enabled: true,
			indentStyle: 'space',
			indentWidth: 2,
		},
		javascript: {
			formatter: {
				quoteStyle: 'double',
				semicolons: 'always',
			},
		},
	};

	await writeFile(join(outputDir, 'biome.json'), `${JSON.stringify(biomeConfig, null, 2)}\n`);
}

/**
 * Generate .gitignore
 */
async function writeGitignore(outputDir: string, options: ScaffoldOptions): Promise<void> {
	const lines = [
		'# Dependencies',
		'node_modules/',
		'',
		'# Build output',
		'dist/',
		'.next/',
		'out/',
		'',
		'# Environment',
		'.env',
		'.env.local',
		'.env.*.local',
		'',
		'# IDE',
		'.idea/',
		'.vscode/',
		'*.swp',
		'*.swo',
		'',
		'# OS',
		'.DS_Store',
		'Thumbs.db',
		'',
		'# Logs',
		'*.log',
		'npm-debug.log*',
		'',
		'# Testing',
		'coverage/',
		'',
	];

	if (options.runtime === 'bun') {
		lines.push('# Bun', 'bun.lockb');
	} else {
		lines.push('# Package manager', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml');
	}

	await writeFile(join(outputDir, '.gitignore'), `${lines.join('\n')}\n`);
}

/**
 * Generate README.md
 */
async function writeReadme(outputDir: string, analysis: NextJsProjectAnalysis): Promise<void> {
	const name = analysis.name;
	const lines = [
		`# ${name} (Elysia)`,
		'',
		'This project was migrated from Next.js API Routes to Elysia using [Foxen](https://github.com/xwxfox/foxen).',
		'',
		'## Getting Started',
		'',
		'Install dependencies:',
		'',
		'```bash',
		'bun install',
		'```',
		'',
		'Run the development server:',
		'',
		'```bash',
		'bun dev',
		'```',
		'',
		'The server will start at http://localhost:3000',
		'',
		'## API Documentation',
		'',
		'Swagger documentation is available at http://localhost:3000/swagger',
		'',
		'## Project Structure',
		'',
		'```',
		'src/',
		'├── index.ts        # Main entry point',
		'├── routes/         # API route handlers',
		'├── middleware/     # Middleware functions',
		'├── types/          # TypeScript type definitions',
		'└── utils/          # Utility functions',
		'```',
		'',
		'## Original Next.js Project',
		'',
		`- Source: ${analysis.root}`,
		`- Routes directory: ${analysis.routesDir}`,
		`- Routes migrated: ${analysis.routes.length}`,
		'',
	];

	await writeFile(join(outputDir, 'README.md'), lines.join('\n'));
}
