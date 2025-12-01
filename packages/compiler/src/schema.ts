import type { HttpMethod } from '@foxen/core';
import {
	type ArrayLiteralExpression,
	type CallExpression,
	type Node,
	type ObjectLiteralExpression,
	type PropertyAssignment,
	type SourceFile,
	SyntaxKind,
} from 'ts-morph';

/**
 * Schema definition for a single HTTP method
 */
export interface MethodSchema {
	/** TypeBox params schema expression as string */
	params?: string;
	/** TypeBox query schema expression as string */
	query?: string;
	/** TypeBox body schema expression as string */
	body?: string;
	/** TypeBox response schema expression as string */
	response?: string;
	/** TypeBox headers schema expression as string */
	headers?: string;
	/** OpenAPI tags */
	tags?: string[];
	/** OpenAPI summary */
	summary?: string;
	/** OpenAPI description */
	description?: string;
	/** Custom detail object for OpenAPI */
	detail?: string;
}

/**
 * Full schema analysis for a route file
 */
export interface SchemaAnalysis {
	/** Whether a schema export was found */
	hasSchema: boolean;
	/** Per-method schema definitions */
	methods: Partial<Record<HttpMethod, MethodSchema>>;
	/** Raw schema source code (for complex cases) */
	rawSource?: string;
}

/**
 * Extract schema definition from a source file
 */
export function extractSchemaFromFile(sourceFile: SourceFile): SchemaAnalysis {
	const result: SchemaAnalysis = {
		hasSchema: false,
		methods: {},
	};

	// Look for `export const schema` or `export { schema }`
	for (const varStmt of sourceFile.getVariableStatements()) {
		if (!varStmt.isExported()) continue;

		for (const decl of varStmt.getDeclarations()) {
			if (decl.getName() !== 'schema') continue;

			result.hasSchema = true;
			const initializer = decl.getInitializer();
			if (!initializer) continue;

			// Store raw source for debugging
			result.rawSource = initializer.getText();

			// Handle defineSchema({...}) call
			if (initializer.getKind() === SyntaxKind.CallExpression) {
				const callExpr = initializer as CallExpression;
				const funcName = callExpr.getExpression().getText();

				if (funcName === 'defineSchema') {
					const args = callExpr.getArguments();
					if (args[0]?.getKind() === SyntaxKind.ObjectLiteralExpression) {
						parseSchemaObject(args[0] as ObjectLiteralExpression, result);
					}
				}
			}
			// Handle direct object literal
			else if (initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
				parseSchemaObject(initializer as ObjectLiteralExpression, result);
			}
		}
	}

	return result;
}

/**
 * Parse a schema object literal into structured data
 */
function parseSchemaObject(obj: ObjectLiteralExpression, result: SchemaAnalysis): void {
	const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

	for (const prop of obj.getProperties()) {
		if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue;

		const propAssign = prop as PropertyAssignment;
		const name = propAssign.getName();

		// Check if this is an HTTP method
		if (httpMethods.includes(name as HttpMethod)) {
			const methodSchema = parseMethodSchema(propAssign);
			if (methodSchema) {
				result.methods[name as HttpMethod] = methodSchema;
			}
		}
	}
}

/**
 * Parse a single method's schema definition
 */
function parseMethodSchema(prop: PropertyAssignment): MethodSchema | null {
	const initializer = prop.getInitializer();
	if (!initializer) return null;

	if (initializer.getKind() !== SyntaxKind.ObjectLiteralExpression) {
		return null;
	}

	const obj = initializer as ObjectLiteralExpression;
	const schema: MethodSchema = {};

	for (const methodProp of obj.getProperties()) {
		if (methodProp.getKind() !== SyntaxKind.PropertyAssignment) continue;

		const propAssign = methodProp as PropertyAssignment;
		const propName = propAssign.getName();
		const propInit = propAssign.getInitializer();

		if (!propInit) continue;

		switch (propName) {
			case 'params':
			case 'query':
			case 'body':
			case 'response':
			case 'headers':
				// Store the TypeBox expression as a string
				schema[propName] = propInit.getText();
				break;

			case 'tags':
				// Parse array of strings
				if (propInit.getKind() === SyntaxKind.ArrayLiteralExpression) {
					const arr = propInit as ArrayLiteralExpression;
					schema.tags = arr
						.getElements()
						.map((e) => extractStringValue(e))
						.filter((s): s is string => s !== undefined);
				}
				break;

			case 'summary':
			case 'description': {
				// Parse string value
				const strValue = extractStringValue(propInit);
				if (strValue) {
					schema[propName] = strValue;
				}
				break;
			}

			case 'detail':
				// Keep the whole detail object as-is
				schema.detail = propInit.getText();
				break;
		}
	}

	return Object.keys(schema).length > 0 ? schema : null;
}

