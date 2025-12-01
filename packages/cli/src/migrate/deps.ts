import type { DependencyResolution, NextJsProjectAnalysis } from './types.js';

/**
 * Known dependency mappings from Next.js ecosystem to Elysia
 */
const DEPENDENCY_MAPPINGS: Record<string, string | null> = {
	// Next.js core - not needed
	next: null,
	'next-auth': '@elysiajs/bearer', // Or suggest custom auth

	// React - not needed for API only
	react: null,
	'react-dom': null,

	// Database/ORM - keep as is
	prisma: 'prisma',
	'@prisma/client': '@prisma/client',
	'drizzle-orm': 'drizzle-orm',
	mongoose: 'mongoose',
	pg: 'pg',
	mysql2: 'mysql2',
	'better-sqlite3': 'better-sqlite3',

	// Validation - suggest Elysia's built-in or keep
	zod: 'zod', // Works with Elysia
	yup: 'yup',
	joi: null, // Suggest using Elysia's t.*

	// HTTP clients - keep as is
	axios: 'axios',
	'node-fetch': null, // Use built-in fetch
	ky: 'ky',

	// Auth/Security
	bcrypt: 'bcrypt',
	bcryptjs: 'bcryptjs',
	jsonwebtoken: 'jsonwebtoken',
	jose: 'jose',

	// Utilities - keep as is
	lodash: 'lodash',
	'date-fns': 'date-fns',
	dayjs: 'dayjs',
	uuid: 'uuid',
	nanoid: 'nanoid',

	// File handling
	formidable: null, // Elysia handles this
	multer: null, // Elysia handles this
	sharp: 'sharp',

	// Email
	nodemailer: 'nodemailer',
	resend: 'resend',

	// Cloud services
	'aws-sdk': 'aws-sdk',
	'@aws-sdk/client-s3': '@aws-sdk/client-s3',
	stripe: 'stripe',

	// Caching
	redis: 'redis',
	ioredis: 'ioredis',

	// Logging
	pino: 'pino',
	winston: 'winston',
};

/**
 * Elysia plugins to add based on detected patterns
 * TODO: Implement pattern detection to automatically suggest these plugins
 */
const _ELYSIA_PLUGINS: Record<string, { package: string; reason: string }> = {
	cors: {
		package: '@elysiajs/cors',
		reason: 'Cross-origin resource sharing',
	},
	swagger: {
		package: '@elysiajs/swagger',
		reason: 'API documentation',
	},
	bearer: {
		package: '@elysiajs/bearer',
		reason: 'Bearer token authentication',
	},
	jwt: {
		package: '@elysiajs/jwt',
		reason: 'JWT authentication',
	},
	cookie: {
		package: '@elysiajs/cookie',
		reason: 'Cookie handling',
	},
	static: {
		package: '@elysiajs/static',
		reason: 'Static file serving',
	},
	html: {
		package: '@elysiajs/html',
		reason: 'HTML response handling',
	},
	stream: {
		package: '@elysiajs/stream',
		reason: 'Streaming responses',
	},
	'rate-limit': {
		package: 'elysia-rate-limit',
		reason: 'Rate limiting',
	},
};

/**
 * Resolve dependencies for migration
 */
export function resolveDependencies(analysis: NextJsProjectAnalysis): DependencyResolution {
	const keep: string[] = [];
	const remove: string[] = [];
	const add: Array<{ name: string; version: string; reason: string }> = [];
	const warnings: string[] = [];

	// Always add core Elysia packages
	add.push(
		{ name: 'elysia', version: '^1.3.0', reason: 'Core framework' },
		{ name: '@elysiajs/cors', version: '^1.3.0', reason: 'CORS support' },
		{ name: '@elysiajs/swagger', version: '^1.3.0', reason: 'API documentation' },
	);

	// Process existing dependencies
	const allDeps = [...analysis.dependencies, ...analysis.devDependencies];

	for (const dep of analysis.dependencies) {
		const mapping = DEPENDENCY_MAPPINGS[dep];

		if (mapping === null) {
			remove.push(dep);
		} else if (mapping !== undefined) {
			keep.push(mapping);
		} else {
			// Unknown dependency - keep it but warn
			keep.push(dep);
			if (!dep.startsWith('@types/')) {
				warnings.push(`Unknown dependency "${dep}" - keeping as is, verify compatibility`);
			}
		}
	}

	// Check for patterns that suggest Elysia plugins
	// TODO: Use this to detect patterns and suggest plugins from _ELYSIA_PLUGINS
	const _routeContent = analysis.routes
		.map((r) => r.handlers.map((h) => h.method).join(' '))
		.join(' ');

	// JWT/Auth detection
	if (
		allDeps.includes('jsonwebtoken') ||
		allDeps.includes('jose') ||
		allDeps.includes('next-auth')
	) {
		add.push({
			name: '@elysiajs/jwt',
			version: '^1.3.0',
			reason: 'JWT support detected in dependencies',
		});
	}

	// Cookie detection
	if (
		analysis.routes.some((r) => r.handlers.some((h) => h.method === 'POST' || h.method === 'PUT'))
	) {
		add.push({
			name: '@elysiajs/cookie',
			version: '^1.3.0',
			reason: 'Cookie support for session handling',
		});
	}

	// Static files detection
	if (
		analysis.routes.some((r) => r.elysiaPath.includes('static') || r.elysiaPath.includes('assets'))
	) {
		add.push({
			name: '@elysiajs/static',
			version: '^1.3.0',
			reason: 'Static file routes detected',
		});
	}

	// Deduplicate
	const uniqueKeep = [...new Set(keep)];
	const uniqueRemove = [...new Set(remove)];
	const uniqueAdd = add.filter(
		(item, index, self) => index === self.findIndex((t) => t.name === item.name),
	);

	return {
		keep: uniqueKeep,
		remove: uniqueRemove,
		add: uniqueAdd,
		warnings,
	};
}

/**
 * Generate a dependency summary for display
 */
export function getDependencySummary(resolution: DependencyResolution): string {
	const lines: string[] = ['Dependency Resolution:'];

	if (resolution.add.length > 0) {
		lines.push('\n  New dependencies:');
		for (const dep of resolution.add) {
			lines.push(`    + ${dep.name}@${dep.version} (${dep.reason})`);
		}
	}

	if (resolution.keep.length > 0) {
		lines.push('\n  Keep:');
		for (const dep of resolution.keep) {
			lines.push(`    - ${dep}`);
		}
	}

	if (resolution.remove.length > 0) {
		lines.push('\n  Remove (Next.js specific):');
		for (const dep of resolution.remove) {
			lines.push(`    x ${dep}`);
		}
	}

	if (resolution.warnings.length > 0) {
		lines.push('\n  Warnings:');
		for (const warning of resolution.warnings) {
			lines.push(`    ! ${warning}`);
		}
	}

	return lines.join('\n');
}

/**
 * Merge resolved dependencies into a package.json dependencies object
 */
export function mergeWithExisting(
	existingDeps: Record<string, string>,
	resolution: DependencyResolution,
): Record<string, string> {
	const result: Record<string, string> = {};

	// Add kept dependencies with their existing versions
	for (const dep of resolution.keep) {
		if (existingDeps[dep]) {
			result[dep] = existingDeps[dep];
		}
	}

	// Add new dependencies
	for (const dep of resolution.add) {
		result[dep.name] = dep.version;
	}

	// Sort alphabetically
	return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
