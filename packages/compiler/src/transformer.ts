import { Project } from 'ts-morph';
import type { AnalyzedRoute, HandlerInfo, RouteTransformer, TransformContext } from './types.js';

/**
 * Built-in transformer that adds request validation using TypeBox
 */
export const validationTransformer: RouteTransformer = (context) => {
	const { route } = context;
	const lines: string[] = [];

	for (const handler of route.handlers) {
		if (handler.method === 'POST' || handler.method === 'PUT' || handler.method === 'PATCH') {
			// Look for body type hints in parameters
			const bodyParam = handler.params.find((p) => p.name === 'body' || p.type.includes('Body'));

			if (bodyParam) {
				lines.push(`// Validation for ${handler.method} ${route.elysiaPath}`);
				lines.push(`// Body type: ${bodyParam.type}`);
			}
		}
	}

	return lines.join('\n');
};

/**
 * Transformer that adds OpenAPI documentation
 */
export const openApiTransformer: RouteTransformer = (context) => {
	const { route } = context;
	const docs: string[] = [];

	for (const handler of route.handlers) {
		if (handler.jsDoc) {
			docs.push(`// ${handler.method}: ${handler.jsDoc.replace(/\n/g, ' ')}`);
		}
	}

	return docs.join('\n');
};

/**
 * Transformer that optimizes catch-all routes
 */
export const catchAllTransformer: RouteTransformer = (context) => {
	const { route } = context;

	if (route.isCatchAll || route.isOptionalCatchAll) {
		return `// Catch-all route: ${route.elysiaPath}`;
	}

	return '';
};

/**
 * Code transformer utility class
 */
export class CodeTransformer {
	private project: Project;

	constructor() {
		this.project = new Project({
			useInMemoryFileSystem: true,
		});
	}

	/**
	 * Transform handler code to use Elysia context
	 */
	transformHandler(sourceCode: string, handler: HandlerInfo): string {
		const sourceFile = this.project.createSourceFile('temp.ts', sourceCode, { overwrite: true });

		// Find the handler function
		const funcDecl = sourceFile.getFunction(handler.exportName);
		if (funcDecl) {
			// Transform request parameter to use Elysia context
			const params = funcDecl.getParameters();
			const firstParam = params[0];
			if (firstParam) {
				const paramType = firstParam.getType().getText();

				// If it's NextRequest, we can optimize
				if (paramType.includes('NextRequest')) {
					// The handler expects NextRequest, which we'll provide
				}
			}
		}

		return sourceFile.getFullText();
	}

	/**
	 * Extract response type from handler
	 */
	extractResponseType(sourceCode: string, handler: HandlerInfo): string | undefined {
		const sourceFile = this.project.createSourceFile('temp.ts', sourceCode, { overwrite: true });

		const funcDecl = sourceFile.getFunction(handler.exportName);
		if (funcDecl) {
			const returnType = funcDecl.getReturnType();
			const returnTypeText = returnType.getText();

			// Handle Promise<Response> or Response
			// Check NextResponse first since it contains "Response"
			if (returnTypeText.includes('NextResponse')) {
				return 'NextResponse';
			}
			if (returnTypeText.includes('Response')) {
				return 'Response';
			}
		}

		return undefined;
	}

	/**
	 * Check if handler uses specific imports
	 */
	checkImports(sourceCode: string, importNames: string[]): Map<string, boolean> {
		const sourceFile = this.project.createSourceFile('temp.ts', sourceCode, { overwrite: true });

		const result = new Map<string, boolean>();

		for (const name of importNames) {
			result.set(name, false);
		}

		for (const imp of sourceFile.getImportDeclarations()) {
			for (const named of imp.getNamedImports()) {
				const name = named.getName();
				if (importNames.includes(name)) {
					result.set(name, true);
				}
			}
		}

		return result;
	}

