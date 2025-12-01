import { join, resolve } from 'node:path';
import type {
	NextConfigRaw,
	NextHeader,
	NextRedirect,
	NextRewritesConfig,
	ResolvedNextConfig,
} from './types.js';

/**
 * Possible next.config file names to search for
 */
const NEXT_CONFIG_FILE_NAMES = [
	'next.config.ts',
	'next.config.mts',
	'next.config.js',
	'next.config.mjs',
	'next.config.cjs',
];

/**
 * Default resolved config
 */
const DEFAULT_RESOLVED_CONFIG: ResolvedNextConfig = {
	basePath: '',
	trailingSlash: false,
	redirects: [],
	rewrites: {
		beforeFiles: [],
		afterFiles: [],
		fallback: [],
	},
	headers: [],
};

/**
 * Find next.config file in the project
 *
 * @param projectRoot - Root directory to search in
 * @returns Path to config file or null if not found
 */
export async function findNextConfigFile(
	projectRoot: string = process.cwd(),
): Promise<string | null> {
	for (const fileName of NEXT_CONFIG_FILE_NAMES) {
		const fullPath = join(projectRoot, fileName);
		try {
			const file = Bun.file(fullPath);
			if (await file.exists()) {
				return fullPath;
			}
		} catch {
			// File doesn't exist, continue
		}
	}

	return null;
}

/**
 * Resolve redirects from config
 */
async function resolveRedirects(config: NextConfigRaw): Promise<NextRedirect[]> {
	if (!config.redirects) {
		return [];
	}

	const redirects =
		typeof config.redirects === 'function' ? await config.redirects() : config.redirects;

	// Validate redirects
	return redirects.filter((r) => {
		if (!r.source || !r.destination) {
			console.warn('[foxen:config] Invalid redirect, missing source or destination:', r);
			return false;
		}
		return true;
	});
}

/**
 * Resolve rewrites from config
 */
async function resolveRewrites(config: NextConfigRaw): Promise<NextRewritesConfig> {
	if (!config.rewrites) {
		return {
			beforeFiles: [],
			afterFiles: [],
			fallback: [],
		};
	}

	const rewrites =
		typeof config.rewrites === 'function' ? await config.rewrites() : config.rewrites;

	// Handle simple array format - treat as afterFiles
	if (Array.isArray(rewrites)) {
		return {
			beforeFiles: [],
			afterFiles: rewrites.filter((r) => r.source && r.destination),
			fallback: [],
		};
	}

	// Handle object format
	return {
		beforeFiles: (rewrites.beforeFiles || []).filter((r) => r.source && r.destination),
		afterFiles: (rewrites.afterFiles || []).filter((r) => r.source && r.destination),
		fallback: (rewrites.fallback || []).filter((r) => r.source && r.destination),
	};
}

/**
 * Resolve headers from config
 */
async function resolveHeaders(config: NextConfigRaw): Promise<NextHeader[]> {
	if (!config.headers) {
		return [];
	}

	const headers = typeof config.headers === 'function' ? await config.headers() : config.headers;

	// Validate headers
	return headers.filter((h) => {
		if (!h.source || !Array.isArray(h.headers)) {
			console.warn('[foxen:config] Invalid header config, missing source or headers array:', h);
			return false;
		}
		return true;
	});
}

/**
 * Load and parse a next.config.ts file
 *
 * @param configPath - Optional explicit path to config file
 * @param projectRoot - Project root directory for auto-detection
 * @returns Resolved configuration with async functions executed, or null if not found
 *
 * @example
 * ```ts
 * const config = await loadNextConfig();
 * if (config) {
 *   console.log(config.basePath);
 *   console.log(config.redirects); // Resolved array
 * }
 * ```
 */
export async function loadNextConfig(
	configPath?: string,
	projectRoot: string = process.cwd(),
): Promise<ResolvedNextConfig | null> {
	let filePath: string | null = null;

	if (configPath) {
		filePath = resolve(projectRoot, configPath);
	} else {
		filePath = await findNextConfigFile(projectRoot);
	}

	if (!filePath) {
		return null;
	}

	try {
		const module = await import(filePath);
		const exported = module.default || module;

		// Handle function-style config: (phase, { defaultConfig }) => config
		let config: NextConfigRaw;
		if (typeof exported === 'function') {
			config = await exported('production', {});
		} else {
			config = exported;
		}

		// Resolve all async config functions
		const [redirects, rewrites, headers] = await Promise.all([
			resolveRedirects(config),
			resolveRewrites(config),
			resolveHeaders(config),
		]);

		return {
			basePath: config.basePath || '',
			trailingSlash: config.trailingSlash || false,
			redirects,
			rewrites,
			headers,
		};
	} catch (error) {
		console.error(`[foxen:config] Failed to load next.config: ${filePath}`, error);
		return null;
	}
}

/**
 * Load next.config with defaults (never returns null)
 *
 * @param configPath - Optional explicit path to config file
 * @param projectRoot - Project root directory for auto-detection
 * @returns Resolved configuration, with defaults if config not found
 */
export async function loadNextConfigWithDefaults(
	configPath?: string,
	projectRoot: string = process.cwd(),
): Promise<ResolvedNextConfig> {
	const config = await loadNextConfig(configPath, projectRoot);
	return config ?? { ...DEFAULT_RESOLVED_CONFIG };
}

/**
 * Create a resolved config from a raw config object (useful for testing)
 *
 * @param config - Raw Next.js config object
 * @returns Resolved configuration
 */
export async function resolveNextConfig(config: NextConfigRaw): Promise<ResolvedNextConfig> {
	const [redirects, rewrites, headers] = await Promise.all([
		resolveRedirects(config),
		resolveRewrites(config),
		resolveHeaders(config),
	]);

	return {
		basePath: config.basePath || '',
		trailingSlash: config.trailingSlash || false,
		redirects,
		rewrites,
		headers,
	};
}
