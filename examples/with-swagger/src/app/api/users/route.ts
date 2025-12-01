/**
 * Users endpoint with schema definition
 *
 * GET /api/users - List all users
 * POST /api/users - Create a new user
 */

import { NextRequest, NextResponse } from "@foxen/core";
import { t } from "elysia";

// ============================================================================
// Schema Definitions
// ============================================================================

export const UserSchema = t.Object({
    id: t.String(),
    name: t.String(),
    email: t.String({ format: "email" }),
    createdAt: t.String(),
});

export const CreateUserSchema = t.Object({
    name: t.String({ minLength: 1, maxLength: 100 }),
    email: t.String({ format: "email" }),
});

export const UsersListResponseSchema = t.Object({
    users: t.Array(UserSchema),
    pagination: t.Object({
        page: t.Number(),
        limit: t.Number(),
        total: t.Number(),
        totalPages: t.Number(),
    }),
});

// ============================================================================
// In-memory data store
// ============================================================================

const users = new Map([
    [
        "1",
        {
            id: "1",
            name: "Alice",
            email: "alice@example.com",
            createdAt: "2024-01-01T00:00:00Z",
        },
    ],
    [
        "2",
        {
            id: "2",
            name: "Bob",
            email: "bob@example.com",
            createdAt: "2024-01-02T00:00:00Z",
        },
    ],
    [
        "3",
        {
            id: "3",
            name: "Charlie",
            email: "charlie@example.com",
            createdAt: "2024-01-03T00:00:00Z",
        },
    ],
]);

let nextId = 4;

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/users
 * List all users with pagination
 */
export async function GET(request: NextRequest) {
    const page = Number(request.nextUrl.searchParams.get("page")) || 1;
    const limit = Number(request.nextUrl.searchParams.get("limit")) || 10;

    const allUsers = Array.from(users.values());
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedUsers = allUsers.slice(start, end);

    return NextResponse.json({
        users: paginatedUsers,
        pagination: {
            page,
            limit,
            total: allUsers.length,
            totalPages: Math.ceil(allUsers.length / limit),
        },
    });
}

/**
 * POST /api/users
 * Create a new user
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Basic validation
        if (!body.name || !body.email) {
            return NextResponse.json(
                { error: "Name and email are required" },
                { status: 400 },
            );
        }

        // Check for duplicate email
        const existingUser = Array.from(users.values()).find(
            (u) => u.email === body.email,
        );
        if (existingUser) {
            return NextResponse.json(
                { error: "Email already exists" },
                { status: 409 },
            );
        }

        const newUser = {
            id: String(nextId++),
            name: body.name,
            email: body.email,
            createdAt: new Date().toISOString(),
        };

        users.set(newUser.id, newUser);

        return NextResponse.json({ user: newUser }, { status: 201 });
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
        }),
        response: UsersListResponseSchema,
        tags: ["users"],
        summary: "List all users",
        description: "Get a paginated list of all users in the system",
    },
    POST: {
        body: CreateUserSchema,
        response: t.Object({ user: UserSchema }),
        tags: ["users"],
        summary: "Create a new user",
        description: "Create a new user with name and email",
    },
};
