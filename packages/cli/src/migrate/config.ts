import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	IndentationText,
	NewLineKind,
	Project,
	QuoteKind,
	type SourceFile,
	SyntaxKind,
	VariableDeclarationKind,
} from 'ts-morph';
import type { NextJsProjectAnalysis } from './types.js';

/**
 * Config transformation result
 */
export interface ConfigTransformResult {
	success: boolean;
	outputPath?: string;
	hasRedirects: boolean;
	hasRewrites: boolean;
	hasHeaders: boolean;
	error?: string;
}

/**
 * Transform next.config to Elysia middleware
 */
export async function transformConfig(
	analysis: NextJsProjectAnalysis,
	outputDir: string,
): Promise<ConfigTransformResult> {
	if (!analysis.hasNextConfig || !analysis.nextConfigPath) {
		return {
			success: true,
			hasRedirects: false,
			hasRewrites: false,
			hasHeaders: false,
		};
	}

	const configPath = join(analysis.root, analysis.nextConfigPath);

	if (!existsSync(configPath)) {
		return {
			success: false,
			hasRedirects: false,
			hasRewrites: false,
			hasHeaders: false,
			error: `Config file not found: ${configPath}`,
		};
	}

	try {
		// Read the config file
		const configContent = await readFile(configPath, 'utf-8');

		// Parse config and extract relevant parts
		const extracted = await extractConfigFeatures(configContent);

		if (!extracted.hasAny) {
			return {
				success: true,
				hasRedirects: false,
				hasRewrites: false,
				hasHeaders: false,
			};
		}

		// Generate Elysia middleware
		const middlewareDir = join(outputDir, 'src/middleware');
		if (!existsSync(middlewareDir)) {
			await mkdir(middlewareDir, { recursive: true });
		}

		const outputPath = join(middlewareDir, 'config.ts');
		await generateConfigMiddleware(outputPath, extracted);

		return {
			success: true,
			outputPath,
			hasRedirects: extracted.redirects.length > 0,
			hasRewrites: extracted.rewrites.length > 0,
			hasHeaders: extracted.headers.length > 0,
		};
	} catch (error) {
		return {
			success: false,
			hasRedirects: false,
			hasRewrites: false,
			hasHeaders: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Extracted config features
 */
interface ExtractedConfig {
	hasAny: boolean;
	redirects: Array<{
		source: string;
		destination: string;
		permanent: boolean;
	}>;
	rewrites: Array<{
		source: string;
		destination: string;
	}>;
	headers: Array<{
		source: string;
		headers: Array<{ key: string; value: string }>;
	}>;
}

/**
 * Extract config features from next.config content
 */
async function extractConfigFeatures(content: string): Promise<ExtractedConfig> {
	const project = new Project({
		manipulationSettings: {
			indentationText: IndentationText.TwoSpaces,
			newLineKind: NewLineKind.LineFeed,
			quoteKind: QuoteKind.Double,
		},
		useInMemoryFileSystem: true,
	});

	const sourceFile = project.createSourceFile('next.config.ts', content);

	const redirects: ExtractedConfig['redirects'] = [];
	const rewrites: ExtractedConfig['rewrites'] = [];
	const headers: ExtractedConfig['headers'] = [];

	// Find the config object
	// Could be: export default { ... }, module.exports = { ... }, const config = { ... }

	// Look for object literal expressions
	const objectLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);

	for (const obj of objectLiterals) {
		// Check for redirects property
		const redirectsProp = obj.getProperty('redirects');
		if (redirectsProp) {
			const extracted = extractRedirects(redirectsProp.getText());
			redirects.push(...extracted);
		}

		// Check for rewrites property
		const rewritesProp = obj.getProperty('rewrites');
		if (rewritesProp) {
			const extracted = extractRewrites(rewritesProp.getText());
			rewrites.push(...extracted);
		}

		// Check for headers property
		const headersProp = obj.getProperty('headers');
		if (headersProp) {
			const extracted = extractHeaders(headersProp.getText());
			headers.push(...extracted);
		}
	}

	return {
		hasAny: redirects.length > 0 || rewrites.length > 0 || headers.length > 0,
		redirects,
		rewrites,
		headers,
	};
}

/**
 * Extract redirects from property text
 */
function extractRedirects(propText: string): ExtractedConfig['redirects'] {
	const redirects: ExtractedConfig['redirects'] = [];

	// Match redirect objects in the array
	const redirectPattern =
		/\{\s*source:\s*['"`]([^'"`]+)['"`]\s*,\s*destination:\s*['"`]([^'"`]+)['"`]\s*,\s*permanent:\s*(true|false)/g;

	for (const match of propText.matchAll(redirectPattern)) {
		if (match[1] && match[2] && match[3]) {
			redirects.push({
				source: match[1],
				destination: match[2],
				permanent: match[3] === 'true',
			});
		}
	}

	return redirects;
}

/**
 * Extract rewrites from property text
 */
function extractRewrites(propText: string): ExtractedConfig['rewrites'] {
	const rewrites: ExtractedConfig['rewrites'] = [];

	// Match rewrite objects
	const rewritePattern =
		/\{\s*source:\s*['"`]([^'"`]+)['"`]\s*,\s*destination:\s*['"`]([^'"`]+)['"`]/g;

	for (const match of propText.matchAll(rewritePattern)) {
		if (match[1] && match[2]) {
			rewrites.push({
				source: match[1],
				destination: match[2],
			});
		}
	}

	return rewrites;
}

/**
 * Extract headers from property text
 */
function extractHeaders(propText: string): ExtractedConfig['headers'] {
	const headers: ExtractedConfig['headers'] = [];

	// This is more complex due to nested structure
	// Match header config objects
	const headerConfigPattern = /\{\s*source:\s*['"`]([^'"`]+)['"`]\s*,\s*headers:\s*\[([^\]]+)\]/g;

	for (const match of propText.matchAll(headerConfigPattern)) {
		const source = match[1];
		const headersArrayText = match[2];

		if (!source || !headersArrayText) continue;

		// Extract individual header objects
		const headerItems: Array<{ key: string; value: string }> = [];
		const headerPattern =
			/\{\s*key:\s*['"`]([^'"`]+)['"`]\s*,\s*value:\s*['"`]([^'"`]+)['"`]\s*\}/g;

		for (const headerMatch of headersArrayText.matchAll(headerPattern)) {
			if (headerMatch[1] && headerMatch[2]) {
				headerItems.push({
					key: headerMatch[1],
					value: headerMatch[2],
				});
			}
		}

		if (headerItems.length > 0) {
			headers.push({
				source,
				headers: headerItems,
			});
		}
	}

	return headers;
}

/**
 * Generate config middleware file using ts-morph
 */
async function generateConfigMiddleware(
	outputPath: string,
	config: ExtractedConfig,
): Promise<void> {
	const project = new Project({
		manipulationSettings: {
			indentationText: IndentationText.TwoSpaces,
			newLineKind: NewLineKind.LineFeed,
			quoteKind: QuoteKind.Double,
			usePrefixAndSuffixTextForRename: false,
			useTrailingCommas: true,
		},
	});

	const sourceFile = project.createSourceFile(outputPath, '', { overwrite: true });

	// Add header comment
	sourceFile.addStatements(
		'/**\n * Configuration middleware\n * \n * Generated from next.config - handles redirects, rewrites, and headers.\n */\n',
	);

	// Add import
	sourceFile.addImportDeclaration({
		moduleSpecifier: 'elysia',
		namedImports: ['Elysia'],
	});

	sourceFile.addStatements('\n');

	// Add redirects if present
	if (config.redirects.length > 0) {
		addRedirectsArray(sourceFile, config.redirects);
		sourceFile.addStatements('\n');
	}

	// Add rewrites if present
	if (config.rewrites.length > 0) {
		addRewritesArray(sourceFile, config.rewrites);
		sourceFile.addStatements('\n');
	}

	// Add headers if present
	if (config.headers.length > 0) {
		addHeadersArray(sourceFile, config.headers);
		sourceFile.addStatements('\n');
	}

	// Add the middleware export
	addConfigMiddleware(sourceFile, config);

	await sourceFile.save();
}

/**
 * Add redirects array to source file
 */
function addRedirectsArray(sourceFile: SourceFile, redirects: ExtractedConfig['redirects']): void {
	const arrayItems = redirects
		.map(
			(r) =>
				`{ source: "${r.source}", destination: "${r.destination}", permanent: ${r.permanent} }`,
		)
		.join(',\n  ');

	sourceFile.addVariableStatement({
		declarationKind: VariableDeclarationKind.Const,
		declarations: [
			{
				name: 'redirects',
				initializer: `[\n  ${arrayItems}\n]`,
			},
		],
	});
}

/**
 * Add rewrites array to source file
 */
function addRewritesArray(sourceFile: SourceFile, rewrites: ExtractedConfig['rewrites']): void {
	const arrayItems = rewrites
		.map((r) => `{ source: "${r.source}", destination: "${r.destination}" }`)
		.join(',\n  ');

	sourceFile.addVariableStatement({
		declarationKind: VariableDeclarationKind.Const,
		declarations: [
			{
				name: 'rewrites',
				initializer: `[\n  ${arrayItems}\n]`,
			},
		],
	});
}

/**
 * Add headers array to source file
 */
function addHeadersArray(sourceFile: SourceFile, headers: ExtractedConfig['headers']): void {
	const arrayItems = headers
		.map((h) => {
			const headersStr = h.headers
				.map((hh) => `{ key: "${hh.key}", value: "${hh.value}" }`)
				.join(', ');
			return `{ source: "${h.source}", headers: [${headersStr}] }`;
		})
		.join(',\n  ');

	sourceFile.addVariableStatement({
		declarationKind: VariableDeclarationKind.Const,
		declarations: [
			{
				name: 'headers',
				initializer: `[\n  ${arrayItems}\n]`,
			},
		],
	});
}

/**
 * Add config middleware export
 */
function addConfigMiddleware(sourceFile: SourceFile, config: ExtractedConfig): void {
	let middlewareChain = `new Elysia({ name: "config" })`;

	// Add redirect handling
	if (config.redirects.length > 0) {
		middlewareChain += `
  .onBeforeHandle(({ request, set }) => {
    const url = new URL(request.url);
    for (const redirect of redirects) {
      if (url.pathname === redirect.source || url.pathname.match(redirect.source)) {
        set.redirect = redirect.destination;
        set.status = redirect.permanent ? 308 : 307;
        return;
      }
    }
  })`;
	}

	// Add rewrite handling (this is simplified - full implementation would need proxy)
	if (config.rewrites.length > 0) {
		middlewareChain += `
  .onBeforeHandle(({ request }) => {
    const url = new URL(request.url);
    for (const rewrite of rewrites) {
      if (url.pathname === rewrite.source || url.pathname.match(rewrite.source)) {
        // Note: Full rewrite support may require additional proxy configuration
        console.log(\`Rewrite: \${rewrite.source} -> \${rewrite.destination}\`);
      }
    }
  })`;
	}

	// Add headers handling
	if (config.headers.length > 0) {
		middlewareChain += `
  .onAfterHandle(({ request, set }) => {
    const url = new URL(request.url);
    for (const headerConfig of headers) {
      if (url.pathname === headerConfig.source || url.pathname.match(headerConfig.source)) {
        for (const header of headerConfig.headers) {
          set.headers[header.key] = header.value;
        }
      }
    }
  })`;
	}

	sourceFile.addVariableStatement({
		isExported: true,
		declarationKind: VariableDeclarationKind.Const,
		declarations: [
			{
				name: 'configMiddleware',
				initializer: middlewareChain,
			},
		],
	});
}

/**
 * Generate a simple config middleware when no features are detected
 * but we still want a placeholder
 */
export async function generatePlaceholderConfig(outputDir: string): Promise<void> {
	const project = new Project({
		manipulationSettings: {
			indentationText: IndentationText.TwoSpaces,
			newLineKind: NewLineKind.LineFeed,
			quoteKind: QuoteKind.Double,
			usePrefixAndSuffixTextForRename: false,
			useTrailingCommas: true,
		},
	});

	const middlewareDir = join(outputDir, 'src/middleware');
	if (!existsSync(middlewareDir)) {
		await mkdir(middlewareDir, { recursive: true });
	}

	const filePath = join(middlewareDir, 'config.ts');
	const sourceFile = project.createSourceFile(filePath, '', { overwrite: true });

	// Add comment
	sourceFile.addStatements(
		'/**\n * Configuration middleware\n * \n * Add redirects, rewrites, and headers here.\n */\n',
	);

	// Add import
	sourceFile.addImportDeclaration({
		moduleSpecifier: 'elysia',
		namedImports: ['Elysia'],
	});

	sourceFile.addStatements('\n');

	// Add placeholder export
	sourceFile.addVariableStatement({
		isExported: true,
		declarationKind: VariableDeclarationKind.Const,
		declarations: [
			{
				name: 'configMiddleware',
				initializer: "new Elysia({ name: 'config' })",
			},
		],
	});

	await sourceFile.save();
}
