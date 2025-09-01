export interface User {
  id: string;
  email: string;
  username: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  isBlocked: boolean;
  tenantId?: string; // null for super admin
  tenant?: Tenant;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  isBlocked: boolean;
  createdAt: string;
  _count?: {
    users: number;
    projects: number;
  };
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  token?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
