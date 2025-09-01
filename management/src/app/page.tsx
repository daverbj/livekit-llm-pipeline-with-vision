'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';
import AppLayout from '@/components/AppLayout';
import DashboardSkeleton from '@/components/DashboardSkeleton';
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
  Timer
} from 'lucide-react';

interface AnalyticsData {
  totalProjects: number;
  totalVideos: number;
  backendStatus: string;
  recentActivity: {
    newProjectsToday: number;
    newVideosToday: number;
    videosProcessingToday: number;
  };
  videoStatusDistribution: {
    [key: string]: number;
  };
  projectGrowth: {
    date: string;
    projects: number;
  }[];
  recentActivityItems: {
    id: string;
    type: string;
    name: string;
    timestamp: string;
  }[];
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Redirect users based on their role
  useEffect(() => {
    if (user) {
      if (user.role === 'SUPER_ADMIN') {
        router.push('/super-admin');
      } else if (user.role === 'USER') {
        router.push('/sessions');
      }
    }
  }, [user, router]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/analytics');
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }
      const data = await response.json();
      setAnalytics(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  // Set page title
  useEffect(() => {
    document.title = 'Dashboard - QuantiVision';
  }, []);

  if (loading && !analytics) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <DashboardSkeleton />
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
                  <h3 className="text-lg font-medium text-red-800">Error Loading Dashboard</h3>
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
      <RoleBasedRoute allowedRoles={['ADMIN']}>
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
                <p className="text-gray-600 mt-1">Welcome back, {user?.username}! Track your projects and video processing progress</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500 flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </div>
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
                      <p className="text-sm font-medium text-gray-600">My Projects</p>
                      <p className="text-3xl font-bold text-gray-900">{analytics.totalProjects || 0}</p>
                      <p className="text-sm text-green-600 mt-1">
                        +{analytics.recentActivity?.newProjectsToday || 0} today
                      </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-full">
                      <FolderOpen className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">My Videos</p>
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
                      <p className="text-sm font-medium text-gray-600">Backend Status</p>
                      <p className="text-3xl font-bold text-gray-900 capitalize">{analytics?.backendStatus || 'offline'}</p>
                      <div className="flex items-center mt-1">
                        <div className={`w-2 h-2 rounded-full mr-2 ${analytics?.backendStatus === 'online' ? 'bg-green-500' : 'bg-red-400'}`}></div>
                        <p className="text-sm text-gray-600">Real-time</p>
                      </div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-full">
                      <Activity className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* System Status & Backend Info */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Server className="w-5 h-5 mr-2" />
                    Backend Status
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
                      <span className="text-sm text-gray-600">Qdrant Vector DB</span>
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-sm text-green-600">Ready</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Timer className="w-5 h-5 mr-2" />
                    My Processing Status
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Videos Processing</span>
                      <span className="text-sm font-medium text-blue-600">
                        {analytics.recentActivity?.videosProcessingToday || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Videos Completed</span>
                      <span className="text-sm font-medium text-green-600">
                        {analytics.totalVideos || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Active Projects</span>
                      <span className="text-sm font-medium text-purple-600">
                        {analytics.totalProjects || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <PieChart className="w-5 h-5 mr-2" />
                    My Video Status
                  </h3>
                  <div className="space-y-2">
                    {analytics.videoStatusDistribution ? Object.entries(analytics.videoStatusDistribution).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 capitalize">{status}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    )) : (
                      <div className="text-sm text-gray-500">No video data available</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Analytics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Recent Projects */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Recent Projects
                  </h3>
                  <div className="space-y-3">
                    {analytics.recentActivityItems && analytics.recentActivityItems.filter(item => item.type === 'project').length > 0 ? 
                      analytics.recentActivityItems
                        .filter(item => item.type === 'project')
                        .slice(0, 5)
                        .map((project, index) => (
                        <div key={project.id} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-500 w-6">#{index + 1}</span>
                            <span className="text-sm font-medium text-gray-900">{project.name}</span>
                          </div>
                          <span className="text-sm text-gray-600">
                            {new Date(project.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      )) : (
                      <div className="text-sm text-gray-500">No recent projects available</div>
                    )}
                  </div>
                </div>

                {/* Recent Activity Log */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    Recent Activity
                  </h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {analytics.recentActivityItems && analytics.recentActivityItems.length > 0 ? analytics.recentActivityItems.map((item) => (
                      <div key={item.id} className="border-l-2 border-blue-200 pl-3">
                        <div className="text-sm font-medium text-gray-900 capitalize">
                          {item.type === 'project' ? 'Created Project' : 'Uploaded Video'}: {item.name}
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

              {/* Project Growth Chart */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  My Project Activity (Last 7 Days)
                </h3>
                <div className="h-64 flex items-end space-x-2">
                  {analytics.projectGrowth && analytics.projectGrowth.length > 0 ? analytics.projectGrowth.map((day, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-blue-500 rounded-t-sm min-h-[4px]"
                        style={{ 
                          height: `${Math.max(4, (day.projects / Math.max(...analytics.projectGrowth.map(d => d.projects))) * 200)}px` 
                        }}
                      ></div>
                      <div className="text-xs text-gray-500 mt-2 text-center">
                        <div>{day.projects}</div>
                        <div>{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                    </div>
                  )) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-sm text-gray-500">No project activity data available</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </AppLayout>
      </RoleBasedRoute>
    </ProtectedRoute>
  );
}
