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

    // Get current date and start of day
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    
    // Get tenant-specific counts
    const [totalUsers, totalProjects, totalVideos, totalAdmins, blockedUsers] = await Promise.all([
      prisma.user.count({
        where: { tenantId: admin.tenantId }
      }),
      prisma.project.count({
        where: { tenantId: admin.tenantId }
      }),
      prisma.video.count({
        where: {
          project: {
            tenantId: admin.tenantId
          }
        }
      }),
      prisma.user.count({
        where: {
          tenantId: admin.tenantId,
          role: 'ADMIN'
        }
      }),
      prisma.user.count({
        where: {
          tenantId: admin.tenantId,
          isBlocked: true
        }
      })
    ]);

    // Get today's activity for the tenant
    const [newUsersToday, newProjectsToday, newVideosToday] = await Promise.all([
      prisma.user.count({
        where: {
          tenantId: admin.tenantId,
          createdAt: {
            gte: startOfDay
          }
        }
      }),
      prisma.project.count({
        where: {
          tenantId: admin.tenantId,
          createdAt: {
            gte: startOfDay
          }
        }
      }),
      prisma.video.count({
        where: {
          createdAt: {
            gte: startOfDay
          },
          project: {
            tenantId: admin.tenantId
          }
        }
      })
    ]);

    // Get videos processing today for the tenant
    const videosProcessingToday = await prisma.video.count({
      where: {
        createdAt: {
          gte: startOfDay
        },
        processingStatus: {
          notIn: ['COMPLETED', 'FAILED']
        },
        project: {
          tenantId: admin.tenantId
        }
      }
    });

    // Get video status distribution for the tenant
    const videoStatusCounts = await prisma.video.groupBy({
      by: ['processingStatus'],
      where: {
        project: {
          tenantId: admin.tenantId
        }
      },
      _count: {
        _all: true
      }
    });

    const videoStatusDistribution = videoStatusCounts.reduce((acc, item) => {
      acc[item.processingStatus] = item._count._all;
      return acc;
    }, {} as Record<string, number>);

    // Get user growth for the last 7 days within the tenant
    const userGrowth = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDate = new Date(startOfDate);
      endOfDate.setDate(endOfDate.getDate() + 1);

      const usersOnDate = await prisma.user.count({
        where: {
          tenantId: admin.tenantId,
          createdAt: {
            gte: startOfDate,
            lt: endOfDate
          }
        }
      });

      userGrowth.push({
        date: startOfDate.toISOString().split('T')[0],
        users: usersOnDate
      });
    }

    // Get most active users (by project count) within the tenant
    const mostActiveUsers = await prisma.user.findMany({
      where: {
        tenantId: admin.tenantId
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isBlocked: true,
        _count: {
          select: {
            projects: true
          }
        }
      },
      orderBy: {
        projects: {
          _count: 'desc'
        }
      },
      take: 10
    });

    // Get recent activity (last 20 items) within the tenant
    const recentActivity = await prisma.$queryRaw<any[]>`
      SELECT 'user' as type, u.username as name, u."createdAt" as timestamp, u.id
      FROM users u
      WHERE u."createdAt" >= ${startOfWeek} AND u."tenantId" = ${admin.tenantId}
      UNION ALL
      SELECT 'project' as type, p.name, p."createdAt" as timestamp, p.id
      FROM projects p
      WHERE p."createdAt" >= ${startOfWeek} AND p."tenantId" = ${admin.tenantId}
      UNION ALL
      SELECT 'video' as type, v."originalName" as name, v."createdAt" as timestamp, v.id
      FROM videos v
      JOIN projects p ON v."projectId" = p.id
      WHERE v."createdAt" >= ${startOfWeek} AND p."tenantId" = ${admin.tenantId}
      ORDER BY timestamp DESC
      LIMIT 20
    `;

    // Get average processing time for completed videos within the tenant
    const completedVideos = await prisma.video.findMany({
      where: {
        processingStatus: 'COMPLETED',
        project: {
          tenantId: admin.tenantId
        }
      },
      select: {
        createdAt: true,
        updatedAt: true
      }
    });

    const avgProcessingTime = completedVideos.length > 0 
      ? completedVideos.reduce((sum, video) => {
          const processingTime = video.updatedAt.getTime() - video.createdAt.getTime();
          return sum + processingTime;
        }, 0) / completedVideos.length / 1000 / 60 // Convert to minutes
      : 0;

    // Get backend status
    let backendStatus = 'offline';
    try {
      const backendResponse = await fetch('http://localhost:8000/health', {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      if (backendResponse.ok) {
        backendStatus = 'online';
      }
    } catch (error) {
      console.log('Backend health check unavailable:', error);
    }

    // Get token usage for the tenant
    const totalTokenUsage = await prisma.session.aggregate({
      where: {
        project: {
          tenantId: admin.tenantId
        }
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true
      }
    });

    // Get token usage today for the tenant
    const todayTokenUsage = await prisma.session.aggregate({
      where: {
        createdAt: {
          gte: startOfDay
        },
        project: {
          tenantId: admin.tenantId
        }
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true
      }
    });

    const analyticsData = {
      totalUsers,
      totalProjects,
      totalVideos,
      totalAdmins,
      blockedUsers,
      backendStatus,
      tokenUsage: {
        total: {
          inputTokens: totalTokenUsage._sum.inputTokens || 0,
          outputTokens: totalTokenUsage._sum.outputTokens || 0,
          totalTokens: totalTokenUsage._sum.totalTokens || 0
        },
        today: {
          inputTokens: todayTokenUsage._sum.inputTokens || 0,
          outputTokens: todayTokenUsage._sum.outputTokens || 0,
          totalTokens: todayTokenUsage._sum.totalTokens || 0
        }
      },
      recentActivity: {
        newUsersToday,
        newProjectsToday,
        newVideosToday,
        videosProcessingToday
      },
      videoStatusDistribution,
      userGrowth,
      mostActiveUsers,
      recentActivityItems: recentActivity.map(item => ({
        type: item.type,
        name: item.name,
        timestamp: item.timestamp,
        id: item.id
      })),
      avgProcessingTime: Math.round(avgProcessingTime * 100) / 100, // Round to 2 decimal places
      systemHealth: {
        database: 'online',
        backend: backendStatus
      }
    };

    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
