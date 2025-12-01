import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
    const authHeader = request.headers.get('authorization');

    if (!authHeader && request.nextUrl.pathname.startsWith('/api/protected')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/api/:path*'],
};
