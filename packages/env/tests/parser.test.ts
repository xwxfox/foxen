import { describe, expect, it } from 'bun:test';
import { parseEnvFile, parseEnvLine, stringifyEnvFile } from '../src/parser.js';

describe('parseEnvFile', () => {
	describe('basic parsing', () => {
		it('should parse simple key=value pairs', () => {
			const content = `
KEY1=value1
KEY2=value2
`;
			const result = parseEnvFile(content);
			expect(result).toEqual({
				KEY1: 'value1',
				KEY2: 'value2',
			});
		});

		it('should handle empty values', () => {
			const content = 'EMPTY=';
			const result = parseEnvFile(content);
			expect(result).toEqual({ EMPTY: '' });
		});

		it('should handle colon separator', () => {
			const content = 'KEY: value';
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'value' });
		});

		it('should handle export prefix', () => {
			const content = 'export DATABASE_URL=postgres://localhost';
			const result = parseEnvFile(content);
			expect(result).toEqual({ DATABASE_URL: 'postgres://localhost' });
		});
	});

	describe('quoted values', () => {
		it('should parse double-quoted values', () => {
			const content = `KEY="hello world"`;
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'hello world' });
		});

		it('should parse single-quoted values', () => {
			const content = `KEY='hello world'`;
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'hello world' });
		});

		it('should parse backtick-quoted values', () => {
			const content = 'KEY=`hello world`';
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'hello world' });
		});

		it('should handle quotes within quoted strings', () => {
			// Use regular string with proper escaping
			const content = 'KEY="it\'s a \\"test\\""';
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'it\'s a "test"' });
		});
	});

	describe('escape sequences', () => {
		it('should handle \\n in double quotes', () => {
			const content = `KEY="line1\\nline2"`;
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'line1\nline2' });
		});

		it('should handle \\t in double quotes', () => {
			const content = `KEY="col1\\tcol2"`;
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'col1\tcol2' });
		});

		it('should NOT process escapes in single quotes', () => {
			const content = `KEY='line1\\nline2'`;
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'line1\\nline2' });
		});
	});

	describe('comments', () => {
		it('should ignore # comments', () => {
			const content = `
# This is a comment
KEY=value
# Another comment
`;
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'value' });
		});

		it('should ignore // comments', () => {
			const content = `
// This is a comment
KEY=value
`;
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'value' });
		});

		it('should handle inline comments in unquoted values', () => {
			const content = 'KEY=value # inline comment';
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'value' });
		});

		it('should NOT treat # as comment in quoted values', () => {
			const content = `KEY="value # not a comment"`;
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'value # not a comment' });
		});
	});

	describe('multiline values', () => {
		it('should handle multiline in double quotes', () => {
			const content = `KEY="line1
line2
line3"`;
			const result = parseEnvFile(content);
			expect(result).toEqual({ KEY: 'line1\nline2\nline3' });
		});
	});

	describe('variable expansion', () => {
		it('should expand $VAR references', () => {
			const content = `
BASE=/home/user
PATH=$BASE/bin
`;
			const result = parseEnvFile(content);
			expect(result.PATH).toBe('/home/user/bin');
		});

		it('should expand ${VAR} references', () => {
			const content = `
NAME=world
GREETING="Hello, \${NAME}!"
`;
			const result = parseEnvFile(content);
			expect(result.GREETING).toBe('Hello, world!');
		});

		it('should NOT expand in single quotes', () => {
			const content = `
NAME=world
LITERAL='$NAME'
`;
			const result = parseEnvFile(content);
			expect(result.LITERAL).toBe('$NAME');
		});
	});

	describe('special characters', () => {
		it('should handle variable names with dots', () => {
			const content = 'app.config.key=value';
			const result = parseEnvFile(content);
			expect(result['app.config.key']).toBe('value');
		});

		it('should handle variable names with hyphens', () => {
			const content = 'my-key=value';
			const result = parseEnvFile(content);
			expect(result['my-key']).toBe('value');
		});
	});
});

describe('parseEnvLine', () => {
	it('should parse a single line', () => {
		const result = parseEnvLine('KEY=value');
		expect(result).toEqual({ key: 'KEY', value: 'value' });
	});

	it('should return null for comments', () => {
		expect(parseEnvLine('# comment')).toBeNull();
		expect(parseEnvLine('// comment')).toBeNull();
	});

	it('should return null for empty lines', () => {
		expect(parseEnvLine('')).toBeNull();
		expect(parseEnvLine('   ')).toBeNull();
	});
});

describe('stringifyEnvFile', () => {
	it('should stringify simple values', () => {
		const env = { KEY1: 'value1', KEY2: 'value2' };
		const result = stringifyEnvFile(env);
		expect(result).toContain('KEY1=value1');
		expect(result).toContain('KEY2=value2');
	});

	it('should quote values with spaces', () => {
		const env = { KEY: 'hello world' };
		const result = stringifyEnvFile(env);
		expect(result).toContain('KEY="hello world"');
	});

	it('should escape newlines in values', () => {
		const env = { KEY: 'line1\nline2' };
		const result = stringifyEnvFile(env);
		expect(result).toContain('KEY="line1\\nline2"');
	});

	it('should sort keys when requested', () => {
		const env = { ZEBRA: 'z', APPLE: 'a', MANGO: 'm' };
		const result = stringifyEnvFile(env, { sort: true });
		const lines = result.split('\n').filter(Boolean);
		expect(lines[0]).toContain('APPLE');
		expect(lines[1]).toContain('MANGO');
		expect(lines[2]).toContain('ZEBRA');
	});

	it('should add header comment when provided', () => {
		const env = { KEY: 'value' };
		const result = stringifyEnvFile(env, { header: 'My Config' });
		expect(result).toContain('# My Config');
	});
});
