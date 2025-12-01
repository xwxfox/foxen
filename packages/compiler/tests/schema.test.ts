import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Project } from 'ts-morph';
import {
	extractSchemaFromFile,
	extractTypeBoxReferences,
	generateParamsSchema,
	generateSchemaOptions,
	inferBasicResponseType,
	requiresTypeBox,
} from '../src/schema.js';

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, 'fixtures-schema');

// Setup test fixtures
beforeAll(() => {
	mkdirSync(FIXTURES_DIR, { recursive: true });

	// Route with schema using defineSchema
	writeFileSync(
		join(FIXTURES_DIR, 'route-with-define-schema.ts'),
		`
import { t } from 'elysia';
import { defineSchema } from '@foxen/core';

export const schema = defineSchema({
    GET: {
        params: t.Object({ id: t.String() }),
        response: t.Object({ name: t.String() }),
        tags: ['users'],
        summary: 'Get a user',
    },
    POST: {
        body: t.Object({ name: t.String(), email: t.String() }),
        response: t.Object({ id: t.String() }),
        tags: ['users'],
        description: 'Create a new user',
    },
});
`,
	);

	// Route with inline schema object
	writeFileSync(
		join(FIXTURES_DIR, 'route-with-inline-schema.ts'),
		`
import { t } from 'elysia';

export const schema = {
    GET: {
        query: t.Object({ page: t.Number(), limit: t.Number() }),
        headers: t.Object({ authorization: t.String() }),
    },
    DELETE: {
        params: t.Object({ id: t.String() }),
    },
};
`,
	);

	// Route without schema
	writeFileSync(
		join(FIXTURES_DIR, 'route-without-schema.ts'),
		`
export function GET() {
    return new Response("hello");
}
`,
	);

	// Route with detail object
	writeFileSync(
		join(FIXTURES_DIR, 'route-with-detail.ts'),
		`
import { t } from 'elysia';

export const schema = {
    GET: {
        response: t.Object({ ok: t.Boolean() }),
        detail: { tags: ['health'], deprecated: true },
    },
};
`,
	);
});

