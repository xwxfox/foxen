import { describe, expect, test } from 'bun:test';
import * as foxen from '../src/index.js';

describe('@foxen/foxen exports', () => {
	describe('core exports', () => {
		test('exports NextRequest', () => {
			expect(foxen.NextRequest).toBeDefined();
		});

		test('exports NextResponse', () => {
			expect(foxen.NextResponse).toBeDefined();
		});

		test('exports NextURL', () => {
			expect(foxen.NextURL).toBeDefined();
		});

		test('exports RequestCookies', () => {
			expect(foxen.RequestCookies).toBeDefined();
		});

		test('exports ResponseCookies', () => {
			expect(foxen.ResponseCookies).toBeDefined();
		});
	});

	describe('navigation exports', () => {
		test('exports headers helper', () => {
			expect(typeof foxen.headers).toBe('function');
		});

		test('exports cookies helper', () => {
			expect(typeof foxen.cookies).toBe('function');
		});

		test('exports redirect helper', () => {
			expect(typeof foxen.redirect).toBe('function');
		});

		test('exports foxenInterruptHandler', () => {
			expect(typeof foxen.foxenInterruptHandler).toBe('function');
		});
	});

	describe('helpers exports', () => {
		test('exports userAgent', () => {
			expect(foxen.userAgent).toBeDefined();
			expect(typeof foxen.userAgent).toBe('function');
		});
	});

	describe('config exports', () => {
		test('exports loadFoxenConfig', () => {
			expect(foxen.loadFoxenConfig).toBeDefined();
			expect(typeof foxen.loadFoxenConfig).toBe('function');
		});

		test('exports defineFoxenConfig', () => {
			expect(foxen.defineFoxenConfig).toBeDefined();
			expect(typeof foxen.defineFoxenConfig).toBe('function');
		});

		test('exports loadNextConfig', () => {
			expect(foxen.loadNextConfig).toBeDefined();
			expect(typeof foxen.loadNextConfig).toBe('function');
		});

		test('exports matchPath', () => {
			expect(foxen.matchPath).toBeDefined();
			expect(typeof foxen.matchPath).toBe('function');
		});

		test('exports processRedirects', () => {
			expect(foxen.processRedirects).toBeDefined();
			expect(typeof foxen.processRedirects).toBe('function');
		});

		test('exports processRewrites', () => {
			expect(foxen.processRewrites).toBeDefined();
			expect(typeof foxen.processRewrites).toBe('function');
		});

		test('exports processHeaders', () => {
			expect(foxen.processHeaders).toBeDefined();
			expect(typeof foxen.processHeaders).toBe('function');
		});

		test('exports SECURITY_HEADERS', () => {
			expect(foxen.SECURITY_HEADERS).toBeDefined();
		});

		test('exports DEFAULT_CONFIG', () => {
			expect(foxen.DEFAULT_CONFIG).toBeDefined();
		});
	});

	describe('adapter exports', () => {
		test('exports appRouter', () => {
			expect(foxen.appRouter).toBeDefined();
			expect(typeof foxen.appRouter).toBe('function');
		});

		test('exports createApp', () => {
			expect(foxen.createApp).toBeDefined();
			expect(typeof foxen.createApp).toBe('function');
		});

		test('exports defaultAdapter', () => {
			expect(foxen.defaultAdapter).toBeDefined();
			expect(typeof foxen.defaultAdapter).toBe('function');
		});

		test('exports simpleAdapter', () => {
			expect(foxen.simpleAdapter).toBeDefined();
			expect(typeof foxen.simpleAdapter).toBe('function');
		});

		test('exports scanDirectory', () => {
			expect(foxen.scanDirectory).toBeDefined();
			expect(typeof foxen.scanDirectory).toBe('function');
		});

		test('exports convertPathToElysia', () => {
			expect(foxen.convertPathToElysia).toBeDefined();
			expect(typeof foxen.convertPathToElysia).toBe('function');
		});
	});

	describe('cli exports', () => {
		test('exports defineConfig', () => {
			expect(foxen.defineConfig).toBeDefined();
			expect(typeof foxen.defineConfig).toBe('function');
		});

		test('exports loadConfig', () => {
			expect(foxen.loadConfig).toBeDefined();
			expect(typeof foxen.loadConfig).toBe('function');
		});

		test('exports findConfigFile', () => {
			expect(foxen.findConfigFile).toBeDefined();
			expect(typeof foxen.findConfigFile).toBe('function');
		});
	});

	describe('middleware exports', () => {
		test('exports loadMiddleware', () => {
			expect(foxen.loadMiddleware).toBeDefined();
			expect(typeof foxen.loadMiddleware).toBe('function');
		});

		test('exports pathToRegex', () => {
			expect(foxen.pathToRegex).toBeDefined();
			expect(typeof foxen.pathToRegex).toBe('function');
		});

		test('exports shouldRunMiddleware', () => {
			expect(foxen.shouldRunMiddleware).toBeDefined();
			expect(typeof foxen.shouldRunMiddleware).toBe('function');
		});

		test('exports NextFetchEvent', () => {
			expect(foxen.NextFetchEvent).toBeDefined();
		});

		test('exports executeMiddleware', () => {
			expect(foxen.executeMiddleware).toBeDefined();
			expect(typeof foxen.executeMiddleware).toBe('function');
		});
	});

	describe('env exports', () => {
		test('exports bootstrapEnv', () => {
			expect(foxen.bootstrapEnv).toBeDefined();
			expect(typeof foxen.bootstrapEnv).toBe('function');
		});

		test('exports resetEnv', () => {
			expect(foxen.resetEnv).toBeDefined();
			expect(typeof foxen.resetEnv).toBe('function');
		});

		test('exports getEnv', () => {
			expect(foxen.getEnv).toBeDefined();
			expect(typeof foxen.getEnv).toBe('function');
		});

		test('exports getAllEnv', () => {
			expect(foxen.getAllEnv).toBeDefined();
			expect(typeof foxen.getAllEnv).toBe('function');
		});

		test('exports loadEnvFiles', () => {
			expect(foxen.loadEnvFiles).toBeDefined();
			expect(typeof foxen.loadEnvFiles).toBe('function');
		});

		test('exports parseEnvFile', () => {
			expect(foxen.parseEnvFile).toBeDefined();
			expect(typeof foxen.parseEnvFile).toBe('function');
		});

		test('exports inferType', () => {
			expect(foxen.inferType).toBeDefined();
			expect(typeof foxen.inferType).toBe('function');
		});

		test('exports generateEnvFiles', () => {
			expect(foxen.generateEnvFiles).toBeDefined();
			expect(typeof foxen.generateEnvFiles).toBe('function');
		});

		test('exports EnvError', () => {
			expect(foxen.EnvError).toBeDefined();
		});
	});

	describe('elysia re-exports', () => {
		test('exports t from elysia', () => {
			expect(foxen.t).toBeDefined();
			expect(foxen.t.String).toBeDefined();
			expect(foxen.t.Number).toBeDefined();
			expect(foxen.t.Object).toBeDefined();
		});
	});
});

