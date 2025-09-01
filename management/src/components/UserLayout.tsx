'use client';

import { useAuth } from '@/contexts/AuthContext';
import Header from './Header';

interface UserLayoutProps {
  children: React.ReactNode;
}

export default function UserLayout({ children }: UserLayoutProps) {
  const { user } = useAuth();

  // Simple layout for end users - no sidebar, just header and content
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
