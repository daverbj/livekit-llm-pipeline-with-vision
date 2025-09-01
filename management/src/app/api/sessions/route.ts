import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/sessions - Get all sessions for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const whereClause: any = {
      userId: user.id,
      tenantId: user.tenantId,
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const totalCount = await prisma.session.count({
      where: whereClause
    });

    return NextResponse.json({
      sessions,
      totalCount,
      hasMore: totalCount > offset + limit
    });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
  try {
    console.log('📝 POST /api/sessions - Creating new session');
    
    const user = await verifyAuth(request);
    if (!user) {
      console.log('❌ Authentication failed for session creation');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`✅ Authenticated user: ${user.email} (${user.id})`);

    const body = await request.json();
    const { sessionId, projectId } = body;
    
    console.log(`📋 Session data: sessionId=${sessionId}, projectId=${projectId}`);

    if (!sessionId || !projectId) {
      console.log('❌ Missing required fields: sessionId or projectId');
      return NextResponse.json(
        { error: 'sessionId and projectId are required' },
        { status: 400 }
      );
    }

    // Verify project belongs to user's tenant (tenant-wide access)
    console.log(`🔍 Looking for project: id=${projectId}, tenantId=${user.tenantId}`);
    
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId: user.tenantId
      }
    });

    if (!project) {
      console.log(`❌ Project not found or not accessible: ${projectId}`);
      
      // Let's also check what projects the user's tenant has access to
      const tenantProjects = await prisma.project.findMany({
        where: {
          tenantId: user.tenantId
        },
        select: { id: true, name: true, user: { select: { email: true } } }
      });
      
      console.log(`🏢 Tenant's available projects:`, tenantProjects);
      
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Found project: ${project.name}`);

    // Create session
    const session = await prisma.session.create({
      data: {
        sessionId,
        userId: user.id,
        projectId,
        tenantId: user.tenantId || '',
        status: 'ACTIVE'
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    });

    console.log(`✅ Created session: ${session.id}`);
    return NextResponse.json(session, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
