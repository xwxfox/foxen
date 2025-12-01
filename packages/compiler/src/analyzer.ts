import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { HttpMethod } from '@foxen/core';
import {
	type ArrowFunction,
	type FunctionDeclaration,
	type FunctionExpression,
	type ObjectLiteralExpression,
	Project,
	type PropertyAssignment,
	type SourceFile,
	SyntaxKind,
	type VariableDeclaration,
} from 'ts-morph';
import type {
	AnalysisError,
	AnalysisResult,
	AnalyzedMiddleware,
	AnalyzedRoute,
	AnalyzerOptions,
	HandlerInfo,
	ImportInfo,
	RouteConfigInfo,
	RouteParamInfo,
} from './types.js';

/** HTTP methods that can be exported from route files */
const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

/** Route config exports to look for */
const CONFIG_EXPORTS = [
	'dynamic',
	'revalidate',
	'preferredRegion',
	'runtime',
	'maxDuration',
] as const;

/**
 * Analyzer class for parsing route files with ts-morph
 */
export class RouteAnalyzer {
	private project: Project;
	private options: Omit<Required<AnalyzerOptions>, 'tsConfigPath'> & { tsConfigPath?: string };
	private errors: AnalysisError[] = [];

	constructor(options: AnalyzerOptions) {
		const tsConfigPath = options.tsConfigPath ?? this.findTsConfig(options.rootDir);

		this.options = {
			rootDir: options.rootDir,
			tsConfigPath,
			includePatterns: options.includePatterns ?? ['**/route.{ts,tsx,js,jsx}'],
			excludePatterns: options.excludePatterns ?? [
				'**/node_modules/**',
				'**/.next/**',
				'**/dist/**',
			],
			parseJsDoc: options.parseJsDoc ?? true,
			resolveTypes: options.resolveTypes ?? false,
		};

		this.project = new Project({
			tsConfigFilePath: this.options.tsConfigPath,
			skipAddingFilesFromTsConfig: true,
		});
	}

	/**
	 * Find tsconfig.json in the project
	 */
	private findTsConfig(rootDir: string): string | undefined {
		const candidates = [join(rootDir, 'tsconfig.json'), join(rootDir, '..', 'tsconfig.json')];
		return candidates.find((p) => existsSync(p));
	}

	/**
	 * Analyze all routes in the directory
	 */
	async analyze(): Promise<AnalysisResult> {
		this.errors = [];
		const routes: AnalyzedRoute[] = [];
		const middleware: AnalyzedMiddleware[] = [];

		// Find all route files
		const routeFiles = await this.findRouteFiles();

		// Find middleware files
		const middlewareFiles = await this.findMiddlewareFiles();

		// Analyze each route file
		for (const filePath of routeFiles) {
			try {
				const route = await this.analyzeRouteFile(filePath);
				if (route) {
					routes.push(route);
				}
			} catch (error) {
				this.errors.push({
					filePath,
					message: error instanceof Error ? error.message : String(error),
					code: 'ANALYSIS_ERROR',
				});
			}
		}

		// Analyze middleware files
		for (const filePath of middlewareFiles) {
			try {
				const mw = await this.analyzeMiddlewareFile(filePath);
				if (mw) {
					middleware.push(mw);
				}
			} catch (error) {
				this.errors.push({
					filePath,
					message: error instanceof Error ? error.message : String(error),
					code: 'MIDDLEWARE_ANALYSIS_ERROR',
				});
			}
		}

		return {
			rootDir: this.options.rootDir,
			routes: routes.sort((a, b) => a.elysiaPath.localeCompare(b.elysiaPath)),
			middleware,
			errors: this.errors,
			timestamp: new Date(),
		};
	}

	/**
	 * Find all route files matching patterns
	 */
	private async findRouteFiles(): Promise<string[]> {
		const glob = await import('fast-glob');
		return glob.default(this.options.includePatterns, {
			cwd: this.options.rootDir,
			absolute: true,
			ignore: this.options.excludePatterns,
		});
	}

	/**
	 * Find middleware files
	 */
	private async findMiddlewareFiles(): Promise<string[]> {
		const glob = await import('fast-glob');
		return glob.default(['**/middleware.{ts,tsx,js,jsx}'], {
			cwd: this.options.rootDir,
			absolute: true,
			ignore: this.options.excludePatterns,
		});
	}

