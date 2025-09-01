import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = {
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        apiKey: process.env.OPENAI_API_KEY ? 'Present' : 'Missing',
        status: 'Unknown',
        error: undefined as string | undefined
      },
      huggingface: {
        configured: !!process.env.HF_API_TOKEN,
        apiKey: process.env.HF_API_TOKEN ? 'Present' : 'Missing',
        status: 'Unknown',
        error: undefined as string | undefined
      },
      qdrant: {
        host: process.env.QDRANT_HOST || 'localhost',
        port: process.env.QDRANT_PORT || '6333',
        url: `http://${process.env.QDRANT_HOST || 'localhost'}:${process.env.QDRANT_PORT || '6333'}`,
        status: 'Unknown',
        error: undefined as string | undefined
      },
      environment: process.env.NODE_ENV || 'development'
    };

    // Test OpenAI connection
    if (status.openai.configured) {
      try {
        const { OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        await openai.models.list();
        status.openai.status = 'Connected';
      } catch (error) {
        status.openai.status = 'Failed';
        status.openai.error = error instanceof Error ? error.message : 'Unknown error';
      }
    } else {
      status.openai.status = 'Not configured';
    }

    // Test HuggingFace connection
    if (status.huggingface.configured) {
      try {
        const { HfInference } = await import('@huggingface/inference');
        const hf = new HfInference(process.env.HF_API_TOKEN);
        // Simple test - just initialize, don't make actual API call
        status.huggingface.status = 'Configured';
      } catch (error) {
        status.huggingface.status = 'Failed';
        status.huggingface.error = error instanceof Error ? error.message : 'Unknown error';
      }
    } else {
      status.huggingface.status = 'Not configured';
    }

    // Test Qdrant connection
    try {
      const { qdrantClient } = await import('@/lib/qdrant');
      await qdrantClient.getCollections();
      status.qdrant.status = 'Connected';
    } catch (error) {
      status.qdrant.status = 'Failed';
      status.qdrant.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error('Error checking system status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
