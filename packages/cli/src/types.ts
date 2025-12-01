export interface Config {
	/** Routes directory (relative to config) */
	routesDir: string;
	/** Output directory for generated files */
	outputDir: string;
	/** TypeScript config path */
	tsConfigPath?: string;
	/** Base path for API routes */
	basePath?: string;
	/** Output format */
	format?: 'ts' | 'js';
	/** Whether to generate barrel exports */
	generateBarrel?: boolean;
	/** Import alias for routes */
	routesAlias?: string;
	/** Whether to use Elysia groups */
	useGroups?: boolean;
	/** Custom Elysia instance name */
	elysiaInstanceName?: string;
	/** Plugins to load */
	plugins?: string[];
	/** Watch file patterns */
	watchPatterns?: string[];
	/** Ignore patterns */
	ignorePatterns?: string[];
}

/**
 * Default configuration
 */
export const defaultConfig: Config = {
	routesDir: './src/app/api',
	outputDir: './src/generated',
	basePath: '/api',
	format: 'ts',
	generateBarrel: true,
	routesAlias: '@/app/api',
	useGroups: true,
	elysiaInstanceName: 'app',
	ignorePatterns: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
};

/**
 * Config file names to search for
 */
export const configFileNames = ['foxen.config.ts', 'foxen.config.js', 'foxen.config.mjs'] as const;

/**
 * CLI command options
 */
export interface GenerateOptions {
	config?: string;
	routes?: string;
	output?: string;
	watch?: boolean;
	verbose?: boolean;
}

export interface DevOptions {
	config?: string;
	port?: number;
	host?: string;
}

export interface StartOptions {
	/** Path to foxen.config.ts file */
	config?: string;
	/** Server port (defaults to PORT env or 3000) */
	port?: number;
	/** Server host (defaults to HOST env or 0.0.0.0) */
	host?: string;
	/** Root directory for .env files */
	rootDir?: string;
	/** Strict mode - fail on env validation errors (default: true in production) */
	strict?: boolean;
	/** Show detailed output */
	verbose?: boolean;
}

export interface BuildOptions {
	config?: string;
	minify?: boolean;
}
