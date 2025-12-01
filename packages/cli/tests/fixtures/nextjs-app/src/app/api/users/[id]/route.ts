import { NextRequest, NextResponse } from 'next/server';

type Params = {
    params: {
        id: string;
    };
};

export async function GET(
    request: NextRequest,
    { params }: Params
) {
    const user = { id: params.id, name: 'Test User' };
    return NextResponse.json({ user });
}

export async function PUT(
    request: NextRequest,
    { params }: Params
) {
    const body = await request.json();
    const updatedUser = { id: params.id, ...body };
    return NextResponse.json({ user: updatedUser });
}

export async function DELETE(
    request: NextRequest,
    { params }: Params
) {
    return NextResponse.json({ success: true });
}
