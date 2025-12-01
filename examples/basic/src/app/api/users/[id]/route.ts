/**
 * Example: /api/users/[id] routes
 * Single user operations with dynamic parameter
 */

import { NextResponse } from "@foxen/core";
import type { NextRequest } from "@foxen/core";

// Shared user store (in real app, this would be a database)
const users = new Map<string, { id: string; name: string; email: string }>();

// Initialize with some data
users.set("1", { id: "1", name: "Alice", email: "alice@example.com" });
users.set("2", { id: "2", name: "Bob", email: "bob@example.com" });

// GET /api/users/:id - Get a single user
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const user = users.get(id);

    if (!user) {
        return NextResponse.json(
            { error: "User not found" },
            { status: 404 },
        );
    }

    return NextResponse.json(user);
}

// PUT /api/users/:id - Update a user
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const user = users.get(id);

    if (!user) {
        return NextResponse.json(
            { error: "User not found" },
            { status: 404 },
        );
    }

    try {
        const body = await request.json();
        const updated = {
            ...user,
            ...(body.name && { name: body.name }),
            ...(body.email && { email: body.email }),
        };
        users.set(id, updated);

        return NextResponse.json(updated);
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 },
        );
    }
}

// DELETE /api/users/:id - Delete a user
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    if (!users.has(id)) {
        return NextResponse.json(
            { error: "User not found" },
            { status: 404 },
        );
    }

    users.delete(id);
    return new Response(null, { status: 204 });
}
