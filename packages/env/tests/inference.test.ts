import { describe, expect, it } from 'bun:test';
import {
	canDecode,
	decodeEnv,
	decodeValue,
	encodeValue,
	inferType,
	inferTypes,
	toTypeBoxMethod,
	toTypeScriptType,
	validateType,
} from '../src/inference.js';

describe('inferType', () => {
	describe('boolean inference', () => {
		it('should infer "true" as boolean', () => {
			expect(inferType('true')).toBe('boolean');
		});

		it('should infer "false" as boolean', () => {
			expect(inferType('false')).toBe('boolean');
		});

		it('should infer "yes" as boolean', () => {
			expect(inferType('yes')).toBe('boolean');
		});

		it('should infer "no" as boolean', () => {
			expect(inferType('no')).toBe('boolean');
		});

		it('should infer "on" as boolean', () => {
			expect(inferType('on')).toBe('boolean');
		});

		it('should infer "off" as boolean', () => {
			expect(inferType('off')).toBe('boolean');
		});

		it('should infer "1" as boolean', () => {
			expect(inferType('1')).toBe('boolean');
		});

		it('should infer "0" as boolean', () => {
			expect(inferType('0')).toBe('boolean');
		});

		it('should be case insensitive for booleans', () => {
			expect(inferType('TRUE')).toBe('boolean');
			expect(inferType('FALSE')).toBe('boolean');
			expect(inferType('Yes')).toBe('boolean');
			expect(inferType('No')).toBe('boolean');
		});
	});

	describe('integer inference', () => {
		it('should infer positive integers', () => {
			expect(inferType('42')).toBe('integer');
			expect(inferType('123')).toBe('integer');
		});

		it('should infer negative integers', () => {
			expect(inferType('-42')).toBe('integer');
			expect(inferType('-1')).toBe('integer');
		});

		it('should infer zero as boolean (1/0 are booleans)', () => {
			// Note: "0" is treated as boolean due to common usage
			expect(inferType('0')).toBe('boolean');
		});
	});

	describe('number inference', () => {
		it('should infer floats', () => {
			expect(inferType('3.14')).toBe('number');
			expect(inferType('0.5')).toBe('number');
		});

		it('should infer negative floats', () => {
			expect(inferType('-3.14')).toBe('number');
		});

		it('should infer scientific notation', () => {
			expect(inferType('1e10')).toBe('number');
			expect(inferType('1.5e-3')).toBe('number');
		});
	});

	describe('string inference', () => {
		it('should infer regular text as string', () => {
			expect(inferType('hello')).toBe('string');
			expect(inferType('hello world')).toBe('string');
		});

		it('should infer URLs as string', () => {
			expect(inferType('https://example.com')).toBe('string');
			expect(inferType('postgres://localhost/db')).toBe('string');
		});

		it('should infer empty string as string', () => {
			expect(inferType('')).toBe('string');
		});

		it('should infer mixed content as string', () => {
			expect(inferType('abc123')).toBe('string');
			expect(inferType('123abc')).toBe('string');
		});
	});
});

describe('toTypeScriptType', () => {
	it('should return boolean for boolean', () => {
		expect(toTypeScriptType('boolean')).toBe('boolean');
	});

	it('should return number for integer', () => {
		expect(toTypeScriptType('integer')).toBe('number');
	});

	it('should return number for number', () => {
		expect(toTypeScriptType('number')).toBe('number');
	});

	it('should return string for string', () => {
		expect(toTypeScriptType('string')).toBe('string');
	});
});

describe('toTypeBoxMethod', () => {
	it('should return Boolean for boolean', () => {
		expect(toTypeBoxMethod('boolean')).toBe('Boolean');
	});

	it('should return Integer for integer', () => {
		expect(toTypeBoxMethod('integer')).toBe('Integer');
	});

	it('should return Number for number', () => {
		expect(toTypeBoxMethod('number')).toBe('Number');
	});

	it('should return String for string', () => {
		expect(toTypeBoxMethod('string')).toBe('String');
	});
});

