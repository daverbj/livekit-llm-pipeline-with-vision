import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const blocked = searchParams.get('blocked') || '';

    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.role = role;
    }

    if (blocked !== '') {
      where.isBlocked = blocked === 'true';
    }

    // Get users with pagination
    const [users, totalUsers] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isBlocked: true,
          createdAt: true,
          _count: {
            select: {
              projects: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({ where })
    ]);

    const totalPages = Math.ceil(totalUsers / limit);

    return NextResponse.json({
      users: users.map(user => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        projectCount: user._count.projects
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
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { userId, action } = await request.json();

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action are required' }, { status: 400 });
    }

    let updateData: any = {};

    switch (action) {
      case 'block':
        updateData.isBlocked = true;
        break;
      case 'unblock':
        updateData.isBlocked = false;
        break;
      case 'makeAdmin':
        updateData.role = 'ADMIN';
        break;
      case 'removeAdmin':
        updateData.role = 'USER';
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isBlocked: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        createdAt: updatedUser.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
