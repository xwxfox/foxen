import { headers, cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { NextResponse } from 'next/server';

export async function GET() {
    const hdrs = headers();
    if (!hdrs.get('x-session')) {
        redirect('/login');
    }

    const jar = cookies();
    jar.set('session-token', 'abc', { httpOnly: true });

    return NextResponse.json({ ok: true });
}

export async function POST() {
    notFound();
}
