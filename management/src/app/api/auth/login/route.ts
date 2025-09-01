import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, comparePassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return NextResponse.json(
        { success: false, message: 'Account has been suspended. Contact administrator.' },
        { status: 403 }
      );
    }

    // Check if tenant is blocked
    if (user.tenant?.isBlocked) {
      return NextResponse.json(
        { success: false, message: 'Organization access has been suspended. Contact administrator.' },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = comparePassword(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate token
    const { password: _, ...userWithoutPassword } = user;
    const token = generateToken(userWithoutPassword);

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
