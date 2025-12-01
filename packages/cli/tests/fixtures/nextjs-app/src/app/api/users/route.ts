import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
    ];

    return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
    const body = await request.json();

    const newUser = {
        id: Date.now(),
        name: body.name,
    };

    return NextResponse.json({ user: newUser }, { status: 201 });
}