	/**
	 * Analyze a single route file
	 */
	private async analyzeRouteFile(filePath: string): Promise<AnalyzedRoute | null> {
		const sourceFile = this.project.addSourceFileAtPath(filePath);
		const relativePath = relative(this.options.rootDir, filePath);
		const elysiaPath = this.convertToElysiaPath(relativePath);
		const pathParams = this.extractPathParams(elysiaPath);

		const handlers = this.extractHandlers(sourceFile);
		if (handlers.length === 0) {
			return null; // No handlers found, skip this file
		}

		const config = this.extractRouteConfig(sourceFile);
		const imports = this.extractImports(sourceFile);

		const usesNextRequest = this.checkUsesType(sourceFile, 'NextRequest');
		const usesNextResponse = this.checkUsesType(sourceFile, 'NextResponse');
		const needsBodyParsing = this.checkNeedsBodyParsing(handlers);

		return {
			filePath,
			relativePath,
			elysiaPath,
			pathParams,
			isCatchAll: elysiaPath.includes('*'),
			isOptionalCatchAll: relativePath.includes('[[...'),
			handlers,
			config,
			imports,
			usesNextRequest,
			usesNextResponse,
			needsBodyParsing,
		};
	}

	/**
	 * Extract HTTP method handlers from a source file
	 */
	private extractHandlers(sourceFile: SourceFile): HandlerInfo[] {
		const handlers: HandlerInfo[] = [];

		// Check exported functions
		for (const func of sourceFile.getFunctions()) {
			const name = func.getName();
			if (name && HTTP_METHODS.includes(name as HttpMethod) && func.isExported()) {
				handlers.push(this.analyzeFunction(func, name as HttpMethod));
			}
		}

		// Check exported variable declarations (arrow functions)
		for (const varStmt of sourceFile.getVariableStatements()) {
			if (!varStmt.isExported()) continue;

			for (const decl of varStmt.getDeclarations()) {
				const name = decl.getName();
				if (!HTTP_METHODS.includes(name as HttpMethod)) continue;

				const initializer = decl.getInitializer();
				if (initializer) {
					const handler = this.analyzeVariableHandler(decl, name as HttpMethod, initializer);
					if (handler) {
						handlers.push(handler);
					}
				}
			}
		}

		return handlers;
	}

	/**
	 * Analyze a function declaration
	 */
	private analyzeFunction(func: FunctionDeclaration, method: HttpMethod): HandlerInfo {
		const params = func.getParameters().map((p) => this.analyzeParameter(p));
		const jsDoc = this.options.parseJsDoc
			? func
					.getJsDocs()
					.map((d) => d.getText())
					.join('\n')
			: undefined;

		return {
			method,
			exportName: func.getName() ?? method,
			isAsync: func.isAsync(),
			isArrowFunction: false,
			params,
			startLine: func.getStartLineNumber(),
			endLine: func.getEndLineNumber(),
			jsDoc: jsDoc || undefined,
		};
	}

	/**
	 * Analyze a variable declaration (arrow function handler)
	 */
	private analyzeVariableHandler(
		decl: VariableDeclaration,
		method: HttpMethod,
		initializer: ReturnType<VariableDeclaration['getInitializer']>,
	): HandlerInfo | null {
		if (!initializer) return null;

		const kind = initializer.getKind();
		let params: RouteParamInfo[] = [];
		let isAsync = false;

		if (kind === SyntaxKind.ArrowFunction) {
			const arrow = initializer as ArrowFunction;
			params = arrow.getParameters().map((p) => this.analyzeParameter(p));
			isAsync = arrow.isAsync();
		} else if (kind === SyntaxKind.FunctionExpression) {
			const funcExpr = initializer as FunctionExpression;
			params = funcExpr.getParameters().map((p) => this.analyzeParameter(p));
			isAsync = funcExpr.isAsync();
		} else {
			return null;
		}

		const jsDoc = this.options.parseJsDoc
			? decl
					.getParent()
					.getParent()
					?.getLeadingCommentRanges()
					?.map((c) => c.getText())
					.join('\n')
			: undefined;

		return {
			method,
			exportName: decl.getName(),
			isAsync,
			isArrowFunction: kind === SyntaxKind.ArrowFunction,
			params,
			startLine: decl.getStartLineNumber(),
			endLine: decl.getEndLineNumber(),
			jsDoc: jsDoc || undefined,
		};
	}

