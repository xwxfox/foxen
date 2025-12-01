import { analyzeRoutes } from './analyzer.js';
import { CodeGenerator, generateAndWrite } from './generator.js';
import type {
	AnalysisResult,
	AnalyzerOptions,
	CompilerPlugin,
	GeneratedOutput,
	GeneratorOptions,
} from './types.js';

/**
 * Full compiler options
 */
export interface CompilerOptions {
	/** Analyzer options */
	analyzer: AnalyzerOptions;
	/** Generator options */
	generator: Partial<GeneratorOptions>;
	/** Plugins to apply */
	plugins?: CompilerPlugin[];
	/** Watch mode */
	watch?: boolean;
	/** Verbose logging */
	verbose?: boolean;
}

/**
 * Compiler result
 */
export interface CompilerResult {
	/** Analysis result */
	analysis: AnalysisResult;
	/** Generated output */
	output: GeneratedOutput;
	/** Compilation duration in ms */
	duration: number;
}

/**
 * Main compiler class
 */
export class Compiler {
	private options: CompilerOptions;
	private plugins: CompilerPlugin[];

	constructor(options: CompilerOptions) {
		this.options = options;
		this.plugins = options.plugins ?? [];
	}

	/**
	 * Run the full compilation pipeline
	 */
	async compile(): Promise<CompilerResult> {
		const startTime = performance.now();

		// Run beforeAnalysis hooks
		for (const plugin of this.plugins) {
			if (plugin.beforeAnalysis) {
				await plugin.beforeAnalysis(this.options.analyzer);
			}
		}

		// Analyze routes
		let analysis = await analyzeRoutes(this.options.analyzer);

		// Run afterAnalysis hooks
		for (const plugin of this.plugins) {
			if (plugin.afterAnalysis) {
				analysis = await plugin.afterAnalysis(analysis);
			}
		}

		// Log analysis results
		if (this.options.verbose) {
			this.logAnalysis(analysis);
		}

		// Run beforeGeneration hooks
		for (const plugin of this.plugins) {
			if (plugin.beforeGeneration) {
				await plugin.beforeGeneration(analysis.routes, this.options.generator as GeneratorOptions);
			}
		}

		// Create generator with plugin transformers
		const generator = new CodeGenerator(this.options.generator);

		// Add transformers from plugins
		for (const plugin of this.plugins) {
			if (plugin.transformRoute) {
				generator.addTransformer(plugin.transformRoute);
			}
		}

		// Generate code
		let output = await generator.generate(analysis);

		// Run afterGeneration hooks
		for (const plugin of this.plugins) {
			if (plugin.afterGeneration) {
				output = await plugin.afterGeneration(output);
			}
		}

		const duration = performance.now() - startTime;

		return {
			analysis,
			output,
			duration,
		};
	}

	/**
	 * Compile and write to disk
	 */
	async compileAndWrite(): Promise<CompilerResult> {
		const result = await this.compile();

		const outputPath = this.options.generator.outputPath;
		if (!outputPath) {
			throw new Error('Output path is required for compileAndWrite');
		}

		await generateAndWrite(result.analysis, {
			...this.options.generator,
			outputPath,
		});

		if (this.options.verbose) {
			console.log(`\nGenerated ${result.output.files.length} files to ${outputPath}`);
			for (const file of result.output.files) {
				console.log(`   - ${file.path} (${file.type})`);
			}
		}

		return result;
	}

	/**
	 * Watch for changes and recompile
	 */
	async watch(onChange?: (result: CompilerResult) => void): Promise<() => void> {
		const chokidar = await import('chokidar');

		const watcher = chokidar.watch(
			[
				`${this.options.analyzer.rootDir}/**/route.{ts,tsx,js,jsx}`,
				`${this.options.analyzer.rootDir}/**/middleware.{ts,tsx,js,jsx}`,
			],
			{
				ignored: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
				ignoreInitial: true,
			},
		);

		const recompile = async () => {
			try {
				if (this.options.verbose) {
					console.log('\nRecompiling...');
				}
				const result = await this.compileAndWrite();
				if (this.options.verbose) {
					console.log(`Compiled in ${result.duration.toFixed(2)}ms`);
				}
				onChange?.(result);
			} catch (error) {
				console.error('Compilation error:', error);
			}
		};

		watcher.on('add', recompile);
		watcher.on('change', recompile);
		watcher.on('unlink', recompile);

		// Initial compile
		await recompile();

		if (this.options.verbose) {
			console.log('\nWatching for changes...');
		}

		return () => {
			watcher.close();
		};
	}

	/**
	 * Log analysis results
	 */
	private logAnalysis(analysis: AnalysisResult): void {
		console.log('\nAnalysis Results:');
		console.log(`   Routes: ${analysis.routes.length}`);
		console.log(`   Middleware: ${analysis.middleware.length}`);
		console.log(`   Errors: ${analysis.errors.length}`);

		if (analysis.routes.length > 0) {
			console.log('\n   Routes:');
			for (const route of analysis.routes) {
				const methods = route.handlers.map((h) => h.method).join(', ');
				console.log(`     ${route.elysiaPath} [${methods}]`);
			}
		}

		if (analysis.errors.length > 0) {
			console.log('\n   Errors:');
			for (const error of analysis.errors) {
				console.log(`     ${error.filePath}: ${error.message}`);
			}
		}
	}
}

/**
 * Create and run compiler
 */
export async function compile(options: CompilerOptions): Promise<CompilerResult> {
	const compiler = new Compiler(options);
	return compiler.compile();
}

/**
 * Create, run, and write compiler output
 */
export async function compileAndWrite(options: CompilerOptions): Promise<CompilerResult> {
	const compiler = new Compiler(options);
	return compiler.compileAndWrite();
}

/**
 * Watch and compile
 */
export async function watchAndCompile(
	options: CompilerOptions,
	onChange?: (result: CompilerResult) => void,
): Promise<() => void> {
	const compiler = new Compiler(options);
	return compiler.watch(onChange);
}

/**
 * Define a compiler configuration
 */
export function defineConfig(options: CompilerOptions): CompilerOptions {
	return options;
}
