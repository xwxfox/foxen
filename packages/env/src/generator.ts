import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	IndentationText,
	Project,
	QuoteKind,
	type SourceFile,
	VariableDeclarationKind,
} from 'ts-morph';
import { toTypeScriptType } from './inference.js';
import { loadEnvFiles, resolveConfig } from './loader.js';
import type {
	EnvConfig,
	EnvVariableMap,
	GeneratedFile,
	GenerationResult,
	InferredType,
} from './types.js';

// ============================================================================
// Project Configuration
// ============================================================================

/**
 * Create a ts-morph project with our preferred settings.
 */
function createProject(): Project {
	return new Project({
		manipulationSettings: {
			indentationText: IndentationText.Tab,
			quoteKind: QuoteKind.Double,
			useTrailingCommas: true,
		},
		compilerOptions: {
			strict: true,
			declaration: true,
		},
	});
}

// ============================================================================
// Schema Generator
// ============================================================================

/**
 * Generate the TypeBox schema file.
 *
 * Output: env.schema.ts
 * ```ts
 * import { Type, type Static } from "@sinclair/typebox";
 *
 * export const EnvSchema = Type.Object({
 *   DATABASE_URL: Type.String(),
 *   PORT: Type.Transform(Type.String())
 *     .Decode((v) => parseInt(v, 10))
 *     .Encode((v) => String(v)),
 *   DEBUG: Type.Transform(Type.String())
 *     .Decode((v) => v === "true")
 *     .Encode((v) => String(v)),
 * });
 *
 * export type EnvSchemaType = Static<typeof EnvSchema>;
 * ```
 */
function generateSchemaFile(project: Project, variables: EnvVariableMap): SourceFile {
	const sourceFile = project.createSourceFile('env.schema.ts', '', { overwrite: true });

	// Header comment
	sourceFile.addStatements([
		'/**',
		' * @foxen/env - Generated Environment Schema',
		' * ',
		' * This file is auto-generated. Do not edit manually.',
		' * Regenerate with: foxen env generate',
		' */',
		'',
	]);

	// Import TypeBox
	sourceFile.addImportDeclaration({
		moduleSpecifier: '@sinclair/typebox',
		namedImports: [{ name: 'Type' }, { name: 'Static', isTypeOnly: true }],
	});

	sourceFile.addStatements('');

	// Generate schema object
	const schemaProperties: string[] = [];

	for (const [name, variable] of variables) {
		const property = generateSchemaProperty(name, variable.inferredType);
		schemaProperties.push(property);
	}

	// Create the schema variable
	sourceFile.addVariableStatement({
		isExported: true,
		declarationKind: VariableDeclarationKind.Const,
		declarations: [
			{
				name: 'EnvSchema',
				initializer: (writer) => {
					writer.write('Type.Object({');
					writer.newLine();

					for (let i = 0; i < schemaProperties.length; i++) {
						const prop = schemaProperties[i];
						if (!prop) continue;
						writer.indent(() => {
							writer.write(prop);
							if (i < schemaProperties.length - 1) {
								writer.write(',');
							}
						});
						writer.newLine();
					}

					writer.write('})');
				},
			},
		],
	});

	sourceFile.addStatements('');

	// Export type alias
	sourceFile.addTypeAlias({
		isExported: true,
		name: 'EnvSchemaType',
		type: 'Static<typeof EnvSchema>',
	});

	return sourceFile;
}

/**
 * Generate a single schema property.
 */
function generateSchemaProperty(name: string, type: InferredType): string {
	switch (type) {
		case 'boolean':
			return `${name}: Type.Transform(Type.String())
		.Decode((v) => v === "true" || v === "1" || v === "yes" || v === "on")
		.Encode((v) => String(v))`;

		case 'integer':
			return `${name}: Type.Transform(Type.String())
		.Decode((v) => parseInt(v, 10))
		.Encode((v) => String(v))`;

		case 'number':
			return `${name}: Type.Transform(Type.String())
		.Decode((v) => parseFloat(v))
		.Encode((v) => String(v))`;

		default:
			return `${name}: Type.String()`;
	}
}

