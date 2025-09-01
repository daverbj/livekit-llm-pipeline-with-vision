'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';
import AppLayout from '@/components/AppLayout';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected';
  color: string;
}

interface Video {
  id: string;
  name: string;
  size: string;
  modifiedDate: string;
  thumbnail?: string;
}

const integrations: Integration[] = [
  {
    id: 'zoho',
    name: 'Zoho',
    description: 'Connect to Zoho WorkDrive to access your files',
    icon: 'zoho',
    status: 'disconnected',
    color: 'from-orange-500 to-red-500'
  },
  {
    id: 'servicenow',
    name: 'ServiceNow',
    description: 'Import training videos from ServiceNow Knowledge Base',
    icon: 'servicenow',
    status: 'disconnected',
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: 'googledrive',
    name: 'Google Drive',
    description: 'Access videos stored in your Google Drive',
    icon: 'googledrive',
    status: 'disconnected',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    description: 'Connect to Microsoft OneDrive for Business',
    icon: 'onedrive',
    status: 'disconnected',
    color: 'from-blue-600 to-purple-600'
  }
];

// Mock video data
const mockVideos: { [key: string]: Video[] } = {
  zoho: [
    { id: '1', name: 'Zoho CRM Training.mp4', size: '45.2 MB', modifiedDate: '2025-01-08' },
    { id: '2', name: 'Zoho Books Tutorial.mp4', size: '32.1 MB', modifiedDate: '2025-01-07' },
    { id: '3', name: 'Zoho Projects Overview.mp4', size: '28.5 MB', modifiedDate: '2025-01-06' }
  ],
  servicenow: [
    { id: '4', name: 'Incident Management Process.mp4', size: '67.8 MB', modifiedDate: '2025-01-08' },
    { id: '5', name: 'Service Catalog Demo.mp4', size: '52.3 MB', modifiedDate: '2025-01-07' },
    { id: '6', name: 'CMDB Configuration.mp4', size: '41.7 MB', modifiedDate: '2025-01-05' }
  ],
  googledrive: [
    { id: '7', name: 'Product Demo 2025.mp4', size: '125.4 MB', modifiedDate: '2025-01-09' },
    { id: '8', name: 'Team Training Session.mp4', size: '89.2 MB', modifiedDate: '2025-01-08' },
    { id: '9', name: 'Customer Onboarding.mp4', size: '76.1 MB', modifiedDate: '2025-01-07' }
  ],
  onedrive: [
    { id: '10', name: 'Quarterly Review.mp4', size: '156.8 MB', modifiedDate: '2025-01-09' },
    { id: '11', name: 'Sales Training Module.mp4', size: '98.5 MB', modifiedDate: '2025-01-08' },
    { id: '12', name: 'HR Policies Overview.mp4', size: '54.3 MB', modifiedDate: '2025-01-06' }
  ]
};

