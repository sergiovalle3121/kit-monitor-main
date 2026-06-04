import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    const res = await fetch(`${API_URL}/tcode/search?q=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error searching T-Codes:', error);
    return NextResponse.json(
      { message: 'Error al buscar T-Codes' },
      { status: 500 }
    );
  }
}
