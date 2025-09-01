import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { extractAudioWithFallback, checkFFmpegInstallation } from '@/lib/video-processing';
import { transcribeAudio, generateTutorialSteps } from '@/lib/openai-client';
import { storeVideoInQdrant } from '@/lib/embeddings';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configure multer for file upload
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.tenantId) {
      return NextResponse.json({ error: 'User must be associated with a tenant' }, { status: 400 });
    }

    const { id } = await params;

    // Verify project belongs to tenant (any user in tenant can view videos)
    const project = await prisma.project.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const videos = await prisma.video.findMany({
      where: {
        projectId: id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only tenant admins can upload videos
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only tenant admins can upload videos' }, { status: 403 });
    }

    if (!user.tenantId) {
      return NextResponse.json({ error: 'Admin must be associated with a tenant' }, { status: 400 });
    }

    const { id } = await params;

    // Verify project belongs to the tenant (admin can upload to any project in their tenant)
    const project = await prisma.project.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('video') as File;
    const description = formData.get('description') as string;

    if (!file) {
      return NextResponse.json({ error: 'Video file is required' }, { status: 400 });
    }

    if (!description || description.trim().length === 0) {
      return NextResponse.json({ error: 'Video description is required' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload a video file.' }, { status: 400 });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.name);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const uploadsDir = path.join(process.cwd(), 'uploads', 'videos');
    const filePath = path.join(uploadsDir, uniqueFilename);

    // Ensure uploads directory exists
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save the file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create video record in database
    const video = await prisma.video.create({
      data: {
        filename: uniqueFilename,
        originalName: file.name,
        description: description.trim(),
        filePath: filePath,
        projectId: id,
        processingStatus: 'UPLOADED'
      }
    });

    // Start background processing
    processVideoInBackground(video.id, project.collectionName);

    return NextResponse.json({ 
      video: {
        ...video,
        processingStatus: 'UPLOADED'
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error uploading video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Background processing function
async function processVideoInBackground(videoId: string, collectionName: string) {
  // Helper function to update status and broadcast
  const updateStatus = async (status: 'UPLOADED' | 'EXTRACTING_AUDIO' | 'TRANSCRIBING' | 'GENERATING_STEPS' | 'EMBEDDING' | 'COMPLETED' | 'FAILED') => {
    await prisma.video.update({
      where: { id: videoId },
      data: { processingStatus: status }
    });
    
    // Broadcast to SSE clients
    console.log(`Video ${videoId} status updated to: ${status}`);
  };

  try {
    console.log(`Starting background processing for video ${videoId}`);

    // Get video from database
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { project: true }
    });

    if (!video) {
      throw new Error('Video not found');
    }

    const projectId = video.projectId;

    // Step 1: Extract audio
    await updateStatus('EXTRACTING_AUDIO');

    const audioDir = path.join(process.cwd(), 'uploads', 'audio');
    
    // Check FFmpeg installation first
    const ffmpegCheck = await checkFFmpegInstallation();
    console.log('FFmpeg check result:', ffmpegCheck);
    
    if (!ffmpegCheck.installed) {
      throw new Error(`FFmpeg is not properly installed: ${ffmpegCheck.error}`);
    }
    
    const audioPath = await extractAudioWithFallback(video.filePath, audioDir);

    await prisma.video.update({
      where: { id: videoId },
      data: { audioPath: audioPath }
    });

    // Step 2: Transcribe audio
    await updateStatus('TRANSCRIBING');

    let transcription = '';
    try {
      transcription = await transcribeAudio(audioPath);
      
      await prisma.video.update({
        where: { id: videoId },
        data: { transcription: transcription }
      });
    } catch (transcriptionError) {
      console.error('Transcription failed:', transcriptionError);
      
      // If OpenAI API key is missing, use a placeholder transcription
      if (transcriptionError instanceof Error && transcriptionError.message.includes('OPENAI_API_KEY')) {
        transcription = '[Transcription unavailable - OpenAI API key not configured]';
        await prisma.video.update({
          where: { id: videoId },
          data: { transcription: transcription }
        });
      } else {
        throw transcriptionError; // Re-throw other errors
      }
    }

    // Step 3: Generate tutorial steps
    await updateStatus('GENERATING_STEPS');

    let tutorialSteps: string[] = [];
    try {
      tutorialSteps = await generateTutorialSteps(transcription, video.description);
      
      await prisma.video.update({
        where: { id: videoId },
        data: { tutorialSteps: JSON.stringify(tutorialSteps) }
      });
    } catch (stepsError) {
      console.error('Tutorial steps generation failed:', stepsError);
      
      // If OpenAI API key is missing, use a placeholder
      if (stepsError instanceof Error && stepsError.message.includes('OPENAI_API_KEY')) {
        tutorialSteps = ['Tutorial steps unavailable - OpenAI API key not configured'];
        await prisma.video.update({
          where: { id: videoId },
          data: { tutorialSteps: JSON.stringify(tutorialSteps) }
        });
      } else {
        throw stepsError; // Re-throw other errors
      }
    }

    // Step 4: Store in Qdrant
    await updateStatus('EMBEDDING');

    try {
      await storeVideoInQdrant(
        collectionName,
        videoId,
        video.description,
        tutorialSteps,
        transcription
      );
    } catch (qdrantError) {
      console.error('Error storing video in Qdrant:', qdrantError);
      
      // Continue processing even if Qdrant storage fails
      // This allows the video to be marked as completed with transcription and steps
      if (qdrantError instanceof Error) {
        if (qdrantError.message.includes('HF_API_TOKEN') || qdrantError.message.includes('Invalid credentials')) {
          console.warn('HuggingFace API token not configured or invalid, skipping vector storage');
        } else {
          console.warn('Qdrant storage failed:', qdrantError.message);
        }
      }
      console.warn('Marking video as completed with available data (no vector storage)');
    }

    // Step 5: Mark as completed
    await updateStatus('COMPLETED');

    console.log(`Completed processing for video ${videoId}`);

  } catch (error) {
    console.error(`Error processing video ${videoId}:`, error);
    
    // Mark as failed with detailed error information
    await updateStatus('FAILED');
  }
}