// ============================================================================
// Declaration Generator (process.env augmentation)
// ============================================================================

/**
 * Generate the process.env type declaration file.
 *
 * Output: env.d.ts
 * ```ts
 * declare global {
 *   namespace NodeJS {
 *     interface ProcessEnv {
 *       readonly DATABASE_URL: string;
 *       readonly PORT: string;
 *       readonly DEBUG: string;
 *     }
 *   }
 * }
 *
 * export {};
 * ```
 */
function generateDeclarationFile(project: Project, variables: EnvVariableMap): SourceFile {
	// Build the interface properties
	const properties: string[] = [];
	for (const [name] of variables) {
		// process.env always contains strings
		properties.push(`\t\t\treadonly ${name}: string;`);
	}

	// Build the full content as a string
	const content = `/**
 * @foxen/env - Generated Environment Types
 * 
 * This file augments NodeJS.ProcessEnv with your environment variables.
 * All values are typed as string since process.env only contains strings.
 * 
 * This file is auto-generated. Do not edit manually.
 * Regenerate with: foxen env generate
 */

declare global {
\tnamespace NodeJS {
\t\tinterface ProcessEnv {
${properties.join('\n')}
\t\t}
\t}
}

export {};
`;

	const sourceFile = project.createSourceFile('env.d.ts', content, { overwrite: true });

	return sourceFile;
}

// ============================================================================
// Types Generator (Env interface)
// ============================================================================

/**
 * Generate the typed Env interface file.
 *
 * Output: env.types.ts
 * ```ts
 * export interface Env {
 *   readonly DATABASE_URL: string;
 *   readonly PORT: number;
 *   readonly DEBUG: boolean;
 * }
 *
 * export type EnvKey = keyof Env;
 * ```
 */
function generateTypesFile(project: Project, variables: EnvVariableMap): SourceFile {
	const sourceFile = project.createSourceFile('env.types.ts', '', { overwrite: true });

	// Header comment
	sourceFile.addStatements([
		'/**',
		' * @foxen/env - Generated Environment Interface',
		' * ',
		' * This interface provides typed access to environment variables.',
		' * Unlike process.env, values are properly typed based on inference.',
		' * ',
		' * This file is auto-generated. Do not edit manually.',
		' * Regenerate with: foxen env generate',
		' */',
		'',
	]);

	// Build interface properties
	const interfaceProps: Array<{ name: string; type: string; isReadonly: true }> = [];
	for (const [name, variable] of variables) {
		interfaceProps.push({
			name,
			type: toTypeScriptType(variable.inferredType),
			isReadonly: true,
		});
	}

	// Create Env interface
	sourceFile.addInterface({
		isExported: true,
		name: 'Env',
		properties: interfaceProps,
	});

	sourceFile.addStatements('');

	// Create EnvKey type
	sourceFile.addTypeAlias({
		isExported: true,
		name: 'EnvKey',
		type: 'keyof Env',
	});

	sourceFile.addStatements('');

	// Create EnvValue type
	sourceFile.addTypeAlias({
		isExported: true,
		name: 'EnvValue',
		type: 'Env[EnvKey]',
	});

	return sourceFile;
}

// ============================================================================
// Runtime Generator
// ============================================================================

/**
 * Generate the runtime environment accessor module.
 *
 * This module provides the actual `env` object that users import.
 * It's designed to work with the schema for validation.
 *
 * Output: env.runtime.ts
 */