// Cleanup test fixtures
afterAll(() => {
	rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('extractSchemaFromFile', () => {
	let project: Project;

	beforeAll(() => {
		project = new Project({
			skipAddingFilesFromTsConfig: true,
		});
	});

	test('extracts schema from defineSchema call', () => {
		const sourceFile = project.addSourceFileAtPath(
			join(FIXTURES_DIR, 'route-with-define-schema.ts'),
		);

		const result = extractSchemaFromFile(sourceFile);

		expect(result.hasSchema).toBe(true);
		expect(result.methods.GET).toBeDefined();
		expect(result.methods.POST).toBeDefined();
	});

	test('extracts params schema', () => {
		const sourceFile = project.addSourceFileAtPath(
			join(FIXTURES_DIR, 'route-with-define-schema.ts'),
		);

		const result = extractSchemaFromFile(sourceFile);
		const getSchema = result.methods.GET;

		expect(getSchema?.params).toContain('t.Object');
		expect(getSchema?.params).toContain('id');
	});

	test('extracts response schema', () => {
		const sourceFile = project.addSourceFileAtPath(
			join(FIXTURES_DIR, 'route-with-define-schema.ts'),
		);

		const result = extractSchemaFromFile(sourceFile);
		const getSchema = result.methods.GET;

		expect(getSchema?.response).toContain('t.Object');
		expect(getSchema?.response).toContain('name');
	});

	test('extracts body schema', () => {
		const sourceFile = project.addSourceFileAtPath(
			join(FIXTURES_DIR, 'route-with-define-schema.ts'),
		);

		const result = extractSchemaFromFile(sourceFile);
		const postSchema = result.methods.POST;

		expect(postSchema?.body).toContain('t.Object');
		expect(postSchema?.body).toContain('email');
	});

	test('extracts tags', () => {
		const sourceFile = project.addSourceFileAtPath(
			join(FIXTURES_DIR, 'route-with-define-schema.ts'),
		);

		const result = extractSchemaFromFile(sourceFile);
		const getSchema = result.methods.GET;

		expect(getSchema?.tags).toEqual(['users']);
	});

	test('extracts summary', () => {
		const sourceFile = project.addSourceFileAtPath(
			join(FIXTURES_DIR, 'route-with-define-schema.ts'),
		);

		const result = extractSchemaFromFile(sourceFile);
		const getSchema = result.methods.GET;

		expect(getSchema?.summary).toBe('Get a user');
	});

	test('extracts description', () => {
		const sourceFile = project.addSourceFileAtPath(
			join(FIXTURES_DIR, 'route-with-define-schema.ts'),
		);

		const result = extractSchemaFromFile(sourceFile);
		const postSchema = result.methods.POST;

		expect(postSchema?.description).toBe('Create a new user');
	});

	test('extracts inline schema object', () => {
		const sourceFile = project.addSourceFileAtPath(
			join(FIXTURES_DIR, 'route-with-inline-schema.ts'),
		);

		const result = extractSchemaFromFile(sourceFile);

		expect(result.hasSchema).toBe(true);
		expect(result.methods.GET?.query).toBeDefined();
		expect(result.methods.DELETE?.params).toBeDefined();
	});

	test('extracts query schema', () => {
		const sourceFile = project.addSourceFileAtPath(
			join(FIXTURES_DIR, 'route-with-inline-schema.ts'),
		);

		const result = extractSchemaFromFile(sourceFile);
		const getSchema = result.methods.GET;

		expect(getSchema?.query).toContain('page');
		expect(getSchema?.query).toContain('limit');
	});

	test('extracts headers schema', () => {
		const sourceFile = project.addSourceFileAtPath(
			join(FIXTURES_DIR, 'route-with-inline-schema.ts'),
		);

		const result = extractSchemaFromFile(sourceFile);
		const getSchema = result.methods.GET;

		expect(getSchema?.headers).toContain('authorization');
	});

	test('returns hasSchema false when no schema', () => {
		const sourceFile = project.addSourceFileAtPath(join(FIXTURES_DIR, 'route-without-schema.ts'));

		const result = extractSchemaFromFile(sourceFile);

		expect(result.hasSchema).toBe(false);
		expect(Object.keys(result.methods).length).toBe(0);
	});

	test('extracts detail object', () => {
		const sourceFile = project.addSourceFileAtPath(join(FIXTURES_DIR, 'route-with-detail.ts'));

		const result = extractSchemaFromFile(sourceFile);
		const getSchema = result.methods.GET;

		expect(getSchema?.detail).toBeDefined();
		expect(getSchema?.detail).toContain('deprecated');
	});

	test('stores raw source', () => {
		const sourceFile = project.addSourceFileAtPath(
			join(FIXTURES_DIR, 'route-with-define-schema.ts'),
		);

		const result = extractSchemaFromFile(sourceFile);

		expect(result.rawSource).toBeDefined();
		expect(result.rawSource?.length).toBeGreaterThan(0);
	});
});

describe('generateSchemaOptions', () => {
	test('generates params option', () => {
		const options = generateSchemaOptions({
			params: 't.Object({ id: t.String() })',
		});

		expect(options).toContain('params:');
		expect(options).toContain('t.Object');
	});

	test('generates query option', () => {
		const options = generateSchemaOptions({
			query: 't.Object({ page: t.Number() })',
		});

		expect(options).toContain('query:');
	});

	test('generates body option', () => {
		const options = generateSchemaOptions({
			body: 't.Object({ name: t.String() })',
		});

		expect(options).toContain('body:');
	});

	test('generates response option', () => {
		const options = generateSchemaOptions({
			response: 't.Object({ ok: t.Boolean() })',
		});

		expect(options).toContain('response:');
	});

	test('generates headers option', () => {
		const options = generateSchemaOptions({
			headers: 't.Object({ auth: t.String() })',
		});

		expect(options).toContain('headers:');
	});

	test('generates detail with tags', () => {
		const options = generateSchemaOptions({
			tags: ['users', 'admin'],
		});

		expect(options).toContain('detail:');
		expect(options).toContain('tags:');
		expect(options).toContain('"users"');
		expect(options).toContain('"admin"');
	});

	test('generates detail with summary', () => {
		const options = generateSchemaOptions({
			summary: 'Get all users',
		});

		expect(options).toContain('summary:');
		expect(options).toContain('Get all users');
	});

	test('generates detail with description', () => {
		const options = generateSchemaOptions({
			description: 'Fetches all users from the database',
		});

		expect(options).toContain('description:');
	});

	test('uses raw detail if provided', () => {
		const options = generateSchemaOptions({
			detail: '{ deprecated: true }',
		});

		expect(options).toContain('detail: { deprecated: true }');
	});

	test('escapes special characters in strings', () => {
		const options = generateSchemaOptions({
			summary: 'Say "hello"',
		});

		expect(options).toContain('\\"hello\\"');
	});
});

describe('generateParamsSchema', () => {
	test('generates empty string for no params', () => {
		const schema = generateParamsSchema([]);
		expect(schema).toBe('');
	});

	test('generates schema for single param', () => {
		const schema = generateParamsSchema(['id']);

		expect(schema).toContain('t.Object');
		expect(schema).toContain('id: t.String()');
	});

	test('generates schema for multiple params', () => {
		const schema = generateParamsSchema(['userId', 'postId']);

		expect(schema).toContain('userId: t.String()');
		expect(schema).toContain('postId: t.String()');
	});

	test('generates array type for catch-all', () => {
		const schema = generateParamsSchema(['slug'], true);

		expect(schema).toContain('t.Array(t.String())');
	});
});

describe('requiresTypeBox', () => {
	test('returns true when params schema present', () => {
		const result = requiresTypeBox({
			hasSchema: true,
			methods: {
				GET: { params: 't.Object({})' },
			},
		});

		expect(result).toBe(true);
	});

	test('returns true when query schema present', () => {
		const result = requiresTypeBox({
			hasSchema: true,
			methods: {
				GET: { query: 't.Object({})' },
			},
		});

		expect(result).toBe(true);
	});

	test('returns true when body schema present', () => {
		const result = requiresTypeBox({
			hasSchema: true,
			methods: {
				POST: { body: 't.Object({})' },
			},
		});

		expect(result).toBe(true);
	});

	test('returns true when response schema present', () => {
		const result = requiresTypeBox({
			hasSchema: true,
			methods: {
				GET: { response: 't.Object({})' },
			},
		});

		expect(result).toBe(true);
	});

	test('returns false when only tags/summary', () => {
		const result = requiresTypeBox({
			hasSchema: true,
			methods: {
				GET: { tags: ['users'], summary: 'Get users' },
			},
		});

		expect(result).toBe(false);
	});

	test('returns false for empty schema', () => {
		const result = requiresTypeBox({
			hasSchema: false,
			methods: {},
		});

		expect(result).toBe(false);
	});
});

describe('extractTypeBoxReferences', () => {
	test('extracts t.Object references', () => {
		const refs = extractTypeBoxReferences({
			hasSchema: true,
			methods: {
				GET: { params: 't.Object({ id: t.String() })' },
			},
		});

		expect(refs.has('t.Object')).toBe(true);
		expect(refs.has('t.String')).toBe(true);
	});

	test('extracts t.Array references', () => {
		const refs = extractTypeBoxReferences({
			hasSchema: true,
			methods: {
				GET: { response: 't.Array(t.String())' },
			},
		});

		expect(refs.has('t.Array')).toBe(true);
	});

	test('extracts t.Optional references', () => {
		const refs = extractTypeBoxReferences({
			hasSchema: true,
			methods: {
				GET: { query: 't.Object({ page: t.Optional(t.Number()) })' },
			},
		});

		expect(refs.has('t.Optional')).toBe(true);
		expect(refs.has('t.Number')).toBe(true);
	});

	test('extracts t.Union references', () => {
		const refs = extractTypeBoxReferences({
			hasSchema: true,
			methods: {
				GET: { response: 't.Union([t.String(), t.Number()])' },
			},
		});

		expect(refs.has('t.Union')).toBe(true);
	});

	test('returns empty set for no schemas', () => {
		const refs = extractTypeBoxReferences({
			hasSchema: false,
			methods: {},
		});

		expect(refs.size).toBe(0);
	});
});

describe('inferBasicResponseType', () => {
	let project: Project;

	beforeAll(() => {
		project = new Project({
			skipAddingFilesFromTsConfig: true,
		});

		writeFileSync(
			join(FIXTURES_DIR, 'route-with-json.ts'),
			`
import { NextResponse } from '@foxen/core';

export function GET() {
    return NextResponse.json({ ok: true });
}
`,
		);
	});

	test('detects NextResponse.json usage', () => {
		const sourceFile = project.addSourceFileAtPath(join(FIXTURES_DIR, 'route-with-json.ts'));

		const result = inferBasicResponseType(sourceFile, 'GET');

		expect(result).toBeDefined();
		expect(result).toContain('NextResponse.json');
	});

	test('returns undefined for plain Response', () => {
		const sourceFile = project.addSourceFileAtPath(join(FIXTURES_DIR, 'route-without-schema.ts'));

		const result = inferBasicResponseType(sourceFile, 'GET');

		// No json pattern found
		expect(result).toBeUndefined();
	});
});
