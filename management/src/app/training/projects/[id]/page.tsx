'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';
import AppLayout from '@/components/AppLayout';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface Video {
  id: string;
  originalName: string;
  description?: string;
  status: 'processing' | 'completed' | 'failed';
  duration?: number;
  size?: number;
  createdAt: string;
  updatedAt: string;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  type: 'upload' | 'analyze' | 'train' | 'export';
  status: 'pending' | 'in_progress' | 'completed';
  icon: string;
  href?: string;
  onClick?: () => void;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      // Fetch project details
      const projectResponse = await fetch(`/api/projects/${projectId}`, {
        credentials: 'include'
      });

      if (!projectResponse.ok) {
        const data = await projectResponse.json();
        throw new Error(data.error || 'Failed to fetch project');
      }

      const projectData = await projectResponse.json();
      setProject(projectData.project);

      // Fetch videos for this project
      try {
        const videosResponse = await fetch(`/api/projects/${projectId}/videos`, {
          credentials: 'include'
        });
        
        if (videosResponse.ok) {
          const videosData = await videosResponse.json();
          setVideos(videosData.videos || []);
        }
      } catch (err) {
        console.warn('Failed to fetch videos:', err);
      }

      // Generate action items based on project state
      generateActionItems(projectData.project);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateActionItems = (project: Project) => {
    const items: ActionItem[] = [
      {
        id: 'upload-video',
        title: 'Upload Video',
        description: 'Add new training videos to this project',
        type: 'upload',
        status: 'pending',
        icon: 'upload',
        href: `/training/projects/${project.id}/videos/upload`
      },
      {
        id: 'view-videos',
        title: 'Manage Videos',
        description: 'View and organize all project videos',
        type: 'analyze',
        status: 'pending',
        icon: 'video',
        href: `/training/projects/${project.id}/videos`
      },
      {
        id: 'edit-project',
        title: 'Edit Project',
        description: 'Update project settings and configuration',
        type: 'train',
        status: 'pending',
        icon: 'edit',
        href: `/training/projects/${project.id}/edit`
      },
      {
        id: 'export-data',
        title: 'Export Data',
        description: 'Export project data and annotations',
        type: 'export',
        status: 'pending',
        icon: 'download',
        onClick: () => handleExport()
      }
    ];
    
    setActionItems(items);
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    alert('Export functionality coming soon!');
  };

  const getActionIcon = (iconType: string) => {
    switch (iconType) {
      case 'upload':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        );
      case 'video':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
          </svg>
        );
      case 'edit':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
        );
      case 'download':
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'in_progress':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-blue-600 bg-blue-100';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <RoleBasedRoute allowedRoles={['ADMIN']}>
          <AppLayout>
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading project...</p>
              </div>
            </div>
          </AppLayout>
        </RoleBasedRoute>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <RoleBasedRoute allowedRoles={['ADMIN']}>
          <AppLayout>
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Project Not Found</h3>
                <p className="text-gray-600 mb-6">{error}</p>
                <Link
                  href="/training/projects"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors duration-200"
                >
                  Back to Projects
                </Link>
              </div>
            </div>
          </AppLayout>
        </RoleBasedRoute>
      </ProtectedRoute>
    );
  }

  if (!project) return null;

  return (
    <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['ADMIN']}>
        <AppLayout>
          <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Header */}
              <div className="mb-8">
                <Link
                  href="/training/projects"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors duration-200 group mb-6"
                >
                  <svg className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Projects
                </Link>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                      {project.description && (
                        <p className="mt-1 text-gray-600">{project.description}</p>
                      )}
                      <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                        <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                        {project.updatedAt !== project.createdAt && (
                          <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Action Items */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">Action Items</h2>
                      <p className="mt-1 text-sm text-gray-600">Available actions for this project</p>
                    </div>
                    
                    <div className="p-6">
                      <div className="space-y-4">
                        {actionItems.map((item) => {
                          if (item.href) {
                            return (
                              <Link
                                key={item.id}
                                href={item.href}
                                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all duration-200 group"
                              >
                                <div className="flex items-center">
                                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(item.status)}`}>
                                    {getActionIcon(item.icon)}
                                  </div>
                                  <div className="ml-4">
                                    <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                      {item.title}
                                    </h3>
                                    <p className="text-sm text-gray-500">{item.description}</p>
                                  </div>
                                </div>
                                <div className="flex-shrink-0">
                                  <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </Link>
                            );
                          } else {
                            return (
                              <button
                                key={item.id}
                                onClick={item.onClick}
                                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all duration-200 group"
                              >
                                <div className="flex items-center">
                                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(item.status)}`}>
                                    {getActionIcon(item.icon)}
                                  </div>
                                  <div className="ml-4">
                                    <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                      {item.title}
                                    </h3>
                                    <p className="text-sm text-gray-500">{item.description}</p>
                                  </div>
                                </div>
                                <div className="flex-shrink-0">
                                  <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </button>
                            );
                          }
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Project Overview */}
                <div className="space-y-6">
                  {/* Project Stats */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Overview</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Videos</span>
                        <span className="text-sm font-medium text-gray-900">{videos.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Processed</span>
                        <span className="text-sm font-medium text-gray-900">
                          {videos.filter(v => v.status === 'completed').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Processing</span>
                        <span className="text-sm font-medium text-gray-900">
                          {videos.filter(v => v.status === 'processing').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Failed</span>
                        <span className="text-sm font-medium text-gray-900">
                          {videos.filter(v => v.status === 'failed').length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Videos */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Recent Videos</h3>
                      <Link
                        href={`/training/projects/${project.id}/videos`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        View All
                      </Link>
                    </div>
                    
                    {videos.length > 0 ? (
                      <div className="space-y-3">
                        {videos.slice(0, 3).map((video) => (
                          <div key={video.id} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-b-0">
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="text-sm font-medium text-gray-900">
                                {video.originalName || 'Untitled Video'}
                              </p>
                              {video.description && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {video.description}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {video.duration || video.size ? (
                                  <>
                                    {video.duration ? formatDuration(video.duration) : 'Duration unknown'}
                                    {' • '}
                                    {video.size ? formatFileSize(video.size) : 'Size unknown'}
                                  </>
                                ) : (
                                  `Uploaded ${new Date(video.createdAt).toLocaleDateString()}`
                                )}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                video.status === 'completed' ? 'bg-green-100 text-green-800' :
                                video.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {video.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                        </svg>
                        <p className="text-sm text-gray-500 mb-3">No videos uploaded yet</p>
                        <Link
                          href={`/training/projects/${project.id}/videos/upload`}
                          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Upload your first video
                          <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AppLayout>
      </RoleBasedRoute>
    </ProtectedRoute>
  );
}