function generateRuntimeFile(project: Project, variables: EnvVariableMap): SourceFile {
	const sourceFile = project.createSourceFile('env.runtime.ts', '', { overwrite: true });

	// Header comment
	sourceFile.addStatements([
		'/**',
		' * @foxen/env - Generated Runtime Environment',
		' * ',
		' * This module provides type-safe environment variable access.',
		" * Import and use like: import { env } from './.foxen/env.runtime';",
		' * ',
		' * This file is auto-generated. Do not edit manually.',
		' * Regenerate with: foxen env generate',
		' */',
		'',
	]);

	// Import the schema
	sourceFile.addImportDeclaration({
		moduleSpecifier: './env.schema.js',
		namedImports: [{ name: 'EnvSchema' }],
	});

	// Import the types
	sourceFile.addImportDeclaration({
		moduleSpecifier: './env.types.js',
		namedImports: [{ name: 'Env', isTypeOnly: true }],
	});

	// Import TypeBox Value for validation
	sourceFile.addImportDeclaration({
		moduleSpecifier: '@sinclair/typebox/value',
		namedImports: [{ name: 'Value' }],
	});

	sourceFile.addStatements('');

	// Internal state
	sourceFile.addStatements([
		'// Internal state',
		'let _initialized = false;',
		'let _decoded: Record<string, unknown> = {};',
		'',
	]);

	// Initialize function
	sourceFile.addFunction({
		isExported: true,
		name: 'initializeEnv',
		parameters: [],
		returnType: 'void',
		statements: (writer) => {
			writer.writeLine('if (_initialized) return;');
			writer.blankLine();
			writer.writeLine('// Collect raw values from process.env');
			writer.writeLine('const raw: Record<string, string> = {};');

			// Generate property access for each variable
			for (const [name] of variables) {
				writer.writeLine(
					`if (process.env.${name} !== undefined) raw.${name} = process.env.${name};`,
				);
			}

			writer.blankLine();
			writer.writeLine('// Decode with schema validation');
			writer.writeLine('_decoded = Value.Decode(EnvSchema, raw);');
			writer.writeLine('_initialized = true;');
		},
	});

	sourceFile.addStatements('');

	// Reset function for testing
	sourceFile.addFunction({
		isExported: true,
		name: 'resetEnv',
		parameters: [],
		returnType: 'void',
		statements: ['_initialized = false;', '_decoded = {};'],
	});

	sourceFile.addStatements('');

	// Check initialized function
	sourceFile.addFunction({
		isExported: true,
		name: 'isEnvInitialized',
		parameters: [],
		returnType: 'boolean',
		statements: ['return _initialized;'],
	});

	sourceFile.addStatements('');

	// Generate the env object with getters
	sourceFile.addStatements((writer) => {
		writer.writeLine('/**');
		writer.writeLine(' * Type-safe environment variables.');
		writer.writeLine(' * Values are decoded according to their inferred types.');
		writer.writeLine(' */');
		writer.writeLine('export const env: Env = {');

		const entries = Array.from(variables.entries());
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			if (!entry) continue;
			const [name, variable] = entry;
			const tsType = toTypeScriptType(variable.inferredType);

			writer.indent(() => {
				writer.writeLine(`get ${name}(): ${tsType} {`);
				writer.indent(() => {
					writer.writeLine('if (!_initialized) {');
					writer.indent(() => {
						writer.writeLine(
							'throw new Error("Environment not initialized. Call initializeEnv() first.");',
						);
					});
					writer.writeLine('}');
					writer.writeLine(`return _decoded.${name} as ${tsType};`);
				});
				writer.write('}');
				if (i < entries.length - 1) {
					writer.write(',');
				}
			});
			writer.newLine();
		}

		writer.writeLine('};');
	});

	sourceFile.addStatements('');

	// Re-export schema and types
	sourceFile.addExportDeclaration({
		moduleSpecifier: './env.schema.js',
		namedExports: ['EnvSchema'],
	});

	sourceFile.addExportDeclaration({
		moduleSpecifier: './env.types.js',
		namedExports: ['Env', 'EnvKey', 'EnvValue'],
		isTypeOnly: true,
	});

	return sourceFile;
}

// ============================================================================
// Index Generator
// ============================================================================

/**
 * Generate the index file that re-exports everything.
 */
