// Configuration
export { loadConfig, findConfigFile, defineConfig, validateConfig } from './config.js';

// Types
export type {
	Config,
	GenerateOptions,
	DevOptions,
	BuildOptions,
} from './types.js';
export { defaultConfig, configFileNames } from './types.js';

// Logger utilities
export {
	createLogger,
	formatDuration,
	formatSize,
	formatError,
	formatFoxenError,
	formatPath,
	colorMethod,
	printBanner,
	printRouteTable,
	printBoxTable,
	printStatus,
	printLoading,
	printComplete,
	printServerStart,
	printWatching,
	printReload,
} from './logger.js';

export type { Logger, RouteInfo, MiddlewareInfo, ConfigInfo } from './logger.js';

// Commands (for programmatic use)
export { generate, dev, init } from './commands/index.js';
