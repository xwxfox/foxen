/**
 * User by ID endpoint
 *
 * GET /api/users/:id - Get a specific user
 */

import { NextRequest, NextResponse } from "@foxen/core";

// In-memory data store
const users = new Map([
    ["1", { id: "1", name: "Alice", email: "alice@example.com", role: "admin" }],
    ["2", { id: "2", name: "Bob", email: "bob@example.com", role: "user" }],
    ["3", { id: "3", name: "Charlie", email: "charlie@example.com", role: "user" }],
]);

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    const user = users.get(id);

    if (!user) {
        return NextResponse.json(
            {
                error: "User not found",
                code: "USER_NOT_FOUND",
                id,
            },
            { status: 404 },
        );
    }

    return NextResponse.json({ user });
}
