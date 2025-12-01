import { EnvParseError } from './errors.js';
import type { ParsedEnv } from './types.js';

// ============================================================================
// Parser State
// ============================================================================

interface ParserState {
	/** Current position in source */
	pos: number;
	/** Current line number (1-indexed) */
	line: number;
	/** Current column number (1-indexed) */
	column: number;
	/** Source content */
	source: string;
	/** Source file path (for error messages) */
	filePath: string;
}

// ============================================================================
// Character Utilities
// ============================================================================

const CHAR_NEWLINE = 10; // \n
const CHAR_CARRIAGE = 13; // \r
const CHAR_SPACE = 32; // ' '
const CHAR_TAB = 9; // \t
const CHAR_HASH = 35; // #
const CHAR_EQUALS = 61; // =
const CHAR_COLON = 58; // :
const CHAR_SINGLE_QUOTE = 39; // '
const CHAR_DOUBLE_QUOTE = 34; // "
const CHAR_BACKTICK = 96; // `
const CHAR_BACKSLASH = 92; // \
const CHAR_DOLLAR = 36; // $
const CHAR_OPEN_BRACE = 123; // {
const CHAR_CLOSE_BRACE = 125; // }
const CHAR_UNDERSCORE = 95; // _
const CHAR_SLASH = 47; // /

/**
 * Check if character is whitespace (excluding newlines).
 */
function isHorizontalWhitespace(char: number): boolean {
	return char === CHAR_SPACE || char === CHAR_TAB;
}

/**
 * Check if character is a newline.
 */
function isNewline(char: number): boolean {
	return char === CHAR_NEWLINE || char === CHAR_CARRIAGE;
}

/**
 * Check if character can start a variable name.
 */
function isVarNameStart(char: number): boolean {
	return (
		(char >= 65 && char <= 90) || // A-Z
		(char >= 97 && char <= 122) || // a-z
		char === CHAR_UNDERSCORE
	);
}

/**
 * Check if character can be part of a variable name.
 */
function isVarNameChar(char: number): boolean {
	return (
		isVarNameStart(char) ||
		(char >= 48 && char <= 57) || // 0-9
		char === 45 || // -
		char === 46 // .
	);
}

// ============================================================================
// Parser Implementation
// ============================================================================

/**
 * Create a new parser state.
 */
function createState(source: string, filePath: string): ParserState {
	return {
		pos: 0,
		line: 1,
		column: 1,
		source,
		filePath,
	};
}

/**
 * Get current character code.
 */
function peek(state: ParserState): number {
	return state.source.charCodeAt(state.pos);
}

/**
 * Get character code at offset from current position.
 */
function peekAt(state: ParserState, offset: number): number {
	return state.source.charCodeAt(state.pos + offset);
}

/**
 * Check if at end of source.
 */
function isEof(state: ParserState): boolean {
	return state.pos >= state.source.length;
}

/**
 * Advance position by one character.
 */
function advance(state: ParserState): void {
	const char = peek(state);
	state.pos++;

	if (char === CHAR_NEWLINE) {
		state.line++;
		state.column = 1;
	} else if (char === CHAR_CARRIAGE) {
		// Handle \r\n as single newline
		if (peek(state) === CHAR_NEWLINE) {
			state.pos++;
		}
		state.line++;
		state.column = 1;
	} else {
		state.column++;
	}
}

/**
 * Skip horizontal whitespace.
 */
function skipWhitespace(state: ParserState): void {
	while (!isEof(state) && isHorizontalWhitespace(peek(state))) {
		advance(state);
	}
}

/**
 * Skip to end of line (for comments).
 */
function skipToEndOfLine(state: ParserState): void {
	while (!isEof(state) && !isNewline(peek(state))) {
		advance(state);
	}
}

/**
 * Skip a newline character (or CRLF sequence).
 */
function skipNewline(state: ParserState): void {
	const char = peek(state);
	if (char === CHAR_CARRIAGE) {
		advance(state);
		if (peek(state) === CHAR_NEWLINE) {
			advance(state);
		}
	} else if (char === CHAR_NEWLINE) {
		advance(state);
	}
}

/**
 * Parse a variable name.
 */
function parseKey(state: ParserState): string {
	const startLine = state.line;
	const startColumn = state.column;
	const _startPos = state.pos;

	// Skip optional 'export' keyword
	if (state.source.slice(state.pos, state.pos + 6) === 'export') {
		const afterExport = state.source.charCodeAt(state.pos + 6);
		if (isHorizontalWhitespace(afterExport)) {
			state.pos += 6;
			state.column += 6;
			skipWhitespace(state);
		}
	}

	// Variable name must start with letter or underscore
	if (!isVarNameStart(peek(state))) {
		throw new EnvParseError('Invalid variable name: expected letter or underscore', {
			filePath: state.filePath,
			line: startLine,
			column: startColumn,
		});
	}

	const keyStart = state.pos;
	while (!isEof(state) && isVarNameChar(peek(state))) {
		advance(state);
	}

	return state.source.slice(keyStart, state.pos);
}