/**
 * Extract a string value from a node
 */
function extractStringValue(node: Node): string | undefined {
	if (node.getKind() === SyntaxKind.StringLiteral) {
		// Remove quotes
		const text = node.getText();
		return text.slice(1, -1);
	}
	if (node.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
		// Template literal without substitutions
		const text = node.getText();
		return text.slice(1, -1);
	}
	return undefined;
}

/**
 * Generate Elysia schema options from a MethodSchema
 */
export function generateSchemaOptions(schema: MethodSchema): string {
	const parts: string[] = [];

	// Validation schemas
	if (schema.params) {
		parts.push(`params: ${schema.params}`);
	}
	if (schema.query) {
		parts.push(`query: ${schema.query}`);
	}
	if (schema.body) {
		parts.push(`body: ${schema.body}`);
	}
	if (schema.response) {
		parts.push(`response: ${schema.response}`);
	}
	if (schema.headers) {
		parts.push(`headers: ${schema.headers}`);
	}

	// OpenAPI detail
	const detailParts: string[] = [];
	if (schema.tags && schema.tags.length > 0) {
		detailParts.push(`tags: [${schema.tags.map((t) => `"${t}"`).join(', ')}]`);
	}
	if (schema.summary) {
		detailParts.push(`summary: "${escapeString(schema.summary)}"`);
	}
	if (schema.description) {
		detailParts.push(`description: "${escapeString(schema.description)}"`);
	}

	if (detailParts.length > 0) {
		parts.push(`detail: { ${detailParts.join(', ')} }`);
	} else if (schema.detail) {
		// Use raw detail object if provided
		parts.push(`detail: ${schema.detail}`);
	}

	return parts.join(',\n');
}

/**
 * Escape a string for use in generated code
 */
function escapeString(str: string): string {
	return str
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r')
		.replace(/\t/g, '\\t');
}

/**
 * Generate auto params schema from path parameters
 *
 * @param params - Array of parameter names from the route path
 * @param isCatchAll - Whether this is a catch-all route
 */
export function generateParamsSchema(params: string[], isCatchAll = false): string {
	if (params.length === 0) return '';

	const properties = params.map((param) => {
		if (isCatchAll) {
			// Catch-all params are arrays
			return `${param}: t.Array(t.String())`;
		}
		return `${param}: t.String()`;
	});

	return `t.Object({ ${properties.join(', ')} })`;
}

/**
 * Infer response type from handler analysis (basic implementation)
 *
 * This is a simplified inference - full inference would require type checking.
 */
export function inferBasicResponseType(
	sourceFile: SourceFile,
	_methodName: string,
): string | undefined {
	// Look for NextResponse.json() calls
	const text = sourceFile.getFullText();

	// Simple pattern matching for common patterns
	// This is not comprehensive but handles common cases

	// Pattern: NextResponse.json({ key: value })
	const jsonPattern = /NextResponse\.json\(\s*(\{[^}]+\})/g;
	const matches = text.matchAll(jsonPattern);

	for (const _match of matches) {
		// Found a json response, but we can't easily infer the full type
		// Return a generic marker
		return '/* inferred from NextResponse.json */';
	}

	return undefined;
}

/**
 * Check if a schema requires TypeBox import
 */
export function requiresTypeBox(schema: SchemaAnalysis): boolean {
	for (const method of Object.values(schema.methods)) {
		if (method.params || method.query || method.body || method.response || method.headers) {
			return true;
		}
	}
	return false;
}

/**
 * Extract all TypeBox type references from schema
 * Useful for knowing what to import from TypeBox
 */
export function extractTypeBoxReferences(schema: SchemaAnalysis): Set<string> {
	const refs = new Set<string>();

	// Common TypeBox methods to detect
	const typeBoxMethods = [
		't.Object',
		't.String',
		't.Number',
		't.Boolean',
		't.Array',
		't.Optional',
		't.Literal',
		't.Union',
		't.Intersect',
		't.Record',
		't.Enum',
		't.Null',
		't.Any',
		't.Unknown',
		't.Void',
		't.Never',
		't.Date',
		't.RegExp',
		't.Integer',
		't.Tuple',
	];

	for (const method of Object.values(schema.methods)) {
		const texts = [
			method.params,
			method.query,
			method.body,
			method.response,
			method.headers,
		].filter(Boolean);

		for (const text of texts) {
			for (const tbMethod of typeBoxMethods) {
				if (text?.includes(tbMethod)) {
					refs.add(tbMethod);
				}
			}
		}
	}

	return refs;
}
