/**
 * Users endpoint - requires authentication
 *
 * GET /api/users
 */

import { NextRequest, NextResponse } from "@foxen/core";

// In-memory data store
const users = [
    { id: "1", name: "Alice", email: "alice@example.com", role: "user" },
    { id: "2", name: "Bob", email: "bob@example.com", role: "user" },
    { id: "3", name: "Charlie", email: "charlie@example.com", role: "admin" },
];

export async function GET(request: NextRequest) {
    // User info is added by middleware
    const currentUserId = request.headers.get("X-User-ID");
    const currentUserRole = request.headers.get("X-User-Role");

    // Filter users based on role - admins see all, users see limited data
    const visibleUsers =
        currentUserRole === "admin"
            ? users
            : users.map((u) => ({ id: u.id, name: u.name }));

    return NextResponse.json({
        users: visibleUsers,
        meta: {
            total: users.length,
            viewingAs: currentUserRole,
            requestId: request.headers.get("X-Request-ID"),
        },
    });
}
