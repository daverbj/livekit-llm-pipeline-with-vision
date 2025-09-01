'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';
import AppLayout from '@/components/AppLayout';
import { Upload, ArrowLeft } from 'lucide-react';

export default function UploadVideoPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!file) {
      setError('Please select a video file');
      setLoading(false);
      return;
    }

    if (!description.trim()) {
      setError('Please provide a video description');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('description', description.trim());

      const response = await fetch(`/api/projects/${projectId}/videos`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload video');
      }

      router.push(`/training/projects/${projectId}/videos`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('video/')) {
        setFile(droppedFile);
      } else {
        setError('Please drop a video file');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['ADMIN']}>
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
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-900 to-purple-700 bg-clip-text text-transparent">
                Upload Video
              </h1>
              <p className="text-gray-600 mt-2">
                Upload a video file to extract audio, transcribe, and generate tutorial steps.
              </p>
            </div>

            {/* Upload Form */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-8">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* File Upload */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Video File
                      </label>
                      <div
                        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                          dragActive
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                      >
                        <input
                          type="file"
                          accept="video/*"
                          onChange={handleFileSelect}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        
                        {file ? (
                          <div className="space-y-2">
                            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                              <Upload className="w-8 h-8 text-green-600" />
                            </div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)}
                            </p>
                            <button
                              type="button"
                              onClick={() => setFile(null)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remove file
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                              <Upload className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-600">
                              Drag and drop your video here, or <span className="text-blue-600 font-medium">browse</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              Supports MP4, AVI, MOV, WMV, WebM
                            </p>
                          </div>
                        )}
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
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 resize-none"
                        placeholder="Describe what this video is about, what it teaches, or what steps it demonstrates..."
                        required
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        This description will be used to generate embeddings and tutorial steps.
                      </p>
                    </div>

                    {/* Error Display */}
                    {error && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading || !file || !description.trim()}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-purple-600"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Uploading...
                        </div>
                      ) : (
                        'Upload Video'
                      )}
                    </button>
                  </form>
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
