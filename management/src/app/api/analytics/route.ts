import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.tenantId) {
      return NextResponse.json({ error: 'User must be associated with a tenant' }, { status: 400 });
    }

    // Get current date and start of day
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    
    // Get tenant-specific counts (all users in tenant can see tenant-wide data)
    const [totalProjects, totalVideos] = await Promise.all([
      prisma.project.count({
        where: {
          tenantId: user.tenantId
        }
      }),
      prisma.video.count({
        where: {
          project: {
            tenantId: user.tenantId
          }
        }
      })
    ]);

    // Get today's activity for the tenant
    const [newProjectsToday, newVideosToday] = await Promise.all([
      prisma.project.count({
        where: {
          tenantId: user.tenantId,
          createdAt: {
            gte: startOfDay
          }
        }
      }),
      prisma.video.count({
        where: {
          project: {
            tenantId: user.tenantId
          },
          createdAt: {
            gte: startOfDay
          }
        }
      })
    ]);

    // Get videos processing today for the tenant
    const videosProcessingToday = await prisma.video.count({
      where: {
        project: {
          tenantId: user.tenantId
        },
        createdAt: {
          gte: startOfDay
        },
        processingStatus: {
          notIn: ['COMPLETED', 'FAILED']
        }
      }
    });

    // Get video status distribution for the tenant
    const videoStatusCounts = await prisma.video.groupBy({
      by: ['processingStatus'],
      where: {
        project: {
          tenantId: user.tenantId
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

    // Get project growth for the last 7 days for the tenant
    const projectGrowth = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDate = new Date(startOfDate);
      endOfDate.setDate(endOfDate.getDate() + 1);

      const projectsOnDate = await prisma.project.count({
        where: {
          tenantId: user.tenantId,
          createdAt: {
            gte: startOfDate,
            lt: endOfDate
          }
        }
      });

      projectGrowth.push({
        date: startOfDate.toISOString().split('T')[0],
        projects: projectsOnDate
      });
    }

    // Get tenant's recent activity (last 10 items)
    const recentActivity = await prisma.$queryRaw<any[]>`
      SELECT 'project' as type, p.name, p."createdAt" as timestamp, p.id
      FROM projects p
      WHERE p."tenantId" = ${user.tenantId} AND p."createdAt" >= ${startOfWeek}
      UNION ALL
      SELECT 'video' as type, v."originalName" as name, v."createdAt" as timestamp, v.id
      FROM videos v
      JOIN projects p ON v."projectId" = p.id
      WHERE p."tenantId" = ${user.tenantId} AND v."createdAt" >= ${startOfWeek}
      ORDER BY timestamp DESC
      LIMIT 10
    `;

    // Get average processing time for completed videos in the tenant
    const completedVideos = await prisma.video.findMany({
      where: {
        project: {
          tenantId: user.tenantId
        },
        processingStatus: 'COMPLETED'
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

    // Get backend status (without connections data)
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

    const analyticsData = {
      totalProjects,
      totalVideos,
      backendStatus,
      recentActivity: {
        newProjectsToday,
        newVideosToday,
        videosProcessingToday
      },
      videoStatusDistribution,
      projectGrowth,
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
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