	/**
	 * Analyze a function parameter
	 */
	private analyzeParameter(
		param: ReturnType<FunctionDeclaration['getParameters']>[0],
	): RouteParamInfo {
		return {
			name: param.getName(),
			type: param.getType().getText(),
			hasDefault: param.hasInitializer(),
			isOptional: param.isOptional(),
			defaultValue: param.getInitializer()?.getText(),
		};
	}

	/**
	 * Extract route configuration exports
	 */
	private extractRouteConfig(sourceFile: SourceFile): RouteConfigInfo {
		const config: RouteConfigInfo = {};

		for (const varStmt of sourceFile.getVariableStatements()) {
			if (!varStmt.isExported()) continue;

			for (const decl of varStmt.getDeclarations()) {
				const name = decl.getName();
				if (!CONFIG_EXPORTS.includes(name as (typeof CONFIG_EXPORTS)[number])) {
					continue;
				}

				const initializer = decl.getInitializer();
				if (initializer) {
					const value = this.evaluateLiteralValue(initializer);
					if (value !== undefined) {
						// biome-ignore lint/suspicious/noExplicitAny: Dynamic config keys
						(config as any)[name] = value;
					}
				}
			}
		}

		return config;
	}

	/**
	 * Evaluate a literal value from an AST node
	 */
	private evaluateLiteralValue(node: ReturnType<VariableDeclaration['getInitializer']>): unknown {
		if (!node) return undefined;

		switch (node.getKind()) {
			case SyntaxKind.StringLiteral:
				return node.getText().slice(1, -1); // Remove quotes
			case SyntaxKind.NumericLiteral:
				return Number(node.getText());
			case SyntaxKind.TrueKeyword:
				return true;
			case SyntaxKind.FalseKeyword:
				return false;
			case SyntaxKind.ArrayLiteralExpression: {
				const arr = node.asKind(SyntaxKind.ArrayLiteralExpression);
				return arr?.getElements().map((e) => this.evaluateLiteralValue(e));
			}
			default:
				return undefined;
		}
	}

	/**
	 * Extract import statements
	 */
	private extractImports(sourceFile: SourceFile): ImportInfo[] {
		return sourceFile.getImportDeclarations().map((imp) => {
			const namedImports = imp.getNamedImports().map((n) => ({
				name: n.getName(),
				alias: n.getAliasNode()?.getText(),
			}));

			return {
				moduleSpecifier: imp.getModuleSpecifierValue(),
				defaultImport: imp.getDefaultImport()?.getText(),
				namedImports,
				namespaceImport: imp.getNamespaceImport()?.getText(),
				isTypeOnly: imp.isTypeOnly(),
			};
		});
	}

	/**
	 * Check if a type is used in the file
	 */
	private checkUsesType(sourceFile: SourceFile, typeName: string): boolean {
		const imports = sourceFile.getImportDeclarations();
		for (const imp of imports) {
			const namedImports = imp.getNamedImports();
			if (namedImports.some((n) => n.getName() === typeName)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Check if any handler needs body parsing
	 */
	private checkNeedsBodyParsing(handlers: HandlerInfo[]): boolean {
		const methodsNeedingBody = ['POST', 'PUT', 'PATCH'];
		return handlers.some((h) => methodsNeedingBody.includes(h.method));
	}

	/**
	 * Convert file path to Elysia route pattern
	 */
	private convertToElysiaPath(relativePath: string): string {
		// Remove route.ts suffix
		let path = dirname(relativePath);

		// Handle Windows paths
		path = path.replace(/\\/g, '/');

		// Handle api prefix
		if (path.startsWith('api/')) {
			path = path.slice(3); // Keep the leading /
		} else if (path === 'api') {
			path = '';
		}

		// Convert Next.js dynamic segments to Elysia params
		// [param] -> :param
		path = path.replace(/\[([^\]\.]+)\]/g, ':$1');

		// [[...param]] -> *param (optional catch-all)
		path = path.replace(/\[\[\.\.\.([^\]]+)\]\]/g, '*$1');

		// [...param] -> *param (catch-all)
		path = path.replace(/\[\.\.\.([^\]]+)\]/g, '*$1');

		// Handle route groups (parentheses)
		path = path.replace(/\([^)]+\)\//g, '');
		path = path.replace(/\([^)]+\)$/g, '');

