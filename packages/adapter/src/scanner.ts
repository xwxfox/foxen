import { readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import type { HttpMethod } from '@foxen/core';
import type { ParamInfo, RouteInfo } from './types.ts';

// ============================================
// Path Segment Analysis
// ============================================

/** Checks if a path segment is a dynamic segment [param] */
function isDynamicSegment(segment: string): boolean {
	return segment.startsWith('[') && segment.endsWith(']');
}

/** Checks if a path segment is a catch-all segment [...param] */
function isCatchAllSegment(segment: string): boolean {
	return segment.startsWith('[...') && segment.endsWith(']');
}

/** Checks if a path segment is an optional catch-all segment [[...param]] */
function isOptionalCatchAllSegment(segment: string): boolean {
	return segment.startsWith('[[...') && segment.endsWith(']]');
}

/** Extracts parameter name from a dynamic segment */
function extractParamName(segment: string): string {
	if (isOptionalCatchAllSegment(segment)) {
		// [[...slug]] -> slug
		return segment.slice(5, -2);
	}
	if (isCatchAllSegment(segment)) {
		// [...slug] -> slug
		return segment.slice(4, -1);
	}
	// [id] -> id
	return segment.slice(1, -1);
}

// ============================================
// Path Conversion
// ============================================

/**
 * Converts Next.js path to Elysia path format.
 *
 * @example
 * /users/[id] -> /users/:id
 * /docs/[...slug] -> /docs/*
 * /products/[[...categories]] -> /products/*
 */
export function convertPathToElysia(nextPath: string): { elysiaPath: string; params: ParamInfo[] } {
	const params: ParamInfo[] = [];

	const segments = nextPath.split('/').map((segment) => {
		if (isOptionalCatchAllSegment(segment)) {
			const name = extractParamName(segment);
			params.push({ name, isCatchAll: true, isOptional: true });
			return '*';
		}

		if (isCatchAllSegment(segment)) {
			const name = extractParamName(segment);
			params.push({ name, isCatchAll: true, isOptional: false });
			return '*';
		}

		if (isDynamicSegment(segment)) {
			const name = extractParamName(segment);
			params.push({ name, isCatchAll: false, isOptional: false });
			return `:${name}`;
		}

		return segment;
	});

	return {
		elysiaPath: segments.join('/'),
		params,
	};
}

// ============================================
// Method Extraction
// ============================================

const SUPPORTED_METHODS: HttpMethod[] = [
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'HEAD',
	'OPTIONS',
];

/**
 * Gets HTTP methods exported from a route module by loading it.
 */
export async function getRouteMethods(filePath: string): Promise<HttpMethod[]> {
	const methods: HttpMethod[] = [];

	try {
		const module = await import(filePath);

		for (const method of SUPPORTED_METHODS) {
			if (typeof module[method] === 'function') {
				methods.push(method);
			}
		}
	} catch (error) {
		console.error(`Error loading module ${filePath}:`, error);
	}

	return methods;
}

/**
 * Extracts exported method names using regex (faster, no module loading).
 */
export async function extractExportedMethods(filePath: string): Promise<HttpMethod[]> {
	const methods: HttpMethod[] = [];

	try {
		const content = await Bun.file(filePath).text();

		for (const method of SUPPORTED_METHODS) {
			// Match various export patterns
			const patterns = [
				new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`),
				new RegExp(`export\\s+const\\s+${method}\\s*=`),
				new RegExp(`export\\s+\\{[^}]*\\b${method}\\b[^}]*\\}`),
			];

			if (patterns.some((pattern) => pattern.test(content))) {
				methods.push(method);
			}
		}
	} catch (error) {
		console.error(`Error reading file ${filePath}:`, error);
	}

	return methods;
}

// ============================================
// Directory Scanning
// ============================================

/**
 * Recursively scans a directory for route.ts files.
 */
export async function scanDirectory(
	baseDir: string,
	currentDir: string = baseDir,
	routes: RouteInfo[] = [],
): Promise<RouteInfo[]> {
	const entries = await readdir(currentDir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(currentDir, entry.name);

		if (entry.isDirectory()) {
			// Recursively scan subdirectories
			await scanDirectory(baseDir, fullPath, routes);
		} else if (entry.name === 'route.ts' || entry.name === 'route.js') {
			// Found a route file
			const relativePath = relative(baseDir, dirname(fullPath));
			const nextPath = `/${relativePath.replace(/\\/g, '/')}`;

			const { elysiaPath, params } = convertPathToElysia(nextPath);

			// Get methods exported from the route file
			const methods = await getRouteMethods(fullPath);

			if (methods.length > 0) {
				routes.push({
					filePath: fullPath,
					nextPath,
					elysiaPath,
					methods,
					params,
					isCatchAll: params.some((p) => p.isCatchAll && !p.isOptional),
					isOptionalCatchAll: params.some((p) => p.isCatchAll && p.isOptional),
				});
			}
		}
	}

	return routes;
}

/**
 * Scans directory structure without loading modules (for code generation).
 */
export async function scanDirectoryStructure(
	baseDir: string,
	currentDir: string = baseDir,
): Promise<
	Array<{
		filePath: string;
		relativePath: string;
		nextPath: string;
		elysiaPath: string;
		params: ParamInfo[];
	}>
> {
	const routes: Array<{
		filePath: string;
		relativePath: string;
		nextPath: string;
		elysiaPath: string;
		params: ParamInfo[];
	}> = [];

	try {
		const entries = await readdir(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(currentDir, entry.name);

			if (entry.isDirectory()) {
				const subRoutes = await scanDirectoryStructure(baseDir, fullPath);
				routes.push(...subRoutes);
			} else if (entry.name === 'route.ts' || entry.name === 'route.js') {
				const relativePath = relative(baseDir, fullPath);
				const dirPath = relative(baseDir, dirname(fullPath));
				const nextPath = dirPath ? `/${dirPath.replace(/\\/g, '/')}` : '/';

				const { elysiaPath, params } = convertPathToElysia(nextPath);

				routes.push({
					filePath: fullPath,
					relativePath,
					nextPath,
					elysiaPath: elysiaPath || '/',
					params,
				});
			}
		}
	} catch (error) {
		console.error(`Error scanning directory ${currentDir}:`, error);
	}

	return routes;
}

/**
 * Handler signature information.
 */
export interface HandlerSignature {
	method: HttpMethod;
	/** 0 = no args, 1 = request only, 2 = request + context */
	argCount: 0 | 1 | 2;
	/** Whether the handler uses params */
	hasParams: boolean;
}

/**
 * Extract handler signatures from a route file.
 */
export async function extractHandlerSignatures(
	filePath: string,
): Promise<Map<HttpMethod, HandlerSignature>> {
	const signatures = new Map<HttpMethod, HandlerSignature>();

	try {
		const content = await Bun.file(filePath).text();

		for (const method of SUPPORTED_METHODS) {
			const funcPattern = new RegExp(
				`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(([^)]*)\\)`,
				'g',
			);

			const match = funcPattern.exec(content);
			if (match) {
				const argsStr = match[1]?.trim() || '';

				let argCount: 0 | 1 | 2 = 0;
				let hasParams = false;

				if (argsStr === '') {
					argCount = 0;
				} else if (argsStr.includes(',') || argsStr.includes('{')) {
					argCount = 2;
					hasParams = argsStr.includes('params');
				} else {
					argCount = 1;
				}

				signatures.set(method, { method, argCount, hasParams });
			}
		}
	} catch (error) {
		console.error(`Error analyzing file ${filePath}:`, error);
	}

	return signatures;
}
