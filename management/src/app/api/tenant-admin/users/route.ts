import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify tenant admin authentication
    const user = await verifyAuth(request);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'Admin privileges required' },
        { status: 403 }
      );
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, message: 'Tenant information missing' },
        { status: 400 }
      );
    }

    const { username, email, password, role = 'USER' } = await request.json();

    // Validate input
    if (!username || !email || !password) {
      return NextResponse.json(
        { success: false, message: 'Username, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate role (tenant admin can only create USER or ADMIN roles, not SUPER_ADMIN)
    if (!['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { success: false, message: 'Invalid role. Can only create USER or ADMIN roles.' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Email already exists' },
        { status: 400 }
      );
    }

    // Check if username already exists within the tenant
    const existingUsername = await prisma.user.findFirst({
      where: { 
        username,
        tenantId: user.tenantId
      }
    });

    if (existingUsername) {
      return NextResponse.json(
        { success: false, message: 'Username already exists in this tenant' },
        { status: 400 }
      );
    }

    // Create new user in the same tenant as the admin
    const hashedPassword = hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role,
        tenantId: user.tenantId,
        isBlocked: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isBlocked: true,
        tenantId: true,
        createdAt: true,
      }
    });

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        ...newUser,
        createdAt: newUser.createdAt.toISOString(),
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get users in the tenant (for admin to view)
export async function GET(request: NextRequest) {
  try {
    // Verify tenant admin authentication
    const user = await verifyAuth(request);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'Admin privileges required' },
        { status: 403 }
      );
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, message: 'Tenant information missing' },
        { status: 400 }
      );
    }

    // Get pagination parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    const role = url.searchParams.get('role') || '';

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      tenantId: user.tenantId
    };

    if (search) {
      whereClause.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      whereClause.role = role;
    }

    // Get users with pagination
    const [users, totalUsers] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isBlocked: true,
          tenantId: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(totalUsers / limit);

    return NextResponse.json({
      success: true,
      users: users.map(u => ({
        ...u,
        createdAt: u.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
