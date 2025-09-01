import { NextRequest } from 'next/server';
import { verifyAuth } from './auth';

export async function verifyAdmin(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    
    if (!user) {
      return null;
    }

    if (user.role !== 'ADMIN') {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
}

export function isAdmin(user: any): boolean {
  return user && user.role === 'ADMIN';
}
