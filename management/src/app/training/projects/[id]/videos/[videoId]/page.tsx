'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';
import AppLayout from '@/components/AppLayout';
import VideoPlayer from '@/components/VideoPlayer';
import { ArrowLeft, Play, FileText, List, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

interface Video {
  id: string;
  filename: string;
  originalName: string;
  description: string;
  processingStatus: string;
  transcription?: string;
  transcriptionData?: unknown;
  tutorialSteps?: string[];
  createdAt: string;
  updatedAt: string;
}

export default function VideoDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const videoId = params.videoId as string;
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVideo();
  }, [projectId, videoId]);

  const fetchVideo = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/videos/${videoId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch video');
      }

      const data = await response.json();
      setVideo(data.video);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['ADMIN']}>
        <AppLayout>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading video...</p>
            </div>
          </div>
        </AppLayout>
      </RoleBasedRoute>
    </ProtectedRoute>
    );
  }

  if (error || !video) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Video Not Found</h2>
              <p className="text-gray-600 mb-6">{error || 'The video you are looking for does not exist.'}</p>
              <Link
                href={`/training/projects/${projectId}/videos`}
                className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors duration-200"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Videos
              </Link>
            </div>
          </div>
        </AppLayout>
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
                href={`/training/projects/${projectId}/videos`}
                className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors duration-200 group mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
                Back to Videos
              </Link>
              
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Play className="w-8 h-8 text-blue-600 flex-shrink-0" />
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-900 to-purple-700 bg-clip-text text-transparent break-words">
                      {video.originalName}
                    </h1>
                  </div>
                  
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${getStatusColor(video.processingStatus)}`}>
                    {getStatusIcon(video.processingStatus)}
                    {getStatusText(video.processingStatus)}
                  </div>
                </div>
                
                <Link
                  href={`/training/projects/${projectId}/videos/${videoId}/edit`}
                  className="inline-flex items-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Edit Video
                </Link>
              </div>
            </div>

            <div className="space-y-8">
              {/* Video Player with Side-by-Side Layout */}
              <VideoPlayer
                videoPath={`/api/projects/${projectId}/videos/${videoId}/stream`}
                transcriptionData={video.transcriptionData as any}
                tutorialSteps={video.tutorialSteps}
              />

              {/* Additional Video Information */}
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Description */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Description
                  </h2>
                  <p className="text-gray-700 leading-relaxed">
                    {video.description}
                  </p>
                </div>

                {/* Video Details */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Details</h2>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Original Filename:</span>
                      <p className="text-gray-900">{video.originalName}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Processing Status:</span>
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(video.processingStatus)}`}>
                        {getStatusIcon(video.processingStatus)}
                        {getStatusText(video.processingStatus)}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Uploaded:</span>
                      <p className="text-gray-900">{new Date(video.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Last Updated:</span>
                      <p className="text-gray-900">{new Date(video.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Transcription (if needed for reference) */}
              {video.transcription && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    Full Transcription
                  </h2>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {video.transcription}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