		// Ensure leading slash
		if (!path.startsWith('/')) {
			path = `/${path}`;
		}

		// Remove trailing slash (except for root)
		if (path.length > 1 && path.endsWith('/')) {
			path = path.slice(0, -1);
		}

		// Handle root
		if (path === '/.') {
			path = '/';
		}

		return path;
	}

	/**
	 * Extract path parameters from Elysia path
	 */
	private extractPathParams(elysiaPath: string): string[] {
		const params: string[] = [];

		// Match :param
		const paramMatches = elysiaPath.matchAll(/:([^/]+)/g);
		for (const match of paramMatches) {
			if (match[1]) {
				params.push(match[1]);
			}
		}

		// Match *param (catch-all)
		const catchAllMatches = elysiaPath.matchAll(/\*([^/]+)/g);
		for (const match of catchAllMatches) {
			if (match[1]) {
				params.push(match[1]);
			}
		}

		return params;
	}

	/**
	 * Analyze a middleware file
	 */
	private async analyzeMiddlewareFile(filePath: string): Promise<AnalyzedMiddleware | null> {
		const sourceFile = this.project.addSourceFileAtPath(filePath);

		// Look for exported middleware function
		let middlewareFunc: FunctionDeclaration | undefined;
		let isAsync = false;
		let params: RouteParamInfo[] = [];

		// Check for function export
		for (const func of sourceFile.getFunctions()) {
			if (func.getName() === 'middleware' && func.isExported()) {
				middlewareFunc = func;
				isAsync = func.isAsync();
				params = func.getParameters().map((p) => this.analyzeParameter(p));
				break;
			}
		}

		// Check for arrow function export
		if (!middlewareFunc) {
			for (const varStmt of sourceFile.getVariableStatements()) {
				if (!varStmt.isExported()) continue;

				for (const decl of varStmt.getDeclarations()) {
					if (decl.getName() === 'middleware') {
						const initializer = decl.getInitializer();
						if (initializer?.getKind() === SyntaxKind.ArrowFunction) {
							const arrow = initializer as ArrowFunction;
							isAsync = arrow.isAsync();
							params = arrow.getParameters().map((p) => this.analyzeParameter(p));
						}
						break;
					}
				}
			}
		}

		if (!middlewareFunc && params.length === 0) {
			return null;
		}

		// Extract config
		const config = this.extractMiddlewareConfig(sourceFile);

		return {
			filePath,
			functionName: 'middleware',
			isAsync,
			params,
			config,
		};
	}

	/**
	 * Extract middleware config (matcher)
	 */
	private extractMiddlewareConfig(
		sourceFile: SourceFile,
	): { matcher?: string | string[] } | undefined {
		for (const varStmt of sourceFile.getVariableStatements()) {
			if (!varStmt.isExported()) continue;

			for (const decl of varStmt.getDeclarations()) {
				if (decl.getName() !== 'config') continue;

				const initializer = decl.getInitializer();
				if (initializer?.getKind() === SyntaxKind.ObjectLiteralExpression) {
					const obj = initializer as ObjectLiteralExpression;

					for (const prop of obj.getProperties()) {
						if (prop.getKind() === SyntaxKind.PropertyAssignment) {
							const propAssign = prop as PropertyAssignment;
							if (propAssign.getName() === 'matcher') {
								const value = this.evaluateLiteralValue(propAssign.getInitializer());
								if (value) {
									return { matcher: value as string | string[] };
								}
							}
						}
					}
				}
			}
		}

		return undefined;
	}
}

/**
 * Create and run analyzer
 */
export async function analyzeRoutes(options: AnalyzerOptions): Promise<AnalysisResult> {
	const analyzer = new RouteAnalyzer(options);
	return analyzer.analyze();
}

/**
 * Analyze a single file
 */
export async function analyzeFile(
	filePath: string,
	tsConfigPath?: string,
): Promise<AnalyzedRoute | null> {
	const _project = new Project({
		tsConfigFilePath: tsConfigPath,
		skipAddingFilesFromTsConfig: true,
	});

	const analyzer = new RouteAnalyzer({
		rootDir: dirname(filePath),
		tsConfigPath,
	});

	// Use the internal analyze method
	const result = await analyzer.analyze();
	return result.routes[0] ?? null;
}
