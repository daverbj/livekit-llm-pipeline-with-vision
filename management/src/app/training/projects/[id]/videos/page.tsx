'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';
import AppLayout from '@/components/AppLayout';
import { Play, Upload, Edit, Trash2, ArrowLeft, Clock, CheckCircle, XCircle, Loader, RefreshCw } from 'lucide-react';

interface Video {
  id: string;
  filename: string;
  originalName: string;
  description: string;
  processingStatus: string;
  createdAt: string;
  updatedAt: string;
}

// Individual video item component that uses SSE for real-time updates
function VideoItem({ video, projectId, onDelete }: { 
  video: Video; 
  projectId: string;
  onDelete: (videoId: string) => void;
}) {
  const [currentStatus, setCurrentStatus] = useState(video.processingStatus);

  useEffect(() => {
    const processingStates = ['UPLOADED', 'EXTRACTING_AUDIO', 'TRANSCRIBING', 'GENERATING_STEPS', 'EMBEDDING'];
    
    // Only set up SSE for videos in processing states
    if (!processingStates.includes(video.processingStatus)) {
      return;
    }

    const eventSource = new EventSource(
      `/api/projects/${projectId}/videos/${video.id}/progress`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setCurrentStatus(data.status);

        // Close connection if video is in final state
        if (['COMPLETED', 'FAILED'].includes(data.status)) {
          eventSource.close();
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [video.id, video.processingStatus, projectId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'UPLOADED':
      case 'EXTRACTING_AUDIO':
      case 'TRANSCRIBING':
      case 'GENERATING_STEPS':
      case 'EMBEDDING':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'UPLOADED':
        return 'Uploaded';
      case 'EXTRACTING_AUDIO':
        return 'Extracting Audio';
      case 'TRANSCRIBING':
        return 'Transcribing';
      case 'GENERATING_STEPS':
        return 'Generating Steps';
      case 'EMBEDDING':
        return 'Creating Embeddings';
      case 'COMPLETED':
        return 'Completed';
      case 'FAILED':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'FAILED':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'UPLOADED':
      case 'EXTRACTING_AUDIO':
      case 'TRANSCRIBING':
      case 'GENERATING_STEPS':
      case 'EMBEDDING':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Play className="w-6 h-6 text-white" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {video.originalName}
              </h3>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {video.description}
              </p>
              
              <div className="flex items-center space-x-4 mt-3">
                <span className="text-xs text-gray-500">
                  Uploaded {new Date(video.createdAt).toLocaleDateString()}
                </span>
                
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(currentStatus)}`}>
                  {getStatusIcon(currentStatus)}
                  <span className="ml-2">{getStatusText(currentStatus)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            {currentStatus === 'COMPLETED' && (
              <>
                <Link
                  href={`/training/projects/${projectId}/videos/${video.id}`}
                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                  title="View Video"
                >
                  <Play className="w-4 h-4" />
                </Link>
                
                <Link
                  href={`/training/projects/${projectId}/videos/${video.id}/edit`}
                  className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                  title="Edit Video"
                >
                  <Edit className="w-4 h-4" />
                </Link>
              </>
            )}
            
            <button
              onClick={() => onDelete(video.id)}
              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
              title="Delete Video"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectVideosPage() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
  }, [projectId]);

  const fetchVideos = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/videos`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch videos');
      }

      const data = await response.json();
      setVideos(data.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/videos/${videoId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete video');
      }

      // Refresh videos list
      fetchVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete video');
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['ADMIN']}>
        <AppLayout>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading videos...</p>
            </div>
          </div>
        </AppLayout>
      </RoleBasedRoute>
    </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
              <Link
                href={`/training/projects/${projectId}`}
                className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors duration-200 group mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
                Back to Project
              </Link>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-900 to-purple-700 bg-clip-text text-transparent">
                    Project Videos
                  </h1>
                  <p className="text-gray-600 mt-2">
                    Manage and view all videos for this project
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={fetchVideos}
                    disabled={loading}
                    className="inline-flex items-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  
                  <Link
                    href={`/training/projects/${projectId}/videos/upload`}
                    className="inline-flex items-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    Upload Video
                  </Link>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Videos Grid */}
            {videos.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6">
                  <Play className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No videos yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Get started by uploading your first video. We'll extract the audio, transcribe it, and generate tutorial steps automatically.
                </p>
                <Link
                  href={`/training/projects/${projectId}/videos/upload`}
                  className="inline-flex items-center bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload First Video
                </Link>
              </div>
            ) : (
              <div className="grid gap-6">
                {videos.map((video) => (
                  <VideoItem 
                    key={video.id} 
                    video={video} 
                    projectId={projectId}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
