/**
 * Posts endpoint with schema definition
 *
 * GET /api/posts - List all posts
 * POST /api/posts - Create a new post
 */

import { NextRequest, NextResponse } from "@foxen/core";
import { t } from "elysia";

// ============================================================================
// Schema Definitions
// ============================================================================

export const PostSchema = t.Object({
    id: t.String(),
    title: t.String(),
    content: t.String(),
    authorId: t.String(),
    createdAt: t.String(),
    tags: t.Array(t.String()),
});

export const CreatePostSchema = t.Object({
    title: t.String({ minLength: 1, maxLength: 200 }),
    content: t.String({ minLength: 1 }),
    authorId: t.String(),
    tags: t.Optional(t.Array(t.String())),
});

// ============================================================================
// In-memory data store
// ============================================================================

const posts = new Map([
    [
        "1",
        {
            id: "1",
            title: "Getting Started with Foxen",
            content: "Foxen is a framework for migrating Next.js API routes to Elysia...",
            authorId: "1",
            createdAt: "2024-01-10T00:00:00Z",
            tags: ["foxen", "elysia", "tutorial"],
        },
    ],
    [
        "2",
        {
            id: "2",
            title: "Elysia Performance Tips",
            content: "Here are some tips for optimizing your Elysia applications...",
            authorId: "2",
            createdAt: "2024-01-11T00:00:00Z",
            tags: ["elysia", "performance", "bun"],
        },
    ],
]);

let nextId = 3;

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/posts
 * List all posts with optional filtering
 */
export async function GET(request: NextRequest) {
    const page = Number(request.nextUrl.searchParams.get("page")) || 1;
    const limit = Number(request.nextUrl.searchParams.get("limit")) || 10;
    const authorId = request.nextUrl.searchParams.get("authorId");
    const tag = request.nextUrl.searchParams.get("tag");

    let allPosts = Array.from(posts.values());

    // Filter by author
    if (authorId) {
        allPosts = allPosts.filter((p) => p.authorId === authorId);
    }

    // Filter by tag
    if (tag) {
        allPosts = allPosts.filter((p) => p.tags.includes(tag));
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedPosts = allPosts.slice(start, end);

    return NextResponse.json({
        posts: paginatedPosts,
        pagination: {
            page,
            limit,
            total: allPosts.length,
            totalPages: Math.ceil(allPosts.length / limit),
        },
    });
}

/**
 * POST /api/posts
 * Create a new post
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Basic validation
        if (!body.title || !body.content || !body.authorId) {
            return NextResponse.json(
                { error: "Title, content, and authorId are required" },
                { status: 400 },
            );
        }

        const newPost = {
            id: String(nextId++),
            title: body.title,
            content: body.content,
            authorId: body.authorId,
            createdAt: new Date().toISOString(),
            tags: body.tags || [],
        };

        posts.set(newPost.id, newPost);

        return NextResponse.json({ post: newPost }, { status: 201 });
    } catch (error) {
        return NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 },
        );
    }
}

// ============================================================================
// Schema Export (for Foxen compiler)
// ============================================================================

export const schema = {
    GET: {
        query: t.Object({
            page: t.Optional(t.Number({ default: 1 })),
            limit: t.Optional(t.Number({ default: 10 })),
            authorId: t.Optional(t.String()),
            tag: t.Optional(t.String()),
        }),
        response: t.Object({
            posts: t.Array(PostSchema),
            pagination: t.Object({
                page: t.Number(),
                limit: t.Number(),
                total: t.Number(),
                totalPages: t.Number(),
            }),
        }),
        tags: ["posts"],
        summary: "List all posts",
        description: "Get a paginated list of posts with optional filtering by author or tag",
    },
    POST: {
        body: CreatePostSchema,
        response: t.Object({ post: PostSchema }),
        tags: ["posts"],
        summary: "Create a new post",
        description: "Create a new blog post with title, content, author, and optional tags",
    },
};
