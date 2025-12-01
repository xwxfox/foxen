/**
 * Example: /api/users routes
 * CRUD operations for users
 */

import { NextResponse } from "@foxen/core";
import type { NextRequest } from "@foxen/core";

// In-memory user store (for demo purposes)
const users = new Map<string, { id: string; name: string; email: string }>();
let nextId = 1;

// GET /api/users - List all users
export async function GET(request: NextRequest) {
    const url = request.nextUrl;
    const limit = Number(url.searchParams.get("limit")) || 10;
    const offset = Number(url.searchParams.get("offset")) || 0;

    const allUsers = Array.from(users.values());
    const paginatedUsers = allUsers.slice(offset, offset + limit);

    return NextResponse.json({
        users: paginatedUsers,
        total: allUsers.length,
        limit,
        offset,
    });
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.name || !body.email) {
            return NextResponse.json(
                { error: "Name and email are required" },
                { status: 400 },
            );
        }

        const id = String(nextId++);
        const user = { id, name: body.name, email: body.email };
        users.set(id, user);

        return NextResponse.json(user, { status: 201 });
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 },
        );
    }
}
