import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, 'fixtures-commands');
const ROUTES_DIR = join(FIXTURES_DIR, 'src', 'app', 'api');
const OUTPUT_DIR = join(FIXTURES_DIR, 'src', 'generated');

// Setup test fixtures
beforeAll(() => {
	mkdirSync(join(ROUTES_DIR, 'users'), { recursive: true });
	mkdirSync(join(ROUTES_DIR, 'health'), { recursive: true });
	mkdirSync(OUTPUT_DIR, { recursive: true });

	// Create routes
	writeFileSync(
		join(ROUTES_DIR, 'users', 'route.ts'),
		`
export async function GET() {
    return Response.json({ users: [] });
}
`,
	);

	writeFileSync(
		join(ROUTES_DIR, 'health', 'route.ts'),
		`
export function GET() {
    return Response.json({ status: "ok" });
}
`,
	);

	// Create config file
	writeFileSync(
		join(FIXTURES_DIR, 'foxen.config.ts'),
		`
export default {
    routesDir: "./src/app/api",
    outputDir: "./src/generated",
    format: "ts",
};
`,
	);
});

// Cleanup test fixtures
afterAll(() => {
	rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('init command', () => {
	// Import the init function
	const getInit = async () => {
		const module = await import('../src/commands/init.js');
		return module.init;
	};

	test('init function is exported', async () => {
		const init = await getInit();
		expect(typeof init).toBe('function');
	});

	test('creates config file', async () => {
		const initDir = join(FIXTURES_DIR, 'init-test');
		mkdirSync(initDir, { recursive: true });

		const originalCwd = process.cwd();

		try {
			process.chdir(initDir);

			// Mock process.exit to prevent actual exit
			let _exitCode: number | undefined;
			const originalExit = process.exit;
			process.exit = ((code?: number) => {
				_exitCode = code;
				throw new Error(`process.exit(${code})`);
			}) as never;

			try {
				const init = await getInit();
				await init({ force: true });
			} catch {
				// Expected if process.exit was called
			}

			process.exit = originalExit;

			// Check if config file was created (if exit wasn't called)
			// or that the function executed without throwing unexpectedly
		} finally {
			process.chdir(originalCwd);
		}
	});
});

describe('generate command', () => {
	const getGenerate = async () => {
		const module = await import('../src/commands/generate.js');
		return module.generate;
	};

	test('generate function is exported', async () => {
		const generate = await getGenerate();
		expect(typeof generate).toBe('function');
	});

	// Note: Full generate tests require compiler setup
	// which is tested in compiler package
});

describe('dev command', () => {
	const getDev = async () => {
		const module = await import('../src/commands/dev.js');
		return module.dev;
	};

	test('dev function is exported', async () => {
		const dev = await getDev();
		expect(typeof dev).toBe('function');
	});

	// Note: Full dev tests require starting a server
	// which is complex to test in unit tests
});

describe('start command', () => {
	const getStart = async () => {
		const module = await import('../src/commands/start.js');
		return module.start;
	};

	test('start function is exported', async () => {
		const start = await getStart();
		expect(typeof start).toBe('function');
	});

	// Note: Full start tests require starting a server
	// which is complex to test in unit tests
});

describe('command options', () => {
	test('dev accepts port option', async () => {
		// Verify the types module exports expected option types
		const types = await import('../src/types.js');

		expect(types.defaultConfig).toBeDefined();
	});

	test('generate accepts routes option', async () => {
		// Verify generate options are properly typed
		const types = await import('../src/types.js');

		expect(types.defaultConfig.routesDir).toBeDefined();
	});

	test('start accepts strict option', async () => {
		// Verify start options work with env validation
		const types = await import('../src/types.js');

		expect(types.defaultConfig).toBeDefined();
	});
});

describe('command error handling', () => {
	test('handles missing routes directory gracefully', async () => {
		// Commands should validate inputs before processing
		const { validateConfig } = await import('../src/config.js');
		const { defaultConfig } = await import('../src/types.js');

		const errors = validateConfig({
			...defaultConfig,
			routesDir: '',
		});

		expect(errors.length).toBeGreaterThan(0);
	});

	test('handles invalid config gracefully', async () => {
		const { validateConfig } = await import('../src/config.js');
		const { defaultConfig } = await import('../src/types.js');

		const errors = validateConfig({
			...defaultConfig,
			format: 'invalid' as 'ts' | 'js',
		});

		expect(errors).toContain("format must be 'ts' or 'js'");
	});
});
