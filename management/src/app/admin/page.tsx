'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthToken } from '@/lib/auth-client';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import { 
  Users, 
  FolderOpen, 
  Video, 
  Activity,
  TrendingUp,
  Clock,
  BarChart3,
  PieChart,
  RefreshCw,
  Server,
  Database,
  CheckCircle,
  AlertCircle,
  Timer,
  Shield,
  UserX,
  Coins
} from 'lucide-react';

interface AdminAnalyticsData {
  totalUsers: number;
  totalProjects: number;
  totalVideos: number;
  totalAdmins: number;
  blockedUsers: number;
  backendStatus: string;
  tokenUsage: {
    total: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    today: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  };
  recentActivity: {
    newUsersToday: number;
    newProjectsToday: number;
    newVideosToday: number;
    videosProcessingToday: number;
  };
  videoStatusDistribution: {
    [key: string]: number;
  };
  userGrowth: {
    date: string;
    users: number;
  }[];
  mostActiveUsers: {
    id: string;
    username: string;
    email: string;
    role: string;
    isBlocked: boolean;
    _count: {
      projects: number;
    };
  }[];
  recentActivityItems: {
    id: string;
    type: string;
    name: string;
    timestamp: string;
  }[];
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/analytics', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. Admin privileges required.');
        }
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }
      
      const data = await response.json();
      setAnalytics(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching admin analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if user is admin
    if (user && user.role !== 'ADMIN') {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }

    fetchAnalytics();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Set page title
  useEffect(() => {
    document.title = 'Tenant Admin Dashboard - QuantiVision';
  }, []);

  // Show access denied if not admin
  if (user && user.role !== 'ADMIN') {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
                  <p className="text-red-700 mt-1">You don't have permission to access the admin dashboard.</p>
                </div>
              </div>
            </div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (loading && !analytics) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-red-800">Error Loading Admin Dashboard</h3>
                  <p className="text-red-700 mt-1">{error}</p>
                  <button
                    onClick={fetchAnalytics}
                    className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                  <Shield className="w-8 h-8 mr-3 text-blue-600" />
                  Tenant Admin Dashboard
                </h1>
                <p className="text-gray-600 mt-1">Organization overview and user management</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500 flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </div>
                <Link 
                  href="/admin/users"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage Users
                </Link>
                <Link 
                  href="/admin/token-usage"
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
                >
                  <Coins className="w-4 h-4 mr-2" />
                  Token Usage
                </Link>
                <button
                  onClick={fetchAnalytics}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {analytics && (
            <>
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Users</p>
                      <p className="text-3xl font-bold text-gray-900">{analytics.totalUsers || 0}</p>
                      <p className="text-sm text-green-600 mt-1">
                        +{analytics.recentActivity?.newUsersToday || 0} today
                      </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-full">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Projects</p>
                      <p className="text-3xl font-bold text-gray-900">{analytics.totalProjects || 0}</p>
                      <p className="text-sm text-green-600 mt-1">
                        +{analytics.recentActivity?.newProjectsToday || 0} today
                      </p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-full">
                      <FolderOpen className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Videos</p>
                      <p className="text-3xl font-bold text-gray-900">{analytics.totalVideos || 0}</p>
                      <p className="text-sm text-green-600 mt-1">
                        +{analytics.recentActivity?.newVideosToday || 0} today
                      </p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-full">
                      <Video className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Admins</p>
                      <p className="text-3xl font-bold text-gray-900">{analytics.totalAdmins || 0}</p>
                      <p className="text-sm text-blue-600 mt-1">Active admins</p>
                    </div>
                    <div className="bg-indigo-50 p-3 rounded-full">
                      <Shield className="w-6 h-6 text-indigo-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Blocked Users</p>
                      <p className="text-3xl font-bold text-gray-900">{analytics.blockedUsers || 0}</p>
                      <p className="text-sm text-red-600 mt-1">Restricted access</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-full">
                      <UserX className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Token Usage Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Tokens Used</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {analytics.tokenUsage?.total?.totalTokens?.toLocaleString() || 0}
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        +{analytics.tokenUsage?.today?.totalTokens?.toLocaleString() || 0} today
                      </p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-full">
                      <Coins className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Input Tokens</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {analytics.tokenUsage?.total?.inputTokens?.toLocaleString() || 0}
                      </p>
                      <p className="text-sm text-green-600 mt-1">
                        +{analytics.tokenUsage?.today?.inputTokens?.toLocaleString() || 0} today
                      </p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-full">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Output Tokens</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {analytics.tokenUsage?.total?.outputTokens?.toLocaleString() || 0}
                      </p>
                      <p className="text-sm text-purple-600 mt-1">
                        +{analytics.tokenUsage?.today?.outputTokens?.toLocaleString() || 0} today
                      </p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-full">
                      <Activity className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* System Status & Analytics */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Server className="w-5 h-5 mr-2" />
                    System Status
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">API Server</span>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-sm text-green-600">Online</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Database</span>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-sm text-green-600">Connected</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Backend AI</span>
                      <div className="flex items-center">
                        {analytics.backendStatus === 'online' ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                            <span className="text-sm text-green-600">Online</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
                            <span className="text-sm text-red-600">Offline</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Backend Health</span>
                      <span className={`text-sm font-medium ${analytics.backendStatus === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                        {analytics.backendStatus === 'online' ? 'Healthy' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Timer className="w-5 h-5 mr-2" />
                    Processing Stats
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Videos Processing</span>
                      <span className="text-sm font-medium text-blue-600">
                        {analytics.recentActivity?.videosProcessingToday || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Completed Videos</span>
                      <span className="text-sm font-medium text-green-600">
                        {analytics.videoStatusDistribution?.COMPLETED || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Failed Videos</span>
                      <span className="text-sm font-medium text-red-600">
                        {analytics.videoStatusDistribution?.FAILED || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <PieChart className="w-5 h-5 mr-2" />
                    Video Status Distribution
                  </h3>
                  <div className="space-y-2">
                    {analytics.videoStatusDistribution ? Object.entries(analytics.videoStatusDistribution).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 capitalize">{status.toLowerCase().replace('_', ' ')}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    )) : (
                      <div className="text-sm text-gray-500">No data available</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Analytics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Most Active Users */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Most Active Users
                  </h3>
                  <div className="space-y-3">
                    {analytics.mostActiveUsers && analytics.mostActiveUsers.length > 0 ? analytics.mostActiveUsers.slice(0, 5).map((user, index) => (
                      <div key={user.id} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-500 w-6">#{index + 1}</span>
                          <div className="ml-2">
                            <div className="text-sm font-medium text-gray-900 flex items-center">
                              {user.username}
                              {user.role === 'ADMIN' && (
                                <Shield className="w-3 h-3 ml-1 text-blue-500" />
                              )}
                              {user.isBlocked && (
                                <UserX className="w-3 h-3 ml-1 text-red-500" />
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </div>
                        <span className="text-sm text-gray-600">{user._count.projects} projects</span>
                      </div>
                    )) : (
                      <div className="text-sm text-gray-500">No active users data available</div>
                    )}
                  </div>
                </div>

                {/* Recent Activity Log */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    Recent System Activity
                  </h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {analytics.recentActivityItems && analytics.recentActivityItems.length > 0 ? analytics.recentActivityItems.map((item) => (
                      <div key={`${item.type}-${item.id}`} className="border-l-2 border-blue-200 pl-3">
                        <div className="text-sm font-medium text-gray-900 capitalize">
                          {item.type === 'user' ? 'New User' : item.type === 'project' ? 'New Project' : 'New Video'}: {item.name}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                    )) : (
                      <div className="text-sm text-gray-500">No recent activity available</div>
                    )}
                  </div>
                </div>
              </div>

              {/* User Growth Chart */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  User Growth (Last 7 Days)
                </h3>
                <div className="h-64 flex items-end space-x-2">
                  {analytics.userGrowth && analytics.userGrowth.length > 0 ? analytics.userGrowth.map((day, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-blue-500 rounded-t-sm min-h-[4px]"
                        style={{ 
                          height: `${Math.max(4, (day.users / Math.max(...analytics.userGrowth.map(d => d.users))) * 200)}px` 
                        }}
                      ></div>
                      <div className="text-xs text-gray-500 mt-2 text-center">
                        <div>{day.users}</div>
                        <div>{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                    </div>
                  )) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-sm text-gray-500">No user growth data available</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
