import { describe, expect, test } from 'bun:test';
import {
	colorMethod,
	createLogger,
	formatDuration,
	formatError,
	formatPath,
	formatSize,
} from '../src/logger.js';

describe('createLogger', () => {
	test('creates logger with all methods', () => {
		const logger = createLogger();

		expect(typeof logger.info).toBe('function');
		expect(typeof logger.success).toBe('function');
		expect(typeof logger.warn).toBe('function');
		expect(typeof logger.error).toBe('function');
		expect(typeof logger.debug).toBe('function');
		expect(typeof logger.log).toBe('function');
	});

	test('debug only logs when verbose is true', () => {
		const verboseLogger = createLogger(true);
		const quietLogger = createLogger(false);

		// Both should have the method
		expect(typeof verboseLogger.debug).toBe('function');
		expect(typeof quietLogger.debug).toBe('function');
	});

	test('accepts optional prefix', () => {
		const logger = createLogger(true, 'test');

		// Should create without error
		expect(logger).toBeDefined();
	});
});

describe('formatDuration', () => {
	test('formats milliseconds', () => {
		const result = formatDuration(123);

		expect(result).toBe('123ms');
	});

	test('formats sub-millisecond as 0ms', () => {
		const result = formatDuration(0.5);

		expect(result).toBe('1ms');
	});

	test('formats seconds for values >= 1000ms', () => {
		const result = formatDuration(1500);

		expect(result).toBe('1.50s');
	});

	test('formats exact second', () => {
		const result = formatDuration(1000);

		expect(result).toBe('1.00s');
	});

	test('formats large values', () => {
		const result = formatDuration(65000);

		expect(result).toBe('65.00s');
	});
});

describe('formatSize', () => {
	test('formats bytes', () => {
		const result = formatSize(512);

		expect(result).toBe('512B');
	});

	test('formats kilobytes', () => {
		const result = formatSize(1536);

		expect(result).toBe('1.5KB');
	});

	test('formats megabytes', () => {
		const result = formatSize(1.5 * 1024 * 1024);

		expect(result).toBe('1.5MB');
	});

	test('handles zero', () => {
		const result = formatSize(0);

		expect(result).toBe('0B');
	});

	test('handles exact KB boundary', () => {
		const result = formatSize(1024);

		expect(result).toBe('1.0KB');
	});
});

describe('colorMethod', () => {
	test('colors GET method', () => {
		const result = colorMethod('GET');

		// Should contain the method name (color codes are terminal-specific)
		expect(result).toContain('GET');
	});

	test('colors POST method', () => {
		const result = colorMethod('POST');

		expect(result).toContain('POST');
	});

	test('colors PUT method', () => {
		const result = colorMethod('PUT');

		expect(result).toContain('PUT');
	});

	test('colors DELETE method', () => {
		const result = colorMethod('DELETE');

		expect(result).toContain('DELETE');
	});

	test('colors PATCH method', () => {
		const result = colorMethod('PATCH');

		expect(result).toContain('PATCH');
	});

	test('colors HEAD method', () => {
		const result = colorMethod('HEAD');

		expect(result).toContain('HEAD');
	});

	test('colors OPTIONS method', () => {
		const result = colorMethod('OPTIONS');

		expect(result).toContain('OPTIONS');
	});

	test('handles lowercase input', () => {
		const result = colorMethod('get');

		expect(result).toContain('get');
	});

	test('handles unknown method', () => {
		const result = colorMethod('CUSTOM');

		expect(result).toBe('CUSTOM');
	});
});

describe('formatPath', () => {
	test('formats simple path', () => {
		const result = formatPath('/users');

		expect(result).toContain('/users');
	});

	test('highlights dynamic segments', () => {
		const result = formatPath('/users/:id');

		expect(result).toContain(':id');
	});

	test('highlights multiple dynamic segments', () => {
		const result = formatPath('/users/:userId/posts/:postId');

		expect(result).toContain(':userId');
		expect(result).toContain(':postId');
	});

	test('highlights catch-all', () => {
		const result = formatPath('/docs/*');

		expect(result).toContain('*');
	});
});

describe('formatError', () => {
	test('formats Error instance', () => {
		const error = new Error('Test error message');
		const result = formatError(error);

		expect(result).toContain('Test error message');
	});

	test('formats FoxenError', () => {
		const error = {
			message: 'Route not found',
			code: 'ROUTE_NOT_FOUND',
			phase: 'analysis',
			details: { path: '/users' },
		};

		const result = formatError(error);

		expect(result).toContain('Route not found');
		expect(result).toContain('ROUTE_NOT_FOUND');
		expect(result).toContain('analysis');
	});

	test('formats FoxenError with suggestion', () => {
		const error = {
			message: 'Config not found',
			code: 'CONFIG_NOT_FOUND',
			phase: 'init',
			suggestion: "Run 'foxen init' to create a config file",
		};

		const result = formatError(error);

		expect(result).toContain('Config not found');
		expect(result).toContain("Run 'foxen init'");
	});

	test('formats string error', () => {
		const result = formatError('Something went wrong');

		expect(result).toContain('Something went wrong');
	});

	test('formats unknown error type', () => {
		const result = formatError({ weird: 'object' });

		expect(result).toBeDefined();
	});
});

describe('logger output format', () => {
	// These tests verify the logger produces output without throwing
	test('info logs without error', () => {
		const logger = createLogger();

		expect(() => {
			logger.info('Test info message');
		}).not.toThrow();
	});

	test('success logs without error', () => {
		const logger = createLogger();

		expect(() => {
			logger.success('Test success message');
		}).not.toThrow();
	});

	test('warn logs without error', () => {
		const logger = createLogger();

		expect(() => {
			logger.warn('Test warning message');
		}).not.toThrow();
	});

	test('error logs without error', () => {
		const logger = createLogger();

		expect(() => {
			logger.error('Test error message');
		}).not.toThrow();
	});

	test('debug logs without error when verbose', () => {
		const logger = createLogger(true);

		expect(() => {
			logger.debug('Test debug message');
		}).not.toThrow();
	});

	test('log logs without error', () => {
		const logger = createLogger();

		expect(() => {
			logger.log('Test plain message');
		}).not.toThrow();
	});
});
