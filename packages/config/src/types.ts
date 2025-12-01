/**
 * Route condition for matching requests
 */
export interface RouteCondition {
	type: 'header' | 'cookie' | 'host' | 'query';
	key: string;
	value?: string;
}

/**
 * Next.js redirect configuration
 */
export interface NextRedirect {
	source: string;
	destination: string;
	permanent: boolean;
	basePath?: false;
	locale?: false;
	has?: RouteCondition[];
	missing?: RouteCondition[];
}

/**
 * Next.js rewrite configuration
 */
export interface NextRewrite {
	source: string;
	destination: string;
	basePath?: false;
	locale?: false;
	has?: RouteCondition[];
	missing?: RouteCondition[];
}

/**
 * Next.js header configuration
 */
export interface NextHeader {
	source: string;
	headers: Array<{ key: string; value: string }>;
	basePath?: false;
	locale?: false;
	has?: RouteCondition[];
	missing?: RouteCondition[];
}

/**
 * Rewrites can be in simple array form or categorized
 */
export interface NextRewritesConfig {
	beforeFiles?: NextRewrite[];
	afterFiles?: NextRewrite[];
	fallback?: NextRewrite[];
}

/**
 * Raw next.config.ts export shape
 */
export interface NextConfigRaw {
	basePath?: string;
	trailingSlash?: boolean;
	redirects?: () => Promise<NextRedirect[]> | NextRedirect[];
	rewrites?: () => Promise<NextRewrite[] | NextRewritesConfig> | NextRewrite[] | NextRewritesConfig;
	headers?: () => Promise<NextHeader[]> | NextHeader[];
	[key: string]: unknown;
}

/**
 * Resolved next.config with async functions resolved
 */
export interface ResolvedNextConfig {
	basePath: string;
	trailingSlash: boolean;
	redirects: NextRedirect[];
	rewrites: NextRewritesConfig;
	headers: NextHeader[];
}

/**
 * Foxen configuration file structure
 */
export interface FoxenConfig {
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
	/** Path to next.config.ts (or false to disable) */
	nextConfigPath?: string | false;
	/** Path to middleware.ts (or false to disable) */
	middlewarePath?: string | false;
	/** Plugins to load */
	plugins?: string[];
	/** Watch file patterns */
	watchPatterns?: string[];
	/** Ignore patterns */
	ignorePatterns?: string[];
}

/**
 * Options for config loading
 */
export interface ConfigLoaderOptions {
	/** Starting directory to search from */
	startDir?: string;
	/** Specific config file path */
	configPath?: string;
	/** Whether to throw on missing config */
	throwOnMissing?: boolean;
	/** Whether to resolve async config functions */
	resolveAsync?: boolean;
}
