import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EnvNotLoadedError } from '../src/errors.js';
import {
	bootstrapEnv,
	buildEnvSchema,
	checkRequired,
	createEnvProxy,
	env,
	getAllEnv,
	getEnv,
	getLoadedFiles,
	getRawEnv,
	isEnvLoaded,
	resetEnv,
} from '../src/runtime.js';

// Test directory
const TEST_DIR = join(import.meta.dir, '.test-runtime');

describe('bootstrapEnv', () => {
	beforeEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	it('should load .env files', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');

		bootstrapEnv({ rootDir: TEST_DIR });

		expect(isEnvLoaded()).toBe(true);
	});

	it('should inject variables into process.env', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'TEST_INJECT_KEY=injected\n');

		bootstrapEnv({ rootDir: TEST_DIR });

		expect(process.env.TEST_INJECT_KEY).toBe('injected');

		// Cleanup
		process.env.TEST_INJECT_KEY = undefined;
	});

	it('should not reload if already loaded', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value1\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value2\n');
		bootstrapEnv({ rootDir: TEST_DIR }); // Should be no-op

		//@ts-expect-error
		expect(getEnv('KEY')).toBe('value1'); // Still the first value
	});

	it('should decode values according to type', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'DEBUG=true\nPORT=3000\nRATE=0.5\nNAME=test\n');

		bootstrapEnv({ rootDir: TEST_DIR });

		//@ts-expect-error
		expect(getEnv('DEBUG')).toBe(true);
		//@ts-expect-error
		expect(getEnv('PORT')).toBe(3000);
		//@ts-expect-error
		expect(getEnv('RATE')).toBe(0.5);
		//@ts-expect-error
		expect(getEnv('NAME')).toBe('test');
	});

	it('should track loaded files', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');
		writeFileSync(join(TEST_DIR, '.env.development'), 'KEY2=value2\n');

		bootstrapEnv({ rootDir: TEST_DIR, mode: 'development' });

		const files = getLoadedFiles();
		expect(files.length).toBe(2);
	});

	it('should not inject if injectToProcessEnv is false', () => {
		const uniqueKey = `TEST_NO_INJECT_${Date.now()}`;
		writeFileSync(join(TEST_DIR, '.env'), `${uniqueKey}=value\n`);

		bootstrapEnv({ rootDir: TEST_DIR, injectToProcessEnv: false });

		expect(process.env[uniqueKey]).toBeUndefined();
	});
});

describe('resetEnv', () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	it('should reset loaded state', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		expect(isEnvLoaded()).toBe(true);
		resetEnv();
		expect(isEnvLoaded()).toBe(false);
	});

	it('should allow reloading after reset', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value1\n');
		bootstrapEnv({ rootDir: TEST_DIR });
		//@ts-expect-error
		expect(getEnv('KEY')).toBe('value1');

		resetEnv();

		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value2\n');
		bootstrapEnv({ rootDir: TEST_DIR });
		//@ts-expect-error
		expect(getEnv('KEY')).toBe('value2');
	});
});

describe('getEnv', () => {
	beforeEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	it('should throw if env not loaded', () => {
		expect(() => getEnv('KEY')).toThrow(EnvNotLoadedError);
	});

	it('should return typed value', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'PORT=3000\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		const port = getEnv<number>('PORT');
		expect(port).toBe(3000);
		expect(typeof port).toBe('number');
	});

	it('should return default value if not set', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'OTHER=value\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		expect(getEnv('MISSING', 'default')).toBe('default');
	});

	it('should throw for missing variable without default', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'OTHER=value\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		expect(() => getEnv('MISSING')).toThrow();
	});
});

describe('getAllEnv', () => {
	beforeEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	it('should return all decoded values', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY1=value1\nKEY2=value2\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		const all = getAllEnv();
		expect(all.KEY1).toBe('value1');
		expect(all.KEY2).toBe('value2');
	});

	it('should return frozen object', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		const all = getAllEnv();
		expect(Object.isFrozen(all)).toBe(true);
	});
});

describe('getRawEnv', () => {
	beforeEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	it('should return raw string values', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'PORT=3000\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		const raw = getRawEnv();
		expect(raw.PORT).toBe('3000');
		expect(typeof raw.PORT).toBe('string');
	});
});

describe('env proxy', () => {
	beforeEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	it('should throw if accessed before bootstrap', () => {
		expect(() => env.KEY).toThrow(EnvNotLoadedError);
	});

	it('should provide access to env values', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		expect(env.KEY).toBe('value');
	});

	it("should support 'in' operator", () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		expect('KEY' in env).toBe(true);
		expect('MISSING' in env).toBe(false);
	});

	it('should support Object.keys', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY1=value1\nKEY2=value2\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		const keys = Object.keys(env);
		expect(keys).toContain('KEY1');
		expect(keys).toContain('KEY2');
	});
});

describe('createEnvProxy', () => {
	beforeEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	it('should create independent proxy', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY=value\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		const myEnv = createEnvProxy<{ KEY: string }>();
		expect(myEnv.KEY).toBe('value');
	});
});

describe('checkRequired', () => {
	beforeEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	it('should return valid when all required present', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY1=value1\nKEY2=value2\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		const result = checkRequired(['KEY1', 'KEY2']);
		expect(result.valid).toBe(true);
		expect(result.errors.length).toBe(0);
	});

	it('should return errors for missing required', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'KEY1=value1\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		const result = checkRequired(['KEY1', 'KEY2', 'KEY3']);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBe(2);
		expect(result.errors.map((e) => e.variable)).toContain('KEY2');
		expect(result.errors.map((e) => e.variable)).toContain('KEY3');
	});
});

describe('buildEnvSchema', () => {
	beforeEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		resetEnv();
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	it('should throw if env not loaded', () => {
		expect(() => buildEnvSchema()).toThrow(EnvNotLoadedError);
	});

	it('should build schema from current environment', () => {
		writeFileSync(join(TEST_DIR, '.env'), 'DEBUG=true\nPORT=3000\nNAME=test\n');
		bootstrapEnv({ rootDir: TEST_DIR });

		const schema = buildEnvSchema();

		expect(schema).toBeDefined();
		expect(schema.properties).toBeDefined();
		expect(schema.properties.DEBUG).toBeDefined();
		expect(schema.properties.PORT).toBeDefined();
		expect(schema.properties.NAME).toBeDefined();
	});
});
