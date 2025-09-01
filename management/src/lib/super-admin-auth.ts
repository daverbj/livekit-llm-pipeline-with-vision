import { NextRequest } from 'next/server';
import { verifyAuth } from './auth';

export async function verifySuperAdmin(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    
    if (!user) {
      return null;
    }

    if (user.role !== 'SUPER_ADMIN') {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
}

export function isSuperAdmin(user: any): boolean {
  return user && user.role === 'SUPER_ADMIN';
}

export async function verifyTenantAdmin(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    
    if (!user) {
      return null;
    }

    // Super admin can access any tenant
    if (user.role === 'SUPER_ADMIN') {
      return user;
    }

    // Tenant admin can only access their own tenant
    if (user.role === 'ADMIN' && user.tenantId) {
      return user;
    }

    return null;
  } catch (error) {
    return null;
  }
}

export function isTenantAdmin(user: any): boolean {
  return user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');
}
