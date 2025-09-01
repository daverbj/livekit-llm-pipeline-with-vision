import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/sessions/[sessionId] - Update session (end session, update tokens)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = await params;
    const body = await request.json();

    // Find session and verify ownership
    const existingSession = await prisma.session.findFirst({
      where: {
        sessionId,
        userId: user.id,
        tenantId: user.tenantId
      }
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const updateData: any = {};

    // Handle session ending
    if (body.status && body.status !== 'ACTIVE') {
      updateData.status = body.status;
      updateData.endTime = new Date();
      
      // Calculate duration if not provided
      if (!updateData.durationSeconds && existingSession.startTime) {
        const duration = Math.floor((updateData.endTime.getTime() - existingSession.startTime.getTime()) / 1000);
        updateData.durationSeconds = duration;
      }
    }

    // Handle duration update
    if (body.durationSeconds !== undefined) {
      updateData.durationSeconds = body.durationSeconds;
    }

    // Handle token updates
    if (body.tokenUpdate) {
      const {
        inputTokens,
        outputTokens,
        totalTokens,
        textInputTokens,
        audioInputTokens,
        videoInputTokens,
        audioOutputTokens,
        textOutputTokens
      } = body.tokenUpdate;

      if (inputTokens !== undefined) updateData.inputTokens = inputTokens;
      if (outputTokens !== undefined) updateData.outputTokens = outputTokens;
      if (totalTokens !== undefined) updateData.totalTokens = totalTokens;
      if (textInputTokens !== undefined) updateData.textInputTokens = textInputTokens;
      if (audioInputTokens !== undefined) updateData.audioInputTokens = audioInputTokens;
      if (videoInputTokens !== undefined) updateData.videoInputTokens = videoInputTokens;
      if (audioOutputTokens !== undefined) updateData.audioOutputTokens = audioOutputTokens;
      if (textOutputTokens !== undefined) updateData.textOutputTokens = textOutputTokens;
    }

    // Handle error messages
    if (body.errorMessage !== undefined) {
      updateData.errorMessage = body.errorMessage;
    }

    // Update session
    const updatedSession = await prisma.session.update({
      where: { id: existingSession.id },
      data: updateData,
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

    return NextResponse.json(updatedSession);

  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/sessions/[sessionId] - Get specific session
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = await params;

    const session = await prisma.session.findFirst({
      where: {
        sessionId,
        userId: user.id,
        tenantId: user.tenantId
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

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);

  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
