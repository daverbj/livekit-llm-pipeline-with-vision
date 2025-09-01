import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { migrateCollectionNames } from '@/lib/migrate-collections';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow this in development for safety
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Migration only allowed in development' }, { status: 403 });
    }

    await migrateCollectionNames();

    return NextResponse.json({ message: 'Collection names migrated successfully' });
  } catch (error) {
    console.error('Error migrating collection names:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
