'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';
import AppLayout from '@/components/AppLayout';

interface ServiceStatus {
  configured: boolean;
  apiKey: string;
  status: string;
  error?: string;
}

interface SystemStatus {
  openai: ServiceStatus;
  huggingface: ServiceStatus;
  qdrant: ServiceStatus & { host: string; port: string; url: string };
  environment: string;
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/system/status');
      if (!response.ok) {
        throw new Error('Failed to fetch system status');
      }
      const data = await response.json();
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Connected':
      case 'Configured':
        return 'text-green-600 bg-green-100';
      case 'Failed':
        return 'text-red-600 bg-red-100';
      case 'Not configured':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Connected':
      case 'Configured':
        return '✅';
      case 'Failed':
        return '❌';
      case 'Not configured':
        return '⚠️';
      default:
        return '❓';
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">System Status</h1>
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={fetchStatus}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['ADMIN']}>
        <AppLayout>
          <div className="max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900">System Status</h1>
              <button
                onClick={fetchStatus}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>

            <div className="grid gap-6">
              {/* Environment Info */}
              <div className="bg-white rounded-lg shadow p-6 border">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Environment</h2>
                <div className="flex items-center">
                  <span className="text-gray-600">Current environment:</span>
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                    {status.environment}
                  </span>
                </div>
              </div>

              {/* OpenAI Status */}
              <div className="bg-white rounded-lg shadow p-6 border">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">OpenAI</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">API Key:</span>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${status.openai.configured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                      {status.openai.apiKey}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Connection Status:</span>
                    <span className={`px-2 py-1 rounded text-sm font-medium flex items-center gap-2 ${getStatusColor(status.openai.status)}`}>
                      <span>{getStatusIcon(status.openai.status)}</span>
                      {status.openai.status}
                    </span>
                  </div>
                  {status.openai.error && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-700">{status.openai.error}</p>
                    </div>
                  )}
                  {!status.openai.configured && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-700">
                        Add your OpenAI API key to the .env file to enable video transcription and tutorial generation.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* HuggingFace Status */}
              <div className="bg-white rounded-lg shadow p-6 border">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">HuggingFace</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">API Token:</span>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${status.huggingface.configured ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                      {status.huggingface.apiKey}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Connection Status:</span>
                    <span className={`px-2 py-1 rounded text-sm font-medium flex items-center gap-2 ${getStatusColor(status.huggingface.status)}`}>
                      <span>{getStatusIcon(status.huggingface.status)}</span>
                      {status.huggingface.status}
                    </span>
                  </div>
                  {status.huggingface.error && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-700">{status.huggingface.error}</p>
                    </div>
                  )}
                  {!status.huggingface.configured && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-700">
                        Add your HuggingFace API token to the .env file to enable video embeddings and semantic search.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Qdrant Status */}
              <div className="bg-white rounded-lg shadow p-6 border">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Qdrant Vector Database</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Host:</span>
                    <span className="text-gray-900 font-mono">{status.qdrant.host}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Port:</span>
                    <span className="text-gray-900 font-mono">{status.qdrant.port}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">URL:</span>
                    <span className="text-gray-900 font-mono text-sm">{status.qdrant.url}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Connection Status:</span>
                    <span className={`px-2 py-1 rounded text-sm font-medium flex items-center gap-2 ${getStatusColor(status.qdrant.status)}`}>
                      <span>{getStatusIcon(status.qdrant.status)}</span>
                      {status.qdrant.status}
                    </span>
                  </div>
                  {status.qdrant.error && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-700">{status.qdrant.error}</p>
                    </div>
                  )}
                  {status.qdrant.status === 'Failed' && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-700">
                        Make sure Qdrant is running on {status.qdrant.url}.
                        You can start it using Docker: <code className="bg-gray-100 px-1 rounded">docker run -p 6333:6333 qdrant/qdrant</code>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </AppLayout>
      </RoleBasedRoute>
    </ProtectedRoute>
  );
}
