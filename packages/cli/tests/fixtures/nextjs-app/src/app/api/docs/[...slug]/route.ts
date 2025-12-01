import { NextRequest, NextResponse } from 'next/server';

type Params = {
    params: {
        slug: string[];
    };
};

export async function GET(
    request: NextRequest,
    { params }: Params
) {
    return NextResponse.json({
        slug: params.slug,
        path: `/${params.slug.join('/')}`
    });
}
