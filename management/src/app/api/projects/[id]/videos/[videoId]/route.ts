import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { hashStringToInt } from '@/lib/hash-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.tenantId) {
      return NextResponse.json({ error: 'User must be associated with a tenant' }, { status: 400 });
    }

    const { id, videoId } = await params;

    // Verify project belongs to tenant and get video (any user in tenant can view)
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        projectId: id,
        project: {
          tenantId: user.tenantId
        }
      },
      include: {
        project: true
      }
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Parse tutorial steps if they exist
    let tutorialSteps = null;
    if (video.tutorialSteps) {
      try {
        tutorialSteps = JSON.parse(video.tutorialSteps);
      } catch (error) {
        console.error('Error parsing tutorial steps:', error);
      }
    }

    return NextResponse.json({ 
      video: {
        ...video,
        tutorialSteps
      }
    });
  } catch (error) {
    console.error('Error fetching video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only tenant admins can edit videos
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only tenant admins can edit videos' }, { status: 403 });
    }

    if (!user.tenantId) {
      return NextResponse.json({ error: 'Admin must be associated with a tenant' }, { status: 400 });
    }

    const { id, videoId } = await params;

    // Verify project belongs to tenant
    const existingVideo = await prisma.video.findFirst({
      where: {
        id: videoId,
        projectId: id,
        project: {
          tenantId: user.tenantId
        }
      }
    });

    if (!existingVideo) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const body = await request.json();
    const { description } = body;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ error: 'Video description is required' }, { status: 400 });
    }

    const video = await prisma.video.update({
      where: {
        id: videoId
      },
      data: {
        description: description.trim()
      }
    });

    return NextResponse.json({ video });
  } catch (error) {
    console.error('Error updating video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only tenant admins can delete videos
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only tenant admins can delete videos' }, { status: 403 });
    }

    if (!user.tenantId) {
      return NextResponse.json({ error: 'Admin must be associated with a tenant' }, { status: 400 });
    }

    const { id, videoId } = await params;

    // Verify project belongs to tenant and get video
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        projectId: id,
        project: {
          tenantId: user.tenantId
        }
      },
      include: {
        project: true
      }
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    try {
      // Delete video file
      if (existsSync(video.filePath)) {
        await unlink(video.filePath);
      }

      // Delete audio file if it exists
      if (video.audioPath && existsSync(video.audioPath)) {
        await unlink(video.audioPath);
      }

      // Remove from Qdrant
      const { qdrantClient, normalizeCollectionName } = await import('@/lib/qdrant');
      try {
        // Convert videoId to the same hashed integer used when storing
        const pointId = hashStringToInt(videoId);
        const normalizedCollectionName = normalizeCollectionName(video.project.collectionName);
        
        console.log(`Deleting video from Qdrant: videoId=${videoId}, hashedPointId=${pointId}, collection=${normalizedCollectionName}`);
        
        await qdrantClient.delete(normalizedCollectionName, {
          wait: true,
          points: [pointId]
        });
        
        console.log(`Successfully removed video ${videoId} from Qdrant`);
      } catch (qdrantError) {
        console.error('Error removing video from Qdrant:', qdrantError);
        
        // Log detailed error information
        if (qdrantError && typeof qdrantError === 'object') {
          if ('data' in qdrantError) {
            console.error('Qdrant delete error data:', JSON.stringify(qdrantError.data, null, 2));
          }
        }
        
        // Continue with deletion even if Qdrant removal fails
      }
    } catch (fileError) {
      console.error('Error deleting files:', fileError);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await prisma.video.delete({
      where: {
        id: videoId
      }
    });

    return NextResponse.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
