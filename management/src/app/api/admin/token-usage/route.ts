import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    if (!admin.tenantId) {
      return NextResponse.json({ error: 'Admin must be associated with a tenant' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'totalTokens'; // totalTokens, inputTokens, outputTokens
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const offset = (page - 1) * limit;

    // Build where clause for user search
    const whereClause: any = {
      tenantId: admin.tenantId
    };

    if (search) {
      whereClause.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get users with their token usage (based on sessions they created, not projects they own)
    const usersWithTokenUsage = await prisma.user.findMany({
      where: whereClause,
      include: {
        sessions: {
          select: {
            inputTokens: true,
            outputTokens: true,
            totalTokens: true,
            createdAt: true
          }
        },
        projects: {
          select: {
            id: true,
            name: true
          }
        }
      },
      skip: offset,
      take: limit
    });

    // Get total count for pagination
    const totalUsers = await prisma.user.count({
      where: whereClause
    });

    // Process the data to calculate token usage per user (using user's sessions directly)
    const processedUsers = usersWithTokenUsage.map(user => {
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalTokensSum = 0;
      let sessionCount = user.sessions.length;

      // Calculate totals from all sessions created by this user
      user.sessions.forEach(session => {
        totalInputTokens += session.inputTokens || 0;
        totalOutputTokens += session.outputTokens || 0;
        totalTokensSum += session.totalTokens || 0;
      });

      // Calculate token usage for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let last30DaysInputTokens = 0;
      let last30DaysOutputTokens = 0;
      let last30DaysTotalTokens = 0;

      user.sessions.forEach(session => {
        if (session.createdAt >= thirtyDaysAgo) {
          last30DaysInputTokens += session.inputTokens || 0;
          last30DaysOutputTokens += session.outputTokens || 0;
          last30DaysTotalTokens += session.totalTokens || 0;
        }
      });

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        projectCount: user.projects.length,
        sessionCount,
        tokenUsage: {
          total: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalTokens: totalTokensSum
          },
          last30Days: {
            inputTokens: last30DaysInputTokens,
            outputTokens: last30DaysOutputTokens,
            totalTokens: last30DaysTotalTokens
          }
        }
      };
    });

    // Sort by the requested field
    processedUsers.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'inputTokens':
          aValue = a.tokenUsage.total.inputTokens;
          bValue = b.tokenUsage.total.inputTokens;
          break;
        case 'outputTokens':
          aValue = a.tokenUsage.total.outputTokens;
          bValue = b.tokenUsage.total.outputTokens;
          break;
        case 'totalTokens':
        default:
          aValue = a.tokenUsage.total.totalTokens;
          bValue = b.tokenUsage.total.totalTokens;
          break;
      }

      if (sortOrder === 'desc') {
        return bValue - aValue;
      } else {
        return aValue - bValue;
      }
    });

    const totalPages = Math.ceil(totalUsers / limit);

    return NextResponse.json({
      users: processedUsers,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages
      }
    });

  } catch (error) {
    console.error('Error fetching user token usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user token usage data' },
      { status: 500 }
    );
  }
}