/**
 * Parse escape sequence in double-quoted string.
 */
function parseEscapeSequence(state: ParserState): string {
	advance(state); // skip backslash
	if (isEof(state)) {
		return '\\';
	}

	const char = peek(state);
	advance(state);

	switch (char) {
		case 110:
			return '\n'; // \n
		case 114:
			return '\r'; // \r
		case 116:
			return '\t'; // \t
		case 92:
			return '\\'; // \\
		case 34:
			return '"'; // \"
		case 39:
			return "'"; // \'
		case 96:
			return '`'; // \`
		case 36:
			return '$'; // \$
		default:
			// Unknown escape, return as-is
			return `\\${String.fromCharCode(char)}`;
	}
}

/**
 * Parse a quoted string value.
 */
function parseQuotedValue(state: ParserState, quote: number, env: ParsedEnv): string {
	advance(state); // skip opening quote
	let value = '';

	while (!isEof(state)) {
		const char = peek(state);

		// Closing quote
		if (char === quote) {
			advance(state);
			return value;
		}

		// Escape sequences (only in double quotes)
		if (char === CHAR_BACKSLASH && quote === CHAR_DOUBLE_QUOTE) {
			value += parseEscapeSequence(state);
			continue;
		}

		// Variable expansion (in double quotes and backticks)
		if (char === CHAR_DOLLAR && quote !== CHAR_SINGLE_QUOTE) {
			value += parseVariableReference(state, env);
			continue;
		}

		// Newlines are allowed in quoted strings
		if (char === CHAR_CARRIAGE) {
			advance(state);
			if (peek(state) === CHAR_NEWLINE) {
				advance(state);
			}
			value += '\n';
			continue;
		}
		if (char === CHAR_NEWLINE) {
			advance(state);
			value += '\n';
			continue;
		}

		// Regular character
		value += String.fromCharCode(char);
		advance(state);
	}

	// Unclosed quote
	throw new EnvParseError(
		`Unclosed ${quote === CHAR_SINGLE_QUOTE ? 'single' : quote === CHAR_DOUBLE_QUOTE ? 'double' : 'backtick'} quote`,
		{
			filePath: state.filePath,
			line: state.line,
			column: state.column,
		},
	);
}

/**
 * Parse an unquoted value.
 */
function parseUnquotedValue(state: ParserState, env: ParsedEnv): string {
	let value = '';
	let lastChar: number | undefined;

	while (!isEof(state)) {
		const char = peek(state);

		// End of value
		if (isNewline(char)) {
			break;
		}

		// Comment with # always starts a comment
		if (char === CHAR_HASH) {
			break;
		}

		// // only starts a comment if preceded by whitespace (not in URLs)
		if (char === CHAR_SLASH && peekAt(state, 1) === CHAR_SLASH) {
			if (lastChar === undefined || isHorizontalWhitespace(lastChar)) {
				break;
			}
		}

		// Variable expansion
		if (char === CHAR_DOLLAR) {
			value += parseVariableReference(state, env);
			lastChar = char;
			continue;
		}

		// Regular character
		value += String.fromCharCode(char);
		lastChar = char;
		advance(state);
	}

	// Trim trailing whitespace from unquoted values
	return value.trimEnd();
}

/**
 * Parse a variable reference ($VAR or ${VAR}).
 */
function parseVariableReference(state: ParserState, env: ParsedEnv): string {
	advance(state); // skip $

	if (isEof(state)) {
		return '$';
	}

	const char = peek(state);

	// ${VAR} syntax
	if (char === CHAR_OPEN_BRACE) {
		advance(state);
		let varName = '';

		while (!isEof(state) && peek(state) !== CHAR_CLOSE_BRACE) {
			varName += String.fromCharCode(peek(state));
			advance(state);
		}

		if (peek(state) === CHAR_CLOSE_BRACE) {
			advance(state);
		}

		// Return value from env (already parsed vars) or process.env
		return env[varName] ?? process.env[varName] ?? '';
	}

	// $VAR syntax
	if (isVarNameStart(char)) {
		let varName = '';

		while (!isEof(state) && isVarNameChar(peek(state))) {
			varName += String.fromCharCode(peek(state));
			advance(state);
		}

		return env[varName] ?? process.env[varName] ?? '';
	}

	// Just a $ character
	return '$';
}

/**
 * Parse a value (quoted or unquoted).
 */
function parseValue(state: ParserState, env: ParsedEnv): string {
	skipWhitespace(state);

	if (isEof(state) || isNewline(peek(state))) {
		return '';
	}

	const char = peek(state);

	// Quoted value
	if (char === CHAR_SINGLE_QUOTE || char === CHAR_DOUBLE_QUOTE || char === CHAR_BACKTICK) {
		return parseQuotedValue(state, char, env);
	}

	// Unquoted value
	return parseUnquotedValue(state, env);
}