describe('decodeValue', () => {
	it('should decode boolean true values', () => {
		expect(decodeValue('true', 'boolean')).toBe(true);
		expect(decodeValue('yes', 'boolean')).toBe(true);
		expect(decodeValue('on', 'boolean')).toBe(true);
		expect(decodeValue('1', 'boolean')).toBe(true);
	});

	it('should decode boolean false values', () => {
		expect(decodeValue('false', 'boolean')).toBe(false);
		expect(decodeValue('no', 'boolean')).toBe(false);
		expect(decodeValue('off', 'boolean')).toBe(false);
		expect(decodeValue('0', 'boolean')).toBe(false);
	});

	it('should decode integers', () => {
		expect(decodeValue('42', 'integer')).toBe(42);
		expect(decodeValue('-10', 'integer')).toBe(-10);
	});

	it('should decode numbers', () => {
		expect(decodeValue('3.14', 'number')).toBe(3.14);
		expect(decodeValue('-2.5', 'number')).toBe(-2.5);
	});

	it('should decode strings as-is', () => {
		expect(decodeValue('hello', 'string')).toBe('hello');
	});
});

describe('encodeValue', () => {
	it('should encode booleans to strings', () => {
		expect(encodeValue(true)).toBe('true');
		expect(encodeValue(false)).toBe('false');
	});

	it('should encode numbers to strings', () => {
		expect(encodeValue(42)).toBe('42');
		expect(encodeValue(3.14)).toBe('3.14');
	});

	it('should encode null/undefined to empty string', () => {
		expect(encodeValue(null)).toBe('');
		expect(encodeValue(undefined)).toBe('');
	});
});

describe('inferTypes', () => {
	it('should infer types for all values', () => {
		const env = {
			DEBUG: 'true',
			PORT: '3000',
			RATE: '0.5',
			NAME: 'myapp',
		};

		const types = inferTypes(env);

		expect(types.get('DEBUG')).toBe('boolean');
		expect(types.get('PORT')).toBe('integer');
		expect(types.get('RATE')).toBe('number');
		expect(types.get('NAME')).toBe('string');
	});

	it('should use overrides when provided', () => {
		const env = {
			PORT: '3000',
		};

		const types = inferTypes(env, { PORT: 'string' });
		expect(types.get('PORT')).toBe('string');
	});
});

describe('decodeEnv', () => {
	it('should decode all values according to types', () => {
		const env = {
			DEBUG: 'true',
			PORT: '3000',
			NAME: 'myapp',
		};

		const types = new Map<string, 'boolean' | 'integer' | 'number' | 'string'>([
			['DEBUG', 'boolean'],
			['PORT', 'integer'],
			['NAME', 'string'],
		]);

		const decoded = decodeEnv(env, types);

		expect(decoded.DEBUG).toBe(true);
		expect(decoded.PORT).toBe(3000);
		expect(decoded.NAME).toBe('myapp');
	});
});

describe('validateType', () => {
	it('should validate boolean values', () => {
		expect(validateType(true, 'boolean')).toBe(true);
		expect(validateType(false, 'boolean')).toBe(true);
		expect(validateType('true', 'boolean')).toBe(false);
	});

	it('should validate integer values', () => {
		expect(validateType(42, 'integer')).toBe(true);
		expect(validateType(3.14, 'integer')).toBe(false);
		expect(validateType('42', 'integer')).toBe(false);
	});

	it('should validate number values', () => {
		expect(validateType(42, 'number')).toBe(true);
		expect(validateType(3.14, 'number')).toBe(true);
		expect(validateType(Number.NaN, 'number')).toBe(false);
	});

	it('should validate string values', () => {
		expect(validateType('hello', 'string')).toBe(true);
		expect(validateType(123, 'string')).toBe(false);
	});
});

describe('canDecode', () => {
	it('should check if string can decode to boolean', () => {
		expect(canDecode('true', 'boolean')).toBe(true);
		expect(canDecode('false', 'boolean')).toBe(true);
		expect(canDecode('maybe', 'boolean')).toBe(false);
	});

	it('should check if string can decode to integer', () => {
		expect(canDecode('42', 'integer')).toBe(true);
		expect(canDecode('3.14', 'integer')).toBe(false);
		expect(canDecode('abc', 'integer')).toBe(false);
	});

	it('should check if string can decode to number', () => {
		expect(canDecode('42', 'number')).toBe(true);
		expect(canDecode('3.14', 'number')).toBe(true);
		expect(canDecode('abc', 'number')).toBe(false);
	});

	it('should always allow string', () => {
		expect(canDecode('anything', 'string')).toBe(true);
	});
});
