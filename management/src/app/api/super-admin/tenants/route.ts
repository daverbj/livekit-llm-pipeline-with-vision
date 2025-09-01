import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/super-admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const superAdmin = await verifySuperAdmin(request);
    if (!superAdmin) {
      return NextResponse.json({ error: 'Unauthorized - Super Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const blocked = searchParams.get('blocked');

    const offset = (page - 1) * limit;

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { domain: { contains: search, mode: 'insensitive' as const } }
        ]
      }),
      ...(blocked && { isBlocked: blocked === 'true' })
    };

    const [tenants, totalTenants] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              projects: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.tenant.count({ where })
    ]);

    // Get token usage for each tenant
    const tenantsWithTokenUsage = await Promise.all(
      tenants.map(async (tenant) => {
        const tokenUsage = await prisma.session.aggregate({
          where: {
            project: {
              tenantId: tenant.id
            }
          },
          _sum: {
            inputTokens: true,
            outputTokens: true,
            totalTokens: true
          }
        });

        return {
          ...tenant,
          tokenUsage: {
            inputTokens: tokenUsage._sum.inputTokens || 0,
            outputTokens: tokenUsage._sum.outputTokens || 0,
            totalTokens: tokenUsage._sum.totalTokens || 0
          }
        };
      })
    );

    const totalPages = Math.ceil(totalTenants / limit);

    return NextResponse.json({
      tenants: tenantsWithTokenUsage,
      pagination: {
        page,
        limit,
        totalTenants,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const superAdmin = await verifySuperAdmin(request);
    if (!superAdmin) {
      return NextResponse.json({ error: 'Unauthorized - Super Admin access required' }, { status: 403 });
    }

    const { name, domain } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        domain,
        isBlocked: false
      },
      include: {
        _count: {
          select: {
            users: true,
            projects: true
          }
        }
      }
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const superAdmin = await verifySuperAdmin(request);
    if (!superAdmin) {
      return NextResponse.json({ error: 'Unauthorized - Super Admin access required' }, { status: 403 });
    }

    const { tenantId, action } = await request.json();

    if (!tenantId || !action) {
      return NextResponse.json({ error: 'Tenant ID and action are required' }, { status: 400 });
    }

    let updateData: any = {};
    
    switch (action) {
      case 'block':
        updateData.isBlocked = true;
        break;
      case 'unblock':
        updateData.isBlocked = false;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      include: {
        _count: {
          select: {
            users: true,
            projects: true
          }
        }
      }
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Error updating tenant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