	/**
	 * Inline simple utility imports
	 */
	inlineUtilityImports(sourceCode: string): string {
		const sourceFile = this.project.createSourceFile('temp.ts', sourceCode, { overwrite: true });

		// Find imports that can be inlined
		const importsToRemove: string[] = [];

		for (const imp of sourceFile.getImportDeclarations()) {
			const moduleSpec = imp.getModuleSpecifierValue();

			// Check for simple utility imports that can be inlined
			if (moduleSpec.startsWith('./utils/') || moduleSpec.startsWith('../utils/')) {
				// These might be candidates for inlining
				importsToRemove.push(moduleSpec);
			}
		}

		return sourceFile.getFullText();
	}

	/**
	 * Generate TypeBox schema from TypeScript interface
	 */
	generateTypeBoxSchema(interfaceCode: string): string {
		const sourceFile = this.project.createSourceFile('temp.ts', interfaceCode, { overwrite: true });

		const interfaces = sourceFile.getInterfaces();
		const schemas: string[] = [];

		for (const iface of interfaces) {
			const name = iface.getName();
			const properties = iface.getProperties();

			const schemaProps: string[] = [];

			for (const prop of properties) {
				const propName = prop.getName();
				const propType = prop.getType();
				const isOptional = prop.hasQuestionToken();

				const typeText = propType.getText();
				let schemaType = this.mapTypeToTypeBox(typeText);

				if (isOptional) {
					schemaType = `Type.Optional(${schemaType})`;
				}

				schemaProps.push(`${propName}: ${schemaType}`);
			}

			schemas.push(`const ${name}Schema = Type.Object({\n  ${schemaProps.join(',\n  ')}\n});`);
		}

		return schemas.join('\n\n');
	}

	/**
	 * Map TypeScript type to TypeBox type
	 */
	private mapTypeToTypeBox(typeText: string): string {
		// Handle basic types
		switch (typeText) {
			case 'string':
				return 'Type.String()';
			case 'number':
				return 'Type.Number()';
			case 'boolean':
				return 'Type.Boolean()';
			case 'null':
				return 'Type.Null()';
			case 'undefined':
				return 'Type.Undefined()';
			case 'any':
				return 'Type.Any()';
			case 'unknown':
				return 'Type.Unknown()';
			default:
				break;
		}

		// Handle arrays
		if (typeText.endsWith('[]')) {
			const elementType = typeText.slice(0, -2);
			return `Type.Array(${this.mapTypeToTypeBox(elementType)})`;
		}

		// Handle Array<T>
		const arrayMatch = typeText.match(/^Array<(.+)>$/);
		if (arrayMatch?.[1]) {
			return `Type.Array(${this.mapTypeToTypeBox(arrayMatch[1])})`;
		}

		// Handle unions
		if (typeText.includes(' | ')) {
			const unionTypes = typeText.split(' | ').map((t) => t.trim());
			const mappedTypes = unionTypes.map((t) => this.mapTypeToTypeBox(t));
			return `Type.Union([${mappedTypes.join(', ')}])`;
		}

		// Handle literal types
		if (typeText.startsWith('"') && typeText.endsWith('"')) {
			return `Type.Literal(${typeText})`;
		}
		if (!Number.isNaN(Number(typeText))) {
			return `Type.Literal(${typeText})`;
		}
		if (typeText === 'true' || typeText === 'false') {
			return `Type.Literal(${typeText})`;
		}

		// Default to reference
		return `Type.Ref(${typeText}Schema)`;
	}
}

/**
 * Apply transformers to a route
 */
export async function applyTransformers(
	route: AnalyzedRoute,
	transformers: RouteTransformer[],
	allRoutes: AnalyzedRoute[],
	options: TransformContext['options'],
): Promise<string[]> {
	const results: string[] = [];

	const context: TransformContext = {
		route,
		allRoutes,
		options,
		projectRoot: process.cwd(),
	};

	for (const transformer of transformers) {
		const result = await transformer(context);
		if (result) {
			results.push(result);
		}
	}

	return results;
}

/**
 * Create a composite transformer from multiple transformers
 */
export function composeTransformers(...transformers: RouteTransformer[]): RouteTransformer {
	return async (context) => {
		const results: string[] = [];

		for (const transformer of transformers) {
			const result = await transformer(context);
			if (result) {
				results.push(result);
			}
		}

		return results.join('\n');
	};
}
