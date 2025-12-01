/**
 * User by ID endpoint with schema definition
 *
 * GET /api/users/:id - Get a specific user
 * PUT /api/users/:id - Update a user
 * DELETE /api/users/:id - Delete a user
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

export const UpdateUserSchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    email: t.Optional(t.String({ format: "email" })),
});

// ============================================================================
// In-memory data store (shared with parent route)
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

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/users/:id
 * Get a specific user by ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const user = users.get(id);

    if (!user) {
        return NextResponse.json(
            { error: "User not found", code: "USER_NOT_FOUND" },
            { status: 404 },
        );
    }

    return NextResponse.json({ user });
}

/**
 * PUT /api/users/:id
 * Update a specific user
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const user = users.get(id);

    if (!user) {
        return NextResponse.json(
            { error: "User not found", code: "USER_NOT_FOUND" },
            { status: 404 },
        );
    }

    try {
        const body = await request.json();

        // Update only provided fields
        const updatedUser = {
            ...user,
            ...(body.name && { name: body.name }),
            ...(body.email && { email: body.email }),
        };

        users.set(id, updatedUser);

        return NextResponse.json({ user: updatedUser });
    } catch (error) {
        return NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 },
        );
    }
}

/**
 * DELETE /api/users/:id
 * Delete a specific user
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const user = users.get(id);

    if (!user) {
        return NextResponse.json(
            { error: "User not found", code: "USER_NOT_FOUND" },
            { status: 404 },
        );
    }

    users.delete(id);

    return NextResponse.json({ success: true, deletedId: id });
}

// ============================================================================
// Schema Export (for Foxen compiler)
// ============================================================================

export const schema = {
    GET: {
        params: t.Object({ id: t.String() }),
        response: t.Object({ user: UserSchema }),
        tags: ["users"],
        summary: "Get user by ID",
        description: "Retrieve a specific user by their unique ID",
    },
    PUT: {
        params: t.Object({ id: t.String() }),
        body: UpdateUserSchema,
        response: t.Object({ user: UserSchema }),
        tags: ["users"],
        summary: "Update user",
        description: "Update a user's name and/or email",
    },
    DELETE: {
        params: t.Object({ id: t.String() }),
        response: t.Object({
            success: t.Boolean(),
            deletedId: t.String(),
        }),
        tags: ["users"],
        summary: "Delete user",
        description: "Permanently delete a user from the system",
    },
};
