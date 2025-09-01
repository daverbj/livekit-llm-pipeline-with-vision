import Cookies from 'js-cookie';
import { User } from '@/types/auth';

const TOKEN_KEY = 'auth_token';

export function setAuthToken(token: string): void {
  Cookies.set(TOKEN_KEY, token, { 
    expires: 7, 
    secure: process.env.NODE_ENV === 'production', 
    sameSite: 'strict' 
  });
}

export function getAuthToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}

export function removeAuthToken(): void {
  Cookies.remove(TOKEN_KEY);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = getAuthToken();
  console.log('Token from cookie:', token ? 'Token exists' : 'No token');
  
  if (!token) return null;

  try {
    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('User data:', data);
      return data.user;
    } else if (response.status === 403) {
      // User or tenant is blocked, remove token and return null
      const errorData = await response.json();
      console.log('User/Tenant blocked:', errorData.message);
      removeAuthToken();
      return null;
    } else {
      const errorData = await response.text();
      console.log('Error response:', errorData);
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}

export async function login(email: string, password: string): Promise<{ success: boolean; message?: string; user?: User }> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success && data.token) {
      setAuthToken(data.token);
    }

    return data;
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'An error occurred during login' };
  }
}

export function logout(): void {
  removeAuthToken();
  window.location.href = '/login';
}