function generateIndexFile(project: Project): SourceFile {
	const sourceFile = project.createSourceFile('index.ts', '', { overwrite: true });

	// Header comment
	sourceFile.addStatements([
		'/**',
		' * @foxen/env - Generated Environment Module',
		' * ',
		' * Re-exports all generated environment utilities.',
		' * ',
		' * This file is auto-generated. Do not edit manually.',
		' */',
		'',
	]);

	// Re-export everything
	sourceFile.addExportDeclaration({
		moduleSpecifier: './env.runtime.js',
	});

	sourceFile.addExportDeclaration({
		moduleSpecifier: './env.schema.js',
	});

	sourceFile.addExportDeclaration({
		moduleSpecifier: './env.types.js',
	});

	return sourceFile;
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate all environment files.
 *
 * @param config - Generation configuration
 * @returns Generation result with file contents
 *
 * @example
 * ```ts
 * const result = await generateEnvFiles({ rootDir: process.cwd() });
 * console.log(`Generated ${result.files.length} files`);
 * ```
 */
export async function generateEnvFiles(config: EnvConfig = {}): Promise<GenerationResult> {
	const resolved = resolveConfig(config);
	const { rootDir, outputDir } = resolved;

	// Load environment variables
	const loadResult = loadEnvFiles(config);
	const { variables } = loadResult;

	if (variables.size === 0) {
		return {
			files: [],
			outputDir: join(rootDir, outputDir),
			variableCount: 0,
			warnings: ['No environment variables found. Create a .env file first.'],
		};
	}

	// Create ts-morph project
	const project = createProject();
	const warnings: string[] = [];

	// Generate all files
	const schemaFile = generateSchemaFile(project, variables);
	const declarationFile = generateDeclarationFile(project, variables);
	const typesFile = generateTypesFile(project, variables);
	const runtimeFile = generateRuntimeFile(project, variables);
	const indexFile = generateIndexFile(project);

	// Collect generated files
	const files: GeneratedFile[] = [
		{
			path: 'env.schema.ts',
			content: schemaFile.getFullText(),
			type: 'schema',
		},
		{
			path: 'env.d.ts',
			content: declarationFile.getFullText(),
			type: 'declaration',
		},
		{
			path: 'env.types.ts',
			content: typesFile.getFullText(),
			type: 'types',
		},
		{
			path: 'env.runtime.ts',
			content: runtimeFile.getFullText(),
			type: 'runtime',
		},
		{
			path: 'index.ts',
			content: indexFile.getFullText(),
			type: 'types',
		},
	];

	return {
		files,
		outputDir: join(rootDir, outputDir),
		variableCount: variables.size,
		warnings,
	};
}

/**
 * Generate and write all environment files to disk.
 *
 * @param config - Generation configuration
 * @returns Generation result
 */
export async function generateAndWriteEnvFiles(config: EnvConfig = {}): Promise<GenerationResult> {
	const result = await generateEnvFiles(config);

	if (result.files.length === 0) {
		return result;
	}

	// Ensure output directory exists
	if (!existsSync(result.outputDir)) {
		mkdirSync(result.outputDir, { recursive: true });
	}

	// Write all files
	for (const file of result.files) {
		const filePath = join(result.outputDir, file.path);
		writeFileSync(filePath, file.content, 'utf-8');
	}

	return result;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if generated files exist and are up to date.
 *
 * @param config - Configuration
 * @returns Whether regeneration is needed
 */
export function needsRegeneration(config: EnvConfig = {}): boolean {
	const resolved = resolveConfig(config);
	const outputPath = join(resolved.rootDir, resolved.outputDir);

	// Check if any required file is missing
	const requiredFiles = ['env.schema.ts', 'env.d.ts', 'env.types.ts', 'env.runtime.ts', 'index.ts'];

	for (const file of requiredFiles) {
		if (!existsSync(join(outputPath, file))) {
			return true;
		}
	}

	// TODO: Check file modification times against .env files

	return false;
}
