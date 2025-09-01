import { NextRequest, NextResponse } from 'next/server';
import { checkFFmpegInstallation } from '@/lib/video-processing';

export async function GET(request: NextRequest) {
  try {
    const ffmpegStatus = await checkFFmpegInstallation();
    
    return NextResponse.json({
      ffmpeg: ffmpegStatus,
      systemInfo: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      }
    });
  } catch (error) {
    console.error('Error checking FFmpeg:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check FFmpeg installation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