export default function IntegrationPage() {
  const [integrationStates, setIntegrationStates] = useState<{ [key: string]: Integration }>(
    Object.fromEntries(integrations.map(int => [int.id, int]))
  );
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const getIntegrationIcon = (iconType: string) => {
    switch (iconType) {
      case 'zoho':
        return (
          <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white font-bold text-sm">
            Z
          </div>
        );
      case 'servicenow':
        return (
          <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
        );
      case 'googledrive':
        return (
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.5 16L12 6l5.5 10H6.5zm11-2L12 2 6.5 14H2l4 6h12l4-6h-4.5z"/>
            </svg>
          </div>
        );
      case 'onedrive':
        return (
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.5 8c-1.4 0-2.7.6-3.6 1.6C14.3 8.1 12.8 7.5 11 7.5c-2.8 0-5.1 2.1-5.4 4.8C3.7 12.8 2.5 14.4 2.5 16.3c0 2.2 1.8 4 4 4h12c1.7 0 3-1.3 3-3 0-1.4-.9-2.6-2.2-2.9.1-.5.2-1 .2-1.4 0-2.8-2.2-5-5-5z"/>
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-gray-500 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
            </svg>
          </div>
        );
    }
  };

  const handleConnect = async (integrationId: string) => {
    setIsAuthenticating(true);
    
    // Simulate authentication process
    setTimeout(() => {
      setIntegrationStates(prev => ({
        ...prev,
        [integrationId]: {
          ...prev[integrationId],
          status: 'connected'
        }
      }));
      setSelectedIntegration(integrationId);
      setIsAuthenticating(false);
    }, 2000);
  };

  const handleVideoToggle = (videoId: string) => {
    setSelectedVideos(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  const handleImportVideos = () => {
    // TODO: Implement video import functionality
    alert(`Importing ${selectedVideos.length} videos for training...`);
    setSelectedVideos([]);
    setSelectedIntegration(null);
  };

  const currentVideos = selectedIntegration ? mockVideos[selectedIntegration] || [] : [];

  if (isAuthenticating) {
    return (
      <ProtectedRoute>
        <RoleBasedRoute allowedRoles={['ADMIN']}>
          <AppLayout>
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Authenticating...</h3>
                <p className="text-gray-600">Please complete the authentication process in the popup window.</p>
              </div>
            </div>
          </AppLayout>
        </RoleBasedRoute>
      </ProtectedRoute>
    );
  }

  if (selectedIntegration) {
    const integration = integrationStates[selectedIntegration];
    
    return (
      <ProtectedRoute>
        <RoleBasedRoute allowedRoles={['ADMIN']}>
          <AppLayout>
            <div className="min-h-screen bg-gray-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                  <button
                    onClick={() => setSelectedIntegration(null)}
                    className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors duration-200 group mb-6"
                  >
                    <svg className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Integrations
                  </button>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getIntegrationIcon(integration.icon)}
                        <div className="ml-4">
                          <h1 className="text-2xl font-bold text-gray-900">{integration.name}</h1>
                          <p className="mt-1 text-gray-600">Select videos to import for training</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Connected
                        </span>
                        {selectedVideos.length > 0 && (
                          <button
                            onClick={handleImportVideos}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Import {selectedVideos.length} Video{selectedVideos.length !== 1 ? 's' : ''}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video List */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Available Videos</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Found {currentVideos.length} video{currentVideos.length !== 1 ? 's' : ''} in your {integration.name} account
                    </p>
                  </div>
                  
                  <div className="p-6">
                    <div className="space-y-4">
                      {currentVideos.map((video) => (
                        <div
                          key={video.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                        >
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id={video.id}
                              checked={selectedVideos.includes(video.id)}
                              onChange={() => handleVideoToggle(video.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="ml-4 flex items-center">
                              <div className="w-12 h-8 bg-gray-200 rounded flex items-center justify-center mr-3">
                                <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{video.name}</p>
                                <p className="text-xs text-gray-500">
                                  {video.size} • Modified {new Date(video.modifiedDate).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
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

  return (
    <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['ADMIN']}>
        <AppLayout>
          <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
                <p className="mt-2 text-gray-600">
                  Connect external services to import training videos and data
                </p>
              </div>

              {/* Integration Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {Object.values(integrationStates).map((integration) => (
                  <div
                    key={integration.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className={`h-2 bg-gradient-to-r ${integration.color}`}></div>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          {getIntegrationIcon(integration.icon)}
                          <div className="ml-3">
                            <h3 className="text-lg font-semibold text-gray-900">{integration.name}</h3>
                            <p className="text-sm text-gray-600">{integration.description}</p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            integration.status === 'connected'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {integration.status === 'connected' ? 'Connected' : 'Not Connected'}
                        </span>
                      </div>
                      
                      <div className="flex space-x-3">
                        {integration.status === 'connected' ? (
                          <>
                            <button
                              onClick={() => setSelectedIntegration(integration.id)}
                              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                              Browse Videos
                            </button>
                            <button
                              onClick={() => setIntegrationStates(prev => ({
                                ...prev,
                                [integration.id]: { ...prev[integration.id], status: 'disconnected' }
                              }))}
                              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                            >
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleConnect(integration.id)}
                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info Section */}
              <div className="mt-12 bg-blue-50 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Integration Information</h3>
                    <p className="mt-1 text-sm text-blue-700">
                      Connecting these integrations will allow you to import videos directly from your external services 
                      for AI training. All connections are secure and you can disconnect at any time.
                    </p>
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
