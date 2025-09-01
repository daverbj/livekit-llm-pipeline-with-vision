'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Building, LogOut } from 'lucide-react';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const { user, logout } = useAuth();

  if (!user || user.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="flex items-center mb-4">
            <Shield className="w-8 h-8 text-red-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          </div>
          <p className="text-gray-600">Super Admin privileges required to access this area.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Super Admin Portal</h1>
                <p className="text-xs text-gray-500">System Administration</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700">
                Welcome, <span className="font-medium">{user.username}</span>
              </div>
              <button
                onClick={logout}
                className="flex items-center px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sub Navigation */}
      <nav className="bg-purple-600 border-b border-purple-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <a
              href="/super-admin"
              className="flex items-center px-3 py-4 text-sm font-medium text-white hover:text-purple-200 border-b-2 border-transparent hover:border-purple-300 transition-colors"
            >
              <Building className="w-4 h-4 mr-2" />
              Tenant Management
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-gray-500">
            QuantiVision Super Admin Portal - System-wide tenant management
          </div>
        </div>
      </footer>
    </div>
  );
}
