import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get backend status from health endpoint
    let backendStatus = 'offline';
    
    try {
      const backendResponse = await fetch('http://localhost:8000/health', {
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });
      if (backendResponse.ok) {
        backendStatus = 'online';
      }
    } catch (error) {
      console.log('Backend health check unavailable:', error);
    }

    return NextResponse.json({
      backendStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching realtime analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch realtime analytics data' },
      { status: 500 }
    );
  }
}
