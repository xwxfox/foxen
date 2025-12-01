import type { AnalyzedRoute } from '@foxen/compiler';

/**
 * Options for the migrate command
 */
export interface MigrateOptions {
	/** Path to Next.js project */
	source: string;
	/** Path for new Elysia project */
	destination: string;
	/** Project name (defaults to directory name) */
	name?: string;

	// What to migrate
	/** Whether to migrate routes */
	migrateRoutes?: boolean;
	/** Whether to migrate middleware */
	migrateMiddleware?: boolean;
	/** Whether to migrate next.config */
	migrateConfig?: boolean;

	// Generation options
	/** Whether to generate test stubs */
	generateTests?: boolean;
	/** Whether to generate Dockerfile */
	generateDocker?: boolean;

	// Output options
	/** Whether to use TypeScript */
	useTypeScript?: boolean;
	/** Package manager to use */
	packageManager?: 'bun' | 'npm' | 'pnpm';

	// Behavior
	/** Whether to overwrite existing destination */
	overwrite?: boolean;
	/** Whether to show verbose output */
	verbose?: boolean;
}

/**
 * Analysis of a Next.js project structure
 */
export interface NextJsProjectAnalysis {
	/** Root directory of the project */
	root: string;
	/** Project name from package.json */
	name: string;
	/** Project version from package.json */
	version?: string;

	// Detected structure
	/** Routes directory (e.g., 'src/app/api' or 'app/api') */
	routesDir: string;
	/** Whether middleware.ts exists */
	hasMiddleware: boolean;
	/** Path to middleware file */
	middlewarePath?: string;
	/** Whether next.config exists */
	hasNextConfig: boolean;
	/** Path to next.config file */
	nextConfigPath?: string;

	// Route information
	/** All analyzed routes */
	routes: AnalyzedRoute[];

	// Dependencies
	/** Dependencies from package.json */
	dependencies: string[];
	/** Dev dependencies from package.json */
	devDependencies: string[];

	// Config features used
	/** Whether redirects are configured */
	usesRedirects: boolean;
	/** Whether rewrites are configured */
	usesRewrites: boolean;
	/** Whether headers are configured */
	usesHeaders: boolean;
}

/**
 * Result of a migration operation
 */
export interface MigrationResult {
	/** Whether migration succeeded */
	success: boolean;
	/** Output directory of the new project */
	outputDir: string;
	/** Routes that were migrated */
	routes: TransformedRoute[];
	/** Warnings encountered */
	warnings: string[];
	/** Errors encountered */
	errors: string[];
}

/**
 * Result of transforming a single route
 */
export interface TransformedRoute {
	/** Original Next.js route file path */
	originalPath: string;
	/** Output Elysia route file path */
	outputPath: string;
	/** Elysia route path */
	elysiaPath: string;
	/** HTTP methods in this route */
	methods: string[];
	/** Whether transformation succeeded */
	success: boolean;
	/** Error message if failed */
	error?: string;
}

/**
 * Dependency resolution result
 */
export interface DependencyResolution {
	/** Dependencies to keep as-is */
	keep: string[];
	/** Dependencies to remove */
	remove: string[];
	/** Dependencies to add */
	add: Array<{ name: string; version: string; reason: string }>;
	/** Warnings about dependencies */
	warnings: string[];
}

/**
 * Options for scaffolding a new project
 */
export interface ScaffoldOptions {
	/** Project name */
	projectName: string;
	/** Target runtime */
	runtime: 'bun' | 'node';
	/** Whether to create .gitignore */
	createGitignore: boolean;
	/** Whether to create README.md */
	createReadme: boolean;
	/** Formatter to use */
	formatter: 'biome' | 'eslint' | 'prettier';
	/** Whether to use strict TypeScript */
	useStrict: boolean;
}

/**
 * Project template options
 */
export interface TemplateOptions {
	/** Project name */
	name: string;
	/** Project description */
	description?: string;
	/** Resolved dependencies */
	dependencies: DependencyResolution;
	/** Whether to use TypeScript */
	typescript: boolean;
	/** Package manager */
	packageManager: 'bun' | 'npm' | 'pnpm';
	/** Base path for API routes */
	basePath?: string;
	/** Whether middleware exists */
	hasMiddleware: boolean;
	/** Whether config exists */
	hasConfig: boolean;
}

/**
 * File to be written during scaffolding
 */
export interface ScaffoldFile {
	/** Relative path from project root */
	path: string;
	/** File content */
	content: string;
}
