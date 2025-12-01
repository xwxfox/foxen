import type { InferredType } from './types.js';

// ============================================================================
// Type Patterns
// ============================================================================

/**
 * Pattern for boolean values.
 */
const BOOLEAN_PATTERN = /^(true|false|yes|no|on|off|1|0)$/i;

/**
 * Pattern for integer values.
 */
const INTEGER_PATTERN = /^-?\d+$/;

/**
 * Pattern for number values (including floats).
 */
const NUMBER_PATTERN = /^-?\d+\.?\d*(?:e[+-]?\d+)?$/i;

/**
 * Common boolean true values.
 */
const BOOLEAN_TRUE_VALUES = new Set([
	'true',
	'yes',
	'on',
	'1',
	'TRUE',
	'YES',
	'ON',
	'True',
	'Yes',
	'On',
]);

/**
 * Common boolean false values.
 */
const _BOOLEAN_FALSE_VALUES = new Set([
	'false',
	'no',
	'off',
	'0',
	'FALSE',
	'NO',
	'OFF',
	'False',
	'No',
	'Off',
]);

// ============================================================================
// Type Inference
// ============================================================================

/**
 * Infer the type of an environment variable value.
 *
 * Rules:
 * 1. "true"/"false"/"yes"/"no"/"on"/"off"/"1"/"0" → boolean
 * 2. Integer pattern (-?\d+) → integer
 * 3. Number pattern (-?\d+\.?\d*) → number
 * 4. Everything else → string
 *
 * @param value - The raw string value
 * @returns The inferred type
 *
 * @example
 * ```ts
 * inferType("true")     // "boolean"
 * inferType("42")       // "integer"
 * inferType("3.14")     // "number"
 * inferType("hello")    // "string"
 * ```
 */
export function inferType(value: string): InferredType {
	// Empty string is always a string
	if (value === '') {
		return 'string';
	}

	// Check for boolean
	if (BOOLEAN_PATTERN.test(value)) {
		return 'boolean';
	}

	// Check for integer (before number to be more specific)
	if (INTEGER_PATTERN.test(value)) {
		// Validate it's within safe integer range
		const num = Number.parseInt(value, 10);
		if (Number.isSafeInteger(num)) {
			return 'integer';
		}
		// Large integers treated as strings to preserve precision
		return 'string';
	}

	// Check for number (float)
	if (NUMBER_PATTERN.test(value)) {
		const num = Number.parseFloat(value);
		if (!Number.isNaN(num) && Number.isFinite(num)) {
			return 'number';
		}
	}

	// Default to string
	return 'string';
}

/**
 * Get the TypeScript type string for an inferred type.
 *
 * @param type - The inferred type
 * @returns TypeScript type string
 */
export function toTypeScriptType(type: InferredType): string {
	switch (type) {
		case 'boolean':
			return 'boolean';
		case 'integer':
		case 'number':
			return 'number';
		default:
			return 'string';
	}
}

/**
 * Get the TypeBox type method name for an inferred type.
 *
 * @param type - The inferred type
 * @returns TypeBox type method (e.g., "String", "Boolean")
 */
export function toTypeBoxMethod(type: InferredType): string {
	switch (type) {
		case 'boolean':
			return 'Boolean';
		case 'integer':
			return 'Integer';
		case 'number':
			return 'Number';
		default:
			return 'String';
	}
}

// ============================================================================
// Value Decoding
// ============================================================================

/**
 * Decode a string value to its inferred type.
 *
 * @param value - The raw string value
 * @param type - The inferred type
 * @returns The decoded value
 *
 * @example
 * ```ts
 * decodeValue("true", "boolean")  // true
 * decodeValue("42", "integer")    // 42
 * decodeValue("3.14", "number")   // 3.14
 * decodeValue("hello", "string")  // "hello"
 * ```
 */
export function decodeValue(value: string, type: InferredType): string | number | boolean {
	switch (type) {
		case 'boolean':
			return BOOLEAN_TRUE_VALUES.has(value);

		case 'integer':
			return Number.parseInt(value, 10);

		case 'number':
			return Number.parseFloat(value);

		default:
			return value;
	}
}

/**
 * Encode a typed value back to a string.
 *
 * @param value - The typed value
 * @returns The string representation
 */
export function encodeValue(value: unknown): string {
	if (value === null || value === undefined) {
		return '';
	}
	return String(value);
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Infer types for all values in a parsed environment.
 *
 * @param env - Parsed environment variables
 * @param overrides - Type overrides for specific variables
 * @returns Map of variable names to inferred types
 */
export function inferTypes(
	env: Record<string, string>,
	overrides: Record<string, InferredType> = {},
): Map<string, InferredType> {
	const types = new Map<string, InferredType>();

	for (const [key, value] of Object.entries(env)) {
		// Use override if provided, otherwise infer
		const type = overrides[key] ?? inferType(value);
		types.set(key, type);
	}

	return types;
}

/**
 * Decode all values in a parsed environment according to their inferred types.
 *
 * @param env - Parsed environment variables (strings)
 * @param types - Type map from inferTypes()
 * @returns Decoded environment with typed values
 */
export function decodeEnv(
	env: Record<string, string>,
	types: Map<string, InferredType>,
): Record<string, string | number | boolean> {
	const decoded: Record<string, string | number | boolean> = {};

	for (const [key, value] of Object.entries(env)) {
		const type = types.get(key) ?? 'string';
		decoded[key] = decodeValue(value, type);
	}

	return decoded;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value matches its expected type.
 *
 * @param value - The value to check (already decoded)
 * @param type - The expected type
 * @returns Whether the value matches the type
 */
export function validateType(value: unknown, type: InferredType): boolean {
	switch (type) {
		case 'boolean':
			return typeof value === 'boolean';

		case 'integer':
			return typeof value === 'number' && Number.isInteger(value);

		case 'number':
			return typeof value === 'number' && !Number.isNaN(value);

		case 'string':
			return typeof value === 'string';

		default:
			return true;
	}
}

/**
 * Check if a string value can be decoded to the expected type.
 *
 * @param value - The raw string value
 * @param type - The expected type
 * @returns Whether the value can be decoded to the type
 */
export function canDecode(value: string, type: InferredType): boolean {
	switch (type) {
		case 'boolean': {
			return BOOLEAN_PATTERN.test(value);
		}

		case 'integer': {
			if (!INTEGER_PATTERN.test(value)) return false;
			const int = Number.parseInt(value, 10);
			return Number.isSafeInteger(int);
		}

		case 'number': {
			if (!NUMBER_PATTERN.test(value)) return false;
			const num = Number.parseFloat(value);
			return !Number.isNaN(num) && Number.isFinite(num);
		}

		case 'string':
			return true;

		default:
			return true;
	}
}
