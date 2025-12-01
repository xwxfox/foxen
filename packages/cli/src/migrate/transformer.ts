import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { AnalyzedRoute } from '@foxen/compiler';
import {
	type FunctionDeclaration,
	IndentationText,
	NewLineKind,
	Project,
	QuoteKind,
	type SourceFile,
	VariableDeclarationKind,
} from 'ts-morph';
import type { NextJsProjectAnalysis, TransformedRoute } from './types.js';

/**
 * HTTP methods supported by Next.js App Router
 */
const _HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

/**
 * Transform all routes from a Next.js project to Elysia
 */
export async function transformAllRoutes(
	analysis: NextJsProjectAnalysis,
	outputDir: string,
): Promise<TransformedRoute[]> {
	const transformedRoutes: TransformedRoute[] = [];
	const routesOutputDir = join(outputDir, 'src/routes');

	if (!existsSync(routesOutputDir)) {
		await mkdir(routesOutputDir, { recursive: true });
	}

	for (const route of analysis.routes) {
		try {
			const transformed = await transformRouteFile(route, analysis, routesOutputDir);
			transformedRoutes.push(transformed);
		} catch (error) {
			transformedRoutes.push({
				originalPath: route.filePath,
				outputPath: '',
				elysiaPath: route.elysiaPath,
				methods: route.handlers.map((h) => h.method),
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// Generate routes index file
	await generateRoutesIndex(transformedRoutes, routesOutputDir);

	return transformedRoutes;
}

/**
 * Transform a single Next.js route file to Elysia
 */
async function transformRouteFile(
	route: AnalyzedRoute,
	_analysis: NextJsProjectAnalysis,
	routesOutputDir: string,
): Promise<TransformedRoute> {
	// Read source file
	const sourceContent = await readFile(route.filePath, 'utf-8');

	// Create ts-morph project for transformation
	const project = new Project({
		manipulationSettings: {
			indentationText: IndentationText.TwoSpaces,
			newLineKind: NewLineKind.LineFeed,
			quoteKind: QuoteKind.Double,
			usePrefixAndSuffixTextForRename: false,
			useTrailingCommas: true,
		},
		useInMemoryFileSystem: true,
	});

	// Parse source file
	const sourceFile = project.createSourceFile('route.ts', sourceContent);

	// Create output file
	const outputProject = new Project({
		manipulationSettings: {
			indentationText: IndentationText.TwoSpaces,
			newLineKind: NewLineKind.LineFeed,
			quoteKind: QuoteKind.Double,
			usePrefixAndSuffixTextForRename: false,
			useTrailingCommas: true,
		},
	});

	// Determine output path
	const routeSegment = route.elysiaPath.replace(/^\//, '').replace(/\//g, '.');
	const outputFileName = routeSegment ? `${routeSegment}.ts` : 'index.ts';
	const outputPath = join(routesOutputDir, outputFileName);

	const outputFile = outputProject.createSourceFile(outputPath, '', { overwrite: true });

	// Add Elysia import
	outputFile.addImportDeclaration({
		moduleSpecifier: 'elysia',
		namedImports: ['Elysia', 't'],
	});

	// Copy over non-Next.js specific imports
	transformImports(sourceFile, outputFile);

	outputFile.addStatements('\n');

	// Create route name from path
	const routeName = createRouteName(route.elysiaPath);

	// Generate Elysia route plugin
	generateElysiaRoute(sourceFile, outputFile, route, routeName);

	await outputFile.save();

	return {
		originalPath: route.filePath,
		outputPath,
		elysiaPath: route.elysiaPath,
		methods: route.handlers.map((h) => h.method),
		success: true,
	};
}

/**
 * Transform imports from Next.js to Elysia compatible imports
 */
function transformImports(sourceFile: SourceFile, outputFile: SourceFile): void {
	const imports = sourceFile.getImportDeclarations();

	for (const imp of imports) {
		const moduleSpecifier = imp.getModuleSpecifierValue();

		// Skip Next.js specific imports
		if (
			moduleSpecifier.startsWith('next/') ||
			moduleSpecifier === 'next' ||
			moduleSpecifier === 'next/server'
		) {
			continue;
		}

		// Transform the import
		const namedImports = imp.getNamedImports().map((ni) => ({
			name: ni.getName(),
			alias: ni.getAliasNode()?.getText(),
		}));

		const defaultImport = imp.getDefaultImport()?.getText();
		const namespaceImport = imp.getNamespaceImport()?.getText();

		if (namedImports.length > 0 || defaultImport || namespaceImport) {
			outputFile.addImportDeclaration({
				moduleSpecifier,
				defaultImport,
				namespaceImport,
				namedImports: namedImports.length > 0 ? namedImports : undefined,
			});
		}
	}
}

/**
 * Generate Elysia route from Next.js route handlers
 */
function generateElysiaRoute(
	sourceFile: SourceFile,
	outputFile: SourceFile,
	route: AnalyzedRoute,
	routeName: string,
): void {
	// Extract handler functions from source
	const handlers = extractHandlers(sourceFile, route);

	// Build the Elysia chain
	const chainParts: string[] = [`new Elysia({ prefix: "${route.elysiaPath}" })`];

	for (const handler of handlers) {
		const method = handler.method.toLowerCase();
		const handlerCode = transformHandlerBody(handler.body);

		// Build method call
		const schemaParam = handler.hasBody ? ', { body: t.Any() }' : '';
		chainParts.push(`.${method}("/", async (ctx) => {${handlerCode}}${schemaParam})`);
	}

	// Add export
	outputFile.addVariableStatement({
		isExported: true,
		declarationKind: VariableDeclarationKind.Const,
		declarations: [
			{
				name: routeName,
				initializer: chainParts.join('\n  '),
			},
		],
	});
}

/**
 * Extract handler information from source file
 */
function extractHandlers(
	sourceFile: SourceFile,
	route: AnalyzedRoute,
): Array<{ method: string; body: string; hasBody: boolean }> {
	const handlers: Array<{ method: string; body: string; hasBody: boolean }> = [];

	for (const handlerInfo of route.handlers) {
		const method = handlerInfo.method;

		// Find the handler function
		let body = "return ctx.error(501, 'Not implemented');";
		let hasBody = false;

		// Check for exported function declaration
		const funcDecl = sourceFile.getFunction(method);
		if (funcDecl?.isExported()) {
			body = extractFunctionBody(funcDecl);
			hasBody = checkIfHandlerExpectsBody(funcDecl);
		} else {
			// Check for exported variable with arrow function
			const varDecl = sourceFile.getVariableDeclaration(method);
			if (varDecl) {
				const initializer = varDecl.getInitializer();
				if (initializer) {
					body = extractArrowFunctionBody(initializer.getText());
					hasBody =
						initializer.getText().includes('request.json()') ||
						initializer.getText().includes('req.body');
				}
			}
		}

		handlers.push({ method, body, hasBody });
	}

	return handlers;
}

/**
 * Extract body from function declaration
 */
function extractFunctionBody(func: FunctionDeclaration): string {
	const body = func.getBody();
	if (!body) return "return ctx.error(501, 'Not implemented');";

	// Get the body text without the braces
	const fullText = body.getText();
	return fullText.slice(1, -1).trim();
}

/**
 * Extract body from arrow function string
 */
function extractArrowFunctionBody(arrowText: string): string {
	// Find the arrow and extract what's after it
	const arrowIndex = arrowText.indexOf('=>');
	if (arrowIndex === -1) return "return ctx.error(501, 'Not implemented');";

	let body = arrowText.slice(arrowIndex + 2).trim();

	// If it's a block body, remove the braces
	if (body.startsWith('{') && body.endsWith('}')) {
		body = body.slice(1, -1).trim();
	} else {
		// Expression body - wrap in return
		body = `return ${body}`;
	}

	return body;
}

/**
 * Check if a handler expects a request body
 */
function checkIfHandlerExpectsBody(func: FunctionDeclaration): boolean {
	const bodyText = func.getBody()?.getText() || '';
	return (
		bodyText.includes('request.json()') ||
		bodyText.includes('req.json()') ||
		bodyText.includes('request.body') ||
		bodyText.includes('req.body')
	);
}

/**
 * Transform Next.js handler body to Elysia context
 */
function transformHandlerBody(body: string): string {
	let transformed = body;

	// First, remove any 'return' statements that come before NextResponse.json()
	// so we can transform them properly
	transformed = transformed.replace(/return\s+NextResponse\.json/g, 'NextResponse.json');

	// Transform NextResponse.json() to just returning the value
	transformed = transformed.replace(
		/NextResponse\.json\s*\(\s*([^,)]+)(?:,\s*\{[^}]*status:\s*(\d+)[^}]*\})?\s*\)/g,
		(_match, data, status) => {
			if (status && status !== '200') {
				return `ctx.set.status = ${status};\n    return ${data}`;
			}
			return `return ${data}`;
		},
	);

	// Transform Response.json()
	transformed = transformed.replace(
		/new Response\s*\(\s*JSON\.stringify\s*\(\s*([^)]+)\s*\)[^)]*\)/g,
		'return $1',
	);

	// Transform request.json() to ctx.body
	transformed = transformed.replace(/(?:await\s+)?(?:request|req)\.json\s*\(\s*\)/g, 'ctx.body');

	// Transform request.url to ctx.request.url
	transformed = transformed.replace(/(?:request|req)\.url/g, 'ctx.request.url');

	// Transform request.headers to ctx.headers
	transformed = transformed.replace(
		/(?:request|req)\.headers\.get\s*\(\s*(['"`][^'"`]+['"`])\s*\)/g,
		'ctx.headers[$1]',
	);

	// Transform params access
	transformed = transformed.replace(/params\.(\w+)/g, 'ctx.params.$1');

	// Transform query/searchParams access
	transformed = transformed.replace(
		/searchParams\.get\s*\(\s*(['"`][^'"`]+['"`])\s*\)/g,
		'ctx.query[$1]',
	);

	return `\n    ${transformed.split('\n').join('\n    ')}\n  `;
}

/**
 * Create a valid route name from path
 */
function createRouteName(routePath: string): string {
	if (routePath === '/' || routePath === '') {
		return 'indexRoute';
	}

	return `${routePath
		.replace(/^\//, '')
		.replace(/\//g, '_')
		.replace(/\[([^\]]+)\]/g, '$1')
		.replace(/[^a-zA-Z0-9_]/g, '')
		.replace(/^(\d)/, '_$1')}Route`;
}

/**
 * Generate index file that exports all routes
 */
async function generateRoutesIndex(routes: TransformedRoute[], routesDir: string): Promise<void> {
	const project = new Project({
		manipulationSettings: {
			indentationText: IndentationText.TwoSpaces,
			newLineKind: NewLineKind.LineFeed,
			quoteKind: QuoteKind.Double,
			usePrefixAndSuffixTextForRename: false,
			useTrailingCommas: true,
		},
	});

	const indexPath = join(routesDir, 'index.ts');
	const indexFile = project.createSourceFile(indexPath, '', { overwrite: true });

	// Add Elysia import
	indexFile.addImportDeclaration({
		moduleSpecifier: 'elysia',
		namedImports: ['Elysia'],
	});

	// Add imports for each route
	const successfulRoutes = routes.filter((r) => r.success);
	for (const route of successfulRoutes) {
		const routeName = createRouteName(route.elysiaPath);
		const relativePath = `./${basename(route.outputPath, '.ts')}`;

		indexFile.addImportDeclaration({
			moduleSpecifier: relativePath,
			namedImports: [routeName],
		});
	}

	indexFile.addStatements('\n');

	// Create combined routes plugin
	let routeChain = 'new Elysia()';
	for (const route of successfulRoutes) {
		const routeName = createRouteName(route.elysiaPath);
		routeChain += `\n  .use(${routeName})`;
	}

	indexFile.addVariableStatement({
		isExported: true,
		declarationKind: VariableDeclarationKind.Const,
		declarations: [
			{
				name: 'routes',
				initializer: routeChain,
			},
		],
	});

	await indexFile.save();
}
