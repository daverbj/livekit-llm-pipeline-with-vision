'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: ('USER' | 'ADMIN' | 'SUPER_ADMIN')[];
  redirectTo?: string;
}

export default function RoleBasedRoute({ children, allowedRoles, redirectTo = '/sessions' }: RoleBasedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (!loading && user && !allowedRoles.includes(user.role)) {
      // For end users trying to access restricted pages, redirect to sessions
      if (user.role === 'USER' && pathname !== '/sessions') {
        router.push('/sessions');
        return;
      }
      
      // For other role mismatches, redirect to specified page
      router.push(redirectTo);
    }
  }, [user, loading, router, allowedRoles, redirectTo, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
