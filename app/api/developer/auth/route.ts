import { NextRequest, NextResponse } from 'next/server';

// POST - Developer login (hardcoded credentials for now)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Hardcoded credentials (same as before)
    if (username === 'luke@webstarts.com' && password === 'Dev74589900!') {
      return NextResponse.json({ 
        success: true,
        message: 'Authentication successful'
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

