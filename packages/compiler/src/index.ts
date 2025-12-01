// Main compiler
export {
	Compiler,
	compile,
	compileAndWrite,
	watchAndCompile,
	defineConfig,
	type CompilerOptions,
	type CompilerResult,
} from './compiler.js';

// Analyzer
export {
	RouteAnalyzer,
	analyzeRoutes,
	analyzeFile,
} from './analyzer.js';

// Generator
export {
	CodeGenerator,
	generateCode,
	generateAndWrite,
} from './generator.js';

// Schema extraction
export {
	extractSchemaFromFile,
	generateSchemaOptions,
	generateParamsSchema,
	inferBasicResponseType,
	requiresTypeBox,
	extractTypeBoxReferences,
	type MethodSchema,
	type SchemaAnalysis,
} from './schema.js';

// Type generation (Eden Treaty)
export {
	generateTypeExports,
	generateDetailedRouteTypes,
	generateRouteManifest,
	type TypeGenOptions,
	type GeneratedTypes,
} from './types-gen.js';

// Config generation
export {
	generateConfigFile,
	generateEmptyConfigFile,
	type ConfigGenOptions,
	type GeneratedConfig,
} from './config-gen.js';

// Middleware generation
export {
	generateMiddlewareFile,
	generateEmptyMiddlewareFile,
	generateComposedMiddlewareFile,
	type MiddlewareGenOptions,
	type GeneratedMiddleware,
} from './middleware-gen.js';

// Transformers
export {
	CodeTransformer,
	applyTransformers,
	composeTransformers,
	validationTransformer,
	openApiTransformer,
	catchAllTransformer,
} from './transformer.js';

// Types
export type {
	// Analyzer types
	AnalyzerOptions,
	AnalysisResult,
	AnalyzedRoute,
	AnalyzedMiddleware,
	AnalysisError,
	HandlerInfo,
	RouteParamInfo,
	RouteConfigInfo,
	ImportInfo,
	// Generator types
	GeneratorOptions,
	GeneratedOutput,
	GeneratedFile,
	// Transformer types
	TransformContext,
	RouteTransformer,
	// Plugin types
	CompilerPlugin,
} from './types.js';
