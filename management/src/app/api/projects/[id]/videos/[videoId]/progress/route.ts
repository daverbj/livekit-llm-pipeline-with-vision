import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Store active SSE connections
const connections = new Map<string, WritableStreamDefaultWriter>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!user.tenantId) {
      return new Response('User must be associated with a tenant', { status: 400 });
    }

    const { id: projectId, videoId } = await params;

    // Verify user has access to this project through tenant
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId: user.tenantId
      }
    });

    if (!project) {
      return new Response('Project not found', { status: 404 });
    }

    // Verify video exists in this project
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        projectId: projectId
      }
    });

    if (!video) {
      return new Response('Video not found', { status: 404 });
    }

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        // Send initial status
        const sendUpdate = (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        // Send current status immediately
        sendUpdate({
          videoId,
          status: video.processingStatus,
          timestamp: new Date().toISOString()
        });

        // Store connection for updates
        const connectionId = `${projectId}-${videoId}`;
        const writer = controller as any;
        connections.set(connectionId, writer);

        // Set up periodic status check
        const interval = setInterval(async () => {
          try {
            const updatedVideo = await prisma.video.findUnique({
              where: { id: videoId }
            });

            if (updatedVideo) {
              sendUpdate({
                videoId,
                status: updatedVideo.processingStatus,
                timestamp: new Date().toISOString()
              });

              // Stop sending updates if video is in final state
              if (['COMPLETED', 'FAILED'].includes(updatedVideo.processingStatus)) {
                clearInterval(interval);
                connections.delete(connectionId);
                controller.close();
              }
            }
          } catch (error) {
            console.error('Error checking video status:', error);
          }
        }, 1000); // Check every second

        // Cleanup on connection close
        request.signal.addEventListener('abort', () => {
          clearInterval(interval);
          connections.delete(connectionId);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('SSE error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

// Function to broadcast status updates to specific video connections
export function broadcastVideoProgress(projectId: string, videoId: string, status: string) {
  const connectionId = `${projectId}-${videoId}`;
  const connection = connections.get(connectionId);
  
  if (connection) {
    try {
      const encoder = new TextEncoder();
      const message = `data: ${JSON.stringify({
        videoId,
        status,
        timestamp: new Date().toISOString()
      })}\n\n`;
      
      connection.write(encoder.encode(message));
    } catch (error) {
      console.error('Error broadcasting to SSE connection:', error);
      connections.delete(connectionId);
    }
  }
}
