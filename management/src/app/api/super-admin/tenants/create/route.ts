import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify super admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decodedUser = verifyToken(token);

    if (!decodedUser || decodedUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, message: 'Super Admin privileges required' },
        { status: 403 }
      );
    }

    const { tenantName, tenantDomain, adminUsername, adminEmail, adminPassword } = await request.json();

    // Validate input
    if (!tenantName || !adminUsername || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { success: false, message: 'Tenant name, admin username, email, and password are required' },
        { status: 400 }
      );
    }

    // Check if tenant name already exists
    const existingTenant = await prisma.tenant.findFirst({
      where: { name: tenantName }
    });

    if (existingTenant) {
      return NextResponse.json(
        { success: false, message: 'Tenant name already exists' },
        { status: 400 }
      );
    }

    // Check if admin email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: adminEmail }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Admin email already exists' },
        { status: 400 }
      );
    }

    // Create tenant and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          domain: tenantDomain || null,
          isBlocked: false,
        }
      });

      // Create admin user for the tenant
      const hashedPassword = hashPassword(adminPassword);
      const adminUser = await tx.user.create({
        data: {
          username: adminUsername,
          email: adminEmail,
          password: hashedPassword,
          role: 'ADMIN',
          tenantId: tenant.id,
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

      return { tenant, adminUser };
    });

    return NextResponse.json({
      success: true,
      message: 'Tenant and admin user created successfully',
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        domain: result.tenant.domain,
        isBlocked: result.tenant.isBlocked,
        createdAt: result.tenant.createdAt.toISOString(),
      },
      adminUser: {
        ...result.adminUser,
        createdAt: result.adminUser.createdAt.toISOString(),
      }
    });

  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
