import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '@/types/auth';
import { prisma } from './prisma';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hashedPassword: string): boolean {
  return bcrypt.compareSync(password, hashedPassword);
}

export function generateToken(user: User): string {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      username: user.username,
      role: user.role,
      isBlocked: user.isBlocked,
      tenantId: user.tenantId
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): User | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as User;
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function createUser(username: string, email: string, password: string, tenantId: string): Promise<User> {
  const hashedPassword = hashPassword(password);
  
  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      tenantId,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isBlocked: true,
      tenantId: true,
      createdAt: true,
    },
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isBlocked: user.isBlocked,
    tenantId: user.tenantId || undefined,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function findUserByEmail(email: string, tenantId?: string): Promise<(User & { password: string }) | null> {
  const user = await prisma.user.findFirst({
    where: { 
      email,
      ...(tenantId ? { tenantId } : {})
    },
    include: {
      tenant: true
    }
  });

  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isBlocked: user.isBlocked,
    tenantId: user.tenantId || undefined,
    tenant: user.tenant ? {
      id: user.tenant.id,
      name: user.tenant.name,
      domain: user.tenant.domain || undefined,
      isBlocked: user.tenant.isBlocked,
      createdAt: user.tenant.createdAt.toISOString(),
    } : undefined,
    password: user.password,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function findUserById(id: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isBlocked: true,
      tenantId: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          domain: true,
          isBlocked: true,
          createdAt: true,
        }
      }
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isBlocked: user.isBlocked,
    tenantId: user.tenantId || undefined,
    tenant: user.tenant ? {
      id: user.tenant.id,
      name: user.tenant.name,
      domain: user.tenant.domain || undefined,
      isBlocked: user.tenant.isBlocked,
      createdAt: user.tenant.createdAt.toISOString(),
    } : undefined,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function verifyAuth(request: NextRequest): Promise<User | null> {
  try {
    // Try Authorization header first
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Fall back to cookie
      token = request.cookies.get('auth_token')?.value || null;
    }

    if (!token) {
      return null;
    }

    const decodedUser = verifyToken(token);

    if (!decodedUser) {
      return null;
    }

    // Fetch the current user from database to ensure it still exists
    const user = await findUserById(decodedUser.id);
    
    // Check if user or tenant is blocked
    if (user && (user.isBlocked || user.tenant?.isBlocked)) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}
