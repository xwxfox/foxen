/**
 * Users endpoint
 *
 * GET /api/users - List all users
 */

import { NextRequest, NextResponse } from "@foxen/core";

// In-memory data store
const users = [
    { id: "1", name: "Alice", email: "alice@example.com" },
    { id: "2", name: "Bob", email: "bob@example.com" },
    { id: "3", name: "Charlie", email: "charlie@example.com" },
];

export async function GET(request: NextRequest) {
    // Support pagination via query params
    const page = Number(request.nextUrl.searchParams.get("page")) || 1;
    const limit = Number(request.nextUrl.searchParams.get("limit")) || 10;

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedUsers = users.slice(start, end);

    return NextResponse.json({
        users: paginatedUsers,
        pagination: {
            page,
            limit,
            total: users.length,
            totalPages: Math.ceil(users.length / limit),
        },
    });
}
