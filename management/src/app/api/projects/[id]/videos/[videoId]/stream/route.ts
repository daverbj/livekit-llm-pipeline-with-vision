import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { createReadStream, statSync } from 'fs';
import { existsSync } from 'fs';

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

    // Verify project belongs to tenant and get video
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        projectId: id,
        project: {
          tenantId: user.tenantId
        }
      }
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (!existsSync(video.filePath)) {
      return NextResponse.json({ error: 'Video file not found on disk' }, { status: 404 });
    }

    const stat = statSync(video.filePath);
    const fileSize = stat.size;
    const range = request.headers.get('range');

    if (range) {
      // Handle range requests for video streaming
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      const headers = new Headers({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': 'video/mp4',
      });

      const stream = createReadStream(video.filePath, { start, end });
      
      // Convert Node.js ReadStream to Web ReadableStream
      const readableStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk: string | Buffer) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            controller.enqueue(new Uint8Array(buffer));
          });
          stream.on('end', () => {
            controller.close();
          });
          stream.on('error', (err) => {
            controller.error(err);
          });
        },
        cancel() {
          stream.destroy();
        }
      });
      
      return new Response(readableStream, {
        status: 206,
        headers,
      });
    } else {
      // No range request, serve the entire file
      const headers = new Headers({
        'Content-Length': fileSize.toString(),
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      });

      const stream = createReadStream(video.filePath);
      
      // Convert Node.js ReadStream to Web ReadableStream
      const readableStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk: string | Buffer) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            controller.enqueue(new Uint8Array(buffer));
          });
          stream.on('end', () => {
            controller.close();
          });
          stream.on('error', (err) => {
            controller.error(err);
          });
        },
        cancel() {
          stream.destroy();
        }
      });
      
      return new Response(readableStream, {
        status: 200,
        headers,
      });
    }
  } catch (error) {
    console.error('Error streaming video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
