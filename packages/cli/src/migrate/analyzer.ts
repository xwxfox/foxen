import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { type AnalyzerOptions, analyzeRoutes } from '@foxen/compiler';
import type { NextJsProjectAnalysis } from './types.js';

/**
 * Possible routes directory locations in Next.js projects
 */
const ROUTES_DIR_CANDIDATES = ['src/app/api', 'app/api', 'src/pages/api', 'pages/api'];

/**
 * Possible middleware file locations
 */
const MIDDLEWARE_CANDIDATES = [
	'middleware.ts',
	'middleware.js',
	'src/middleware.ts',
	'src/middleware.js',
];

/**
 * Possible next.config file names
 */
const CONFIG_CANDIDATES = [
	'next.config.ts',
	'next.config.mts',
	'next.config.js',
	'next.config.mjs',
];

/**
 * Analyze a Next.js project for migration
 */
export async function analyzeNextJsProject(projectPath: string): Promise<NextJsProjectAnalysis> {
	const root = resolve(projectPath);

	// Validate project exists
	if (!existsSync(root)) {
		throw new Error(`Project directory does not exist: ${root}`);
	}

	// Load package.json
	const packageJsonPath = join(root, 'package.json');
	if (!existsSync(packageJsonPath)) {
		throw new Error(`No package.json found in: ${root}`);
	}

	const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

	// Detect routes directory
	const routesDir = await detectRoutesDirectory(root);
	if (!routesDir) {
		throw new Error(
			'Could not find API routes directory (app/api, src/app/api, pages/api, or src/pages/api)',
		);
	}

	// Detect middleware
	const middlewarePath = await detectMiddleware(root);

	// Detect next.config
	const nextConfigPath = await detectNextConfig(root);

	// Analyze routes using the compiler
	const analyzerOptions: AnalyzerOptions = {
		rootDir: join(root, routesDir),
		includePatterns: ['**/route.{ts,tsx,js,jsx}'],
		excludePatterns: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
	};

	const analysisResult = await analyzeRoutes(analyzerOptions);

	// Check for config features
	const configFeatures = nextConfigPath
		? await analyzeNextConfigFeatures(join(root, nextConfigPath))
		: { usesRedirects: false, usesRewrites: false, usesHeaders: false };

	return {
		root,
		name: packageJson.name || basename(root),
		version: packageJson.version,
		routesDir,
		hasMiddleware: !!middlewarePath,
		middlewarePath,
		hasNextConfig: !!nextConfigPath,
		nextConfigPath,
		routes: analysisResult.routes,
		dependencies: Object.keys(packageJson.dependencies || {}),
		devDependencies: Object.keys(packageJson.devDependencies || {}),
		...configFeatures,
	};
}

/**
 * Detect the routes directory in a Next.js project
 */
async function detectRoutesDirectory(root: string): Promise<string | null> {
	for (const candidate of ROUTES_DIR_CANDIDATES) {
		const fullPath = join(root, candidate);
		if (existsSync(fullPath)) {
			return candidate;
		}
	}
	return null;
}

/**
 * Detect middleware file in a Next.js project
 */
async function detectMiddleware(root: string): Promise<string | undefined> {
	for (const candidate of MIDDLEWARE_CANDIDATES) {
		const fullPath = join(root, candidate);
		if (existsSync(fullPath)) {
			return candidate;
		}
	}
	return undefined;
}

/**
 * Detect next.config file in a Next.js project
 */
async function detectNextConfig(root: string): Promise<string | undefined> {
	for (const candidate of CONFIG_CANDIDATES) {
		const fullPath = join(root, candidate);
		if (existsSync(fullPath)) {
			return candidate;
		}
	}
	return undefined;
}

/**
 * Analyze next.config for feature usage
 */
async function analyzeNextConfigFeatures(configPath: string): Promise<{
	usesRedirects: boolean;
	usesRewrites: boolean;
	usesHeaders: boolean;
}> {
	if (!existsSync(configPath)) {
		return { usesRedirects: false, usesRewrites: false, usesHeaders: false };
	}

	const content = await readFile(configPath, 'utf-8');

	return {
		usesRedirects:
			content.includes('redirects') &&
			(content.includes('async redirects') || content.includes('redirects:')),
		usesRewrites:
			content.includes('rewrites') &&
			(content.includes('async rewrites') || content.includes('rewrites:')),
		usesHeaders:
			content.includes('headers') &&
			(content.includes('async headers') || content.includes('headers:')),
	};
}

/**
 * Get a summary of the analyzed project
 */
export function getProjectSummary(analysis: NextJsProjectAnalysis): string {
	const lines: string[] = [
		`Project: ${analysis.name}${analysis.version ? ` v${analysis.version}` : ''}`,
		`Root: ${analysis.root}`,
		`Routes directory: ${analysis.routesDir}`,
		`Routes found: ${analysis.routes.length}`,
	];

	if (analysis.hasMiddleware) {
		lines.push(`Middleware: ${analysis.middlewarePath}`);
	}

	if (analysis.hasNextConfig) {
		lines.push(`Config: ${analysis.nextConfigPath}`);
		const features: string[] = [];
		if (analysis.usesRedirects) features.push('redirects');
		if (analysis.usesRewrites) features.push('rewrites');
		if (analysis.usesHeaders) features.push('headers');
		if (features.length > 0) {
			lines.push(`Config features: ${features.join(', ')}`);
		}
	}

	lines.push(`Dependencies: ${analysis.dependencies.length}`);

	return lines.join('\n');
}