/**
 * Parse a single line (key=value or key: value).
 */
function parseLine(state: ParserState, env: ParsedEnv): void {
	skipWhitespace(state);

	// Empty line or comment
	if (isEof(state) || isNewline(peek(state))) {
		if (!isEof(state)) skipNewline(state);
		return;
	}

	// Comment line
	if (peek(state) === CHAR_HASH) {
		skipToEndOfLine(state);
		if (!isEof(state)) skipNewline(state);
		return;
	}

	// // comment
	if (peek(state) === CHAR_SLASH && peekAt(state, 1) === CHAR_SLASH) {
		skipToEndOfLine(state);
		if (!isEof(state)) skipNewline(state);
		return;
	}

	// Parse key
	const key = parseKey(state);

	skipWhitespace(state);

	// Expect = or :
	const sep = peek(state);
	if (sep !== CHAR_EQUALS && sep !== CHAR_COLON) {
		throw new EnvParseError(`Expected '=' or ':' after variable name '${key}'`, {
			filePath: state.filePath,
			line: state.line,
			column: state.column,
		});
	}
	advance(state);

	// Parse value
	const value = parseValue(state, env);

	// Store in env
	env[key] = value;

	// Skip to next line
	skipWhitespace(state);
	if (!isEof(state) && peek(state) === CHAR_HASH) {
		skipToEndOfLine(state);
	}
	if (!isEof(state)) skipNewline(state);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse an environment file string.
 *
 * @param source - The .env file content
 * @param filePath - Optional file path for error messages
 * @returns Parsed environment variables as a key-value object
 *
 * @example
 * ```ts
 * const content = `
 * DATABASE_URL="postgres://localhost/db"
 * PORT=3000
 * DEBUG=true
 * `;
 *
 * const env = parseEnvFile(content, '.env');
 * // { DATABASE_URL: 'postgres://localhost/db', PORT: '3000', DEBUG: 'true' }
 * ```
 */
export function parseEnvFile(source: string, filePath = '<inline>'): ParsedEnv {
	const state = createState(source, filePath);
	const env: ParsedEnv = {};

	while (!isEof(state)) {
		parseLine(state, env);
	}

	return env;
}

/**
 * Parse a single .env line.
 * Useful for incremental parsing or testing.
 *
 * @param line - A single line from a .env file
 * @param existingEnv - Existing environment for variable expansion
 * @returns Parsed key-value pair or null if line is empty/comment
 */
export function parseEnvLine(
	line: string,
	existingEnv: ParsedEnv = {},
): { key: string; value: string } | null {
	const trimmed = line.trim();

	// Empty or comment
	if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
		return null;
	}

	const state = createState(line, '<line>');
	const env = { ...existingEnv };

	try {
		parseLine(state, env);
	} catch {
		return null;
	}

	// Find the new key (not in existingEnv)
	for (const key of Object.keys(env)) {
		if (!(key in existingEnv)) {
			const value = env[key];
			if (value !== undefined) {
				return { key, value };
			}
		}
	}

	return null;
}

/**
 * Stringify environment variables to .env format.
 *
 * @param env - Environment variables to stringify
 * @param options - Stringification options
 * @returns .env formatted string
 */
export function stringifyEnvFile(
	env: ParsedEnv,
	options: {
		/** Sort keys alphabetically */
		sort?: boolean;
		/** Quote style for values that need quoting */
		quoteStyle?: 'single' | 'double';
		/** Add comment header */
		header?: string;
	} = {},
): string {
	const { sort = false, quoteStyle = 'double', header } = options;

	let keys = Object.keys(env);
	if (sort) {
		keys = keys.sort();
	}

	const lines: string[] = [];

	if (header) {
		lines.push(`# ${header}`);
		lines.push('');
	}

	const quote = quoteStyle === 'single' ? "'" : '"';

	for (const key of keys) {
		const value = env[key];
		if (value === undefined) continue;

		// Determine if quoting is needed
		const needsQuote =
			value.includes(' ') ||
			value.includes('\n') ||
			value.includes('\r') ||
			value.includes('#') ||
			value.includes('"') ||
			value.includes("'") ||
			value.includes('$') ||
			value.includes('=') ||
			value === '';

		if (needsQuote) {
			// Escape special characters
			let escaped = value
				.replace(/\\/g, '\\\\')
				.replace(/\n/g, '\\n')
				.replace(/\r/g, '\\r')
				.replace(/\t/g, '\\t');

			if (quoteStyle === 'double') {
				escaped = escaped.replace(/"/g, '\\"');
			} else {
				escaped = escaped.replace(/'/g, "\\'");
			}

			lines.push(`${key}=${quote}${escaped}${quote}`);
		} else {
			lines.push(`${key}=${value}`);
		}
	}

	return `${lines.join('\n')}\n`;
}
