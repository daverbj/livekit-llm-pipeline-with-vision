'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';
import AppLayout from '@/components/AppLayout';
import { ArrowLeft, Save, XCircle } from 'lucide-react';

interface Video {
  id: string;
  filename: string;
  originalName: string;
  description: string;
  processingStatus: string;
  createdAt: string;
  updatedAt: string;
}

export default function EditVideoPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const videoId = params.videoId as string;
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');

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
      setDescription(data.video.description);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!description.trim()) {
      setError('Video description is required');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/videos/${videoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          description: description.trim()
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update video');
      }

      router.push(`/training/projects/${projectId}/videos/${videoId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
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
                href={`/training/projects/${projectId}/videos/${videoId}`}
                className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors duration-200 group mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
                Back to Video
              </Link>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-900 to-purple-700 bg-clip-text text-transparent">
                Edit Video
              </h1>
              <p className="text-gray-600 mt-2">
                Update the description for "{video.originalName}"
              </p>
            </div>

            {/* Edit Form */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-8">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Video Info */}
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Video Information</h3>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Filename:</span> {video.originalName}
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Uploaded:</span> {new Date(video.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-3">
                        Video Description
                      </label>
                      <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={6}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 resize-none"
                        placeholder="Describe what this video is about, what it teaches, or what steps it demonstrates..."
                        required
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Note: Changing the description will not regenerate the tutorial steps or embeddings. 
                        The AI processing was done with the original description.
                      </p>
                    </div>

                    {/* Error Display */}
                    {error && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="submit"
                        disabled={saving || !description.trim()}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-purple-600"
                      >
                        {saving ? (
                          <div className="flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Saving...
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <Save className="w-5 h-5 mr-2" />
                            Save Changes
                          </div>
                        )}
                      </button>
                      
                      <Link
                        href={`/training/projects/${projectId}/videos/${videoId}`}
                        className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors duration-200 text-center"
                      >
                        Cancel
                      </Link>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
