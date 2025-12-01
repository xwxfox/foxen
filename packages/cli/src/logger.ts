import type { FoxenError } from '@foxen/core';
import pc from 'picocolors';

// ============================================================================
// Logger Types
// ============================================================================

export interface Logger {
	info: (message: string, ...args: unknown[]) => void;
	success: (message: string, ...args: unknown[]) => void;
	warn: (message: string, ...args: unknown[]) => void;
	error: (message: string, ...args: unknown[]) => void;
	debug: (message: string, ...args: unknown[]) => void;
	log: (message: string, ...args: unknown[]) => void;
}

export interface RouteInfo {
	path: string;
	methods: string[];
	file: string;
}

export interface MiddlewareInfo {
	enabled: boolean;
	matcherCount: number;
}

export interface ConfigInfo {
	redirectCount: number;
	rewriteCount: number;
	headerRuleCount: number;
}

// ============================================================================
// Logger Creation
// ============================================================================

/**
 * Create a logger instance with optional prefix and verbose mode
 */
export function createLogger(verbose = false, prefix?: string): Logger {
	const _prefixStr = prefix ? `[foxen:${prefix}]` : '[foxen]';

	return {
		info: (message: string, ...args: unknown[]) => {
			console.log(`${pc.blue('i')} ${message}`, ...args);
		},

		success: (message: string, ...args: unknown[]) => {
			console.log(`${pc.green('+')} ${message}`, ...args);
		},

		warn: (message: string, ...args: unknown[]) => {
			console.log(`${pc.yellow('!')} ${pc.yellow(message)}`, ...args);
		},

		error: (message: string, ...args: unknown[]) => {
			console.error(`${pc.red('x')} ${pc.red(message)}`, ...args);
		},

		debug: (message: string, ...args: unknown[]) => {
			if (verbose) {
				console.log(`${pc.gray('-')} ${pc.gray(message)}`, ...args);
			}
		},

		log: (message: string, ...args: unknown[]) => {
			console.log(message, ...args);
		},
	};
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format duration in ms
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${ms.toFixed(0)}ms`;
	}
	return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format file size
 */
export function formatSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes}B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)}KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Color an HTTP method
 */
export function colorMethod(method: string): string {
	switch (method.toUpperCase()) {
		case 'GET':
			return pc.green(method);
		case 'POST':
			return pc.blue(method);
		case 'PUT':
			return pc.yellow(method);
		case 'DELETE':
			return pc.red(method);
		case 'PATCH':
			return pc.cyan(method);
		case 'HEAD':
			return pc.magenta(method);
		case 'OPTIONS':
			return pc.gray(method);
		default:
			return method;
	}
}

/**
 * Format a path with dynamic segments highlighted
 */
export function formatPath(path: string): string {
	// Highlight dynamic segments like :id, *
	return path.replace(/:(\w+)/g, pc.dim(':$1')).replace(/\*/g, pc.dim('*'));
}

// ============================================================================
// Banner and Tables
// ============================================================================

/**
 * Print banner
 */
export function printBanner(): void {
	console.log();
	console.log(pc.bold(pc.cyan('  foxen')));
	console.log(pc.gray('  Next.js App Router → Elysia'));
	console.log();
}

/**
 * Print help for a command
 */
export function printCommandHelp(
	command: string,
	description: string,
	options: Array<{ flag: string; description: string; default?: string }>,
): void {
	console.log();
	console.log(pc.bold(`  ${command}`));
	console.log(`  ${pc.gray(description)}`);
	console.log();
	console.log(pc.bold('  Options:'));

	for (const opt of options) {
		const defaultStr = opt.default ? pc.gray(` (default: ${opt.default})`) : '';
		console.log(`    ${pc.cyan(opt.flag.padEnd(20))} ${opt.description}${defaultStr}`);
	}

	console.log();
}

/**
 * Print route table with colors
 */
export function printRouteTable(routes: RouteInfo[]): void {
	if (routes.length === 0) {
		console.log(pc.yellow('\n  No routes found\n'));
		return;
	}

	console.log();
	console.log(pc.bold('  Generated Routes:'));
	console.log();

	const maxPathLen = Math.max(...routes.map((r) => r.path.length), 10);
	const maxMethodLen = Math.max(...routes.map((r) => r.methods.join(', ').length), 7);

	// Header
	const header = `  ${pc.gray('PATH'.padEnd(maxPathLen))}  ${pc.gray('METHODS'.padEnd(maxMethodLen))}  ${pc.gray('FILE')}`;
	console.log(header);

	// Separator with box drawing characters
	const separator = `  ${pc.gray('─'.repeat(maxPathLen + maxMethodLen + 30))}`;
	console.log(separator);

	// Rows
	for (const route of routes) {
		const coloredMethods = route.methods.map(colorMethod).join(pc.gray(', '));
		const _formattedPath = formatPath(route.path);
		console.log(
			`  ${pc.cyan(route.path.padEnd(maxPathLen))}  ${coloredMethods.padEnd(maxMethodLen + 10)}  ${pc.gray(route.file)}`,
		);
	}

	console.log();
}

/**
 * Print a nice box table (for route visualization)
 */
export function printBoxTable(routes: RouteInfo[]): void {
	if (routes.length === 0) {
		console.log(pc.yellow('\n  No routes found\n'));
		return;
	}

	// Calculate column widths
	const methodWidth = 8;
	const pathWidth = Math.max(...routes.map((r) => r.path.length), 20) + 2;
	const fileWidth = Math.max(...routes.map((r) => r.file.length), 15) + 2;

	// Box characters
	const box = {
		tl: '┌',
		tr: '┐',
		bl: '└',
		br: '┘',
		h: '─',
		v: '│',
		ml: '├',
		mr: '┤',
		mt: '┬',
		mb: '┴',
		x: '┼',
	};

	// Top border
	console.log();
	console.log(
		pc.gray(
			`  ${box.tl}${box.h.repeat(methodWidth)}${box.mt}${box.h.repeat(pathWidth)}${box.mt}${box.h.repeat(fileWidth)}${box.tr}`,
		),
	);

	// Header row
	console.log(
		pc.gray(`  ${box.v}`) +
			pc.bold(' Method '.padEnd(methodWidth)) +
			pc.gray(box.v) +
			pc.bold(' Path'.padEnd(pathWidth)) +
			pc.gray(box.v) +
			pc.bold(' Handler'.padEnd(fileWidth)) +
			pc.gray(box.v),
	);

	// Header separator
	console.log(
		pc.gray(
			`  ${box.ml}${box.h.repeat(methodWidth)}${box.x}${box.h.repeat(pathWidth)}${box.x}${box.h.repeat(fileWidth)}${box.mr}`,
		),
	);

	// Group routes by path for better display
	const groupedRoutes = new Map<string, RouteInfo>();
	for (const route of routes) {
		const key = `${route.path}|${route.file}`;
		const existing = groupedRoutes.get(key);
		if (existing) {
			// Combine methods for same path
			const allMethods = new Set([...existing.methods, ...route.methods]);
			existing.methods = Array.from(allMethods);
		} else {
			groupedRoutes.set(key, { ...route });
		}
	}

	// Data rows - one row per method
	for (const route of groupedRoutes.values()) {
		for (const [i, method] of route.methods.entries()) {
			const coloredMethod = ` ${colorMethod(method.padEnd(methodWidth - 2))} `;
			const pathStr = i === 0 ? ` ${formatPath(route.path)}` : '';
			const fileStr = i === 0 ? ` ${route.file}` : '';

			console.log(
				pc.gray(`  ${box.v}`) +
					coloredMethod +
					pc.gray(box.v) +
					pc.cyan(pathStr.padEnd(pathWidth)) +
					pc.gray(box.v) +
					pc.dim(fileStr.padEnd(fileWidth)) +
					pc.gray(box.v),
			);
		}
	}

	// Bottom border
	console.log(
		pc.gray(
			`  ${box.bl}${box.h.repeat(methodWidth)}${box.mb}${box.h.repeat(pathWidth)}${box.mb}${box.h.repeat(fileWidth)}${box.br}`,
		),
	);
	console.log();
}

/**
 * Print middleware and config status
 */
export function printStatus(middleware?: MiddlewareInfo, config?: ConfigInfo): void {
	const items: string[] = [];

	if (middleware) {
		const status = middleware.enabled ? pc.green('+ Enabled') : pc.gray('- Disabled');
		const matchers = middleware.matcherCount > 0 ? ` (${middleware.matcherCount} matchers)` : '';
		items.push(`Middleware: ${status}${matchers}`);
	}

	if (config) {
		const parts: string[] = [];
		if (config.redirectCount > 0) parts.push(`${config.redirectCount} redirects`);
		if (config.rewriteCount > 0) parts.push(`${config.rewriteCount} rewrites`);
		if (config.headerRuleCount > 0) parts.push(`${config.headerRuleCount} header rules`);

		if (parts.length > 0) {
			items.push(`Config: ${pc.green('+')} ${parts.join(', ')}`);
		} else {
			items.push(`Config: ${pc.gray('-')} No rules defined`);
		}
	}

	if (items.length > 0) {
		console.log();
		for (const item of items) {
			console.log(`  ${item}`);
		}
		console.log();
	}
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format a FoxenError for CLI display
 */
export function formatFoxenError(error: FoxenError): string {
	const lines: string[] = [];

	// Main error message
	lines.push(pc.red(`Error: ${error.message}`));
	lines.push(pc.dim(`   Code: ${error.code}`));
	lines.push(pc.dim(`   Phase: ${error.phase}`));

	// Details
	if (error.details && Object.keys(error.details).length > 0) {
		lines.push(pc.dim('   Details:'));
		for (const [key, value] of Object.entries(error.details)) {
			lines.push(pc.dim(`     ${key}: ${JSON.stringify(value)}`));
		}
	}

	// Suggestion
	if (error.suggestion) {
		lines.push('');
		lines.push(pc.yellow(`Suggestion: ${error.suggestion}`));
	}

	return lines.join('\n');
}

/**
 * Format any error for CLI display
 */
export function formatError(error: unknown): string {
	// Check if it's a FoxenError
	if (
		error &&
		typeof error === 'object' &&
		'code' in error &&
		'phase' in error &&
		'message' in error
	) {
		return formatFoxenError(error as FoxenError);
	}

	// Regular Error
	if (error instanceof Error) {
		return pc.red(`Error: ${error.message}`);
	}

	// Unknown
	return pc.red(`Error: ${String(error)}`);
}

// ============================================================================
// Progress and Status
// ============================================================================

/**
 * Print a loading spinner message (static, not animated)
 */
export function printLoading(message: string): void {
	console.log(`${pc.cyan('...')} ${message}...`);
}

/**
 * Print a completion message with timing
 */
export function printComplete(message: string, durationMs?: number): void {
	const timing = durationMs !== undefined ? pc.dim(` (${formatDuration(durationMs)})`) : '';
	console.log(`${pc.green('+')} ${message}${timing}`);
}

/**
 * Print server start message
 */
export function printServerStart(port: number, host: string, basePath?: string): void {
	console.log();
	console.log(pc.green(`  Server running at ${pc.bold(`http://${host}:${port}`)}`));
	if (basePath) {
		console.log(pc.dim(`     API base: http://${host}:${port}${basePath}`));
	}
	console.log(pc.dim(`     Health: http://${host}:${port}/health`));
	console.log();
}

/**
 * Print watching message
 */
export function printWatching(paths: string[]): void {
	console.log(pc.cyan('  Watching for changes...'));
	for (const p of paths) {
		console.log(pc.dim(`     ${p}`));
	}
	console.log();
	console.log(pc.dim('  Press Ctrl+C to stop'));
	console.log();
}

/**
 * Print reload message
 */
export function printReload(reason: string): void {
	console.log();
	console.log(`${pc.cyan('~')} Reloading: ${pc.dim(reason)}`);
}