describe('integration checks', () => {
	test('NextRequest can be instantiated', () => {
		const request = new foxen.NextRequest('https://example.com/api/test');
		expect(request.url).toBe('https://example.com/api/test');
	});

	test('NextResponse.json works', () => {
		const response = foxen.NextResponse.json({ ok: true });
		expect(response).toBeInstanceOf(Response);
	});

	test('NextResponse.redirect works', () => {
		const response = foxen.NextResponse.redirect('https://example.com');
		expect(response.status).toBe(307);
	});

	test('userAgent parses user agent string', () => {
		const ua = foxen.userAgent({
			headers: new Headers({
				'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
			}),
		});

		expect(ua.browser.name).toBeDefined();
	});

	test('t.Object creates schema', () => {
		const schema = foxen.t.Object({
			name: foxen.t.String(),
			age: foxen.t.Number(),
		});

		expect(schema).toBeDefined();
		expect(schema.type).toBe('object');
	});

	test('matchPath matches simple paths', () => {
		const result = foxen.matchPath('/users', '/users');
		expect(result.matched).toBe(true);
	});

	test('convertPathToElysia converts dynamic segments', () => {
		const result = foxen.convertPathToElysia('/users/[id]');
		expect(result.elysiaPath).toBe('/users/:id');
	});
});
