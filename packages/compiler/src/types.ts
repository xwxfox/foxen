import type { HttpMethod } from '@foxen/core';

/**
 * Information about a route handler parameter
 */
export interface RouteParamInfo {
	/** Parameter name */
	name: string;
	/** Parameter type as string */
	type: string;
	/** Whether the parameter has a default value */
	hasDefault: boolean;
	/** Whether the parameter is optional */
	isOptional: boolean;
	/** The default value if present */
	defaultValue?: string;
}

/**
 * Information about an exported handler
 */
export interface HandlerInfo {
	/** HTTP method this handler handles */
	method: HttpMethod;
	/** Name of the exported function/const */
	exportName: string;
	/** Whether it's an async function */
	isAsync: boolean;
	/** Whether it's an arrow function */
	isArrowFunction: boolean;
	/** Parameters of the handler */
	params: RouteParamInfo[];
	/** Start line in the source file */
	startLine: number;
	/** End line in the source file */
	endLine: number;
	/** JSDoc comment if present */
	jsDoc?: string;
}

/**
 * Information about a route configuration export
 */
export interface RouteConfigInfo {
	/** Dynamic rendering mode */
	dynamic?: 'auto' | 'force-dynamic' | 'error' | 'force-static';
	/** Revalidation time in seconds */
	revalidate?: number | false;
	/** Whether to prefer static generation */
	preferredRegion?: string | string[];
	/** Runtime (edge or nodejs) */
	runtime?: 'edge' | 'nodejs';
	/** Maximum request duration */
	maxDuration?: number;
}

/**
 * Analyzed route file information
 */
export interface AnalyzedRoute {
	/** Absolute file path */
	filePath: string;
	/** Relative path from routes directory */
	relativePath: string;
	/** Converted Elysia route pattern */
	elysiaPath: string;
	/** URL path params extracted from path */
	pathParams: string[];
	/** Whether this is a catch-all route */
	isCatchAll: boolean;
	/** Whether this is an optional catch-all route */
	isOptionalCatchAll: boolean;
	/** All handlers found in this file */
	handlers: HandlerInfo[];
	/** Route configuration exports */
	config: RouteConfigInfo;
	/** Imports used in the file */
	imports: ImportInfo[];
	/** Whether the file uses NextRequest */
	usesNextRequest: boolean;
	/** Whether the file uses NextResponse */
	usesNextResponse: boolean;
	/** Whether the file needs request body parsing */
	needsBodyParsing: boolean;
}

/**
 * Import statement information
 */
export interface ImportInfo {
	/** Module specifier */
	moduleSpecifier: string;
	/** Default import name */
	defaultImport?: string;
	/** Named imports */
	namedImports: Array<{
		name: string;
		alias?: string;
	}>;
	/** Namespace import */
	namespaceImport?: string;
	/** Whether this is a type-only import */
	isTypeOnly: boolean;
}

/**
 * Middleware file analysis
 */
export interface AnalyzedMiddleware {
	/** Absolute file path */
	filePath: string;
	/** The middleware function name */
	functionName: string;
	/** Whether it's async */
	isAsync: boolean;
	/** Parameters */
	params: RouteParamInfo[];
	/** Exports config matcher */
	config?: {
		matcher?: string | string[];
	};
}

/**
 * Complete analysis result for a routes directory
 */
export interface AnalysisResult {
	/** Root directory that was analyzed */
	rootDir: string;
	/** All analyzed routes */
	routes: AnalyzedRoute[];
	/** Middleware files found */
	middleware: AnalyzedMiddleware[];
	/** Any errors encountered during analysis */
	errors: AnalysisError[];
	/** Analysis timestamp */
	timestamp: Date;
}

/**
 * Error encountered during analysis
 */
export interface AnalysisError {
	/** File path where error occurred */
	filePath: string;
	/** Error message */
	message: string;
	/** Line number if available */
	line?: number;
	/** Column number if available */
	column?: number;
	/** Error code */
	code: string;
}

/**
 * Options for the analyzer
 */
export interface AnalyzerOptions {
	/** Root directory to analyze */
	rootDir: string;
	/** TypeScript config path (optional) */
	tsConfigPath?: string;
	/** File patterns to include */
	includePatterns?: string[];
	/** File patterns to exclude */
	excludePatterns?: string[];
	/** Whether to parse JSDoc comments */
	parseJsDoc?: boolean;
	/** Whether to resolve type information */
	resolveTypes?: boolean;
}

/**
 * Options for code generation
 */
export interface GeneratorOptions {
	/** Output file path */
	outputPath: string;
	/** Whether to generate TypeScript (.ts) or JavaScript (.js) */
	format: 'ts' | 'js';
	/** Whether to include source maps */
	sourceMap?: boolean;
	/** Whether to minify output */
	minify?: boolean;
	/** Module format */
	moduleFormat: 'esm' | 'cjs';
	/** Custom header comment */
	header?: string;
	/** Import alias for the routes directory */
	routesAlias?: string;
	/** Whether to inline handlers or import them */
	inlineHandlers?: boolean;
	/** Whether to generate barrel exports */
	generateBarrel?: boolean;
	/** Custom Elysia instance name */
	elysiaInstanceName?: string;
	/** Whether to use Elysia groups */
	useGroups?: boolean;
	/** Base path for all routes */
	basePath?: string;
}

/**
 * Generated code output
 */
export interface GeneratedOutput {
	/** Main router file content */
	routerCode: string;
	/** Type definitions if generating JS */
	typeDefinitions?: string;
	/** Source map if enabled */
	sourceMap?: string;
	/** Generated file paths */
	files: GeneratedFile[];
}

/**
 * A single generated file
 */
export interface GeneratedFile {
	/** File path relative to output directory */
	path: string;
	/** File content */
	content: string;
	/** File type */
	type: 'router' | 'types' | 'barrel' | 'config' | 'sourcemap';
}

/**
 * Transform context passed to transformers
 */
export interface TransformContext {
	/** Current route being transformed */
	route: AnalyzedRoute;
	/** All routes in the project */
	allRoutes: AnalyzedRoute[];
	/** Generator options */
	options: GeneratorOptions;
	/** Project root */
	projectRoot: string;
}

/**
 * A transformer function that modifies route generation
 */
export type RouteTransformer = (context: TransformContext) => Promise<string> | string;

/**
 * Plugin interface for extending the compiler
 */
export interface CompilerPlugin {
	/** Plugin name */
	name: string;
	/** Called before analysis */
	beforeAnalysis?: (options: AnalyzerOptions) => Promise<void> | void;
	/** Called after analysis */
	afterAnalysis?: (result: AnalysisResult) => Promise<AnalysisResult> | AnalysisResult;
	/** Called before generation */
	beforeGeneration?: (routes: AnalyzedRoute[], options: GeneratorOptions) => Promise<void> | void;
	/** Custom route transformer */
	transformRoute?: RouteTransformer;
	/** Called after generation */
	afterGeneration?: (output: GeneratedOutput) => Promise<GeneratedOutput> | GeneratedOutput;
}
