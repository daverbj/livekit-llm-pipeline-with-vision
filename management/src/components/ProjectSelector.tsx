'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthToken } from '@/lib/auth-client';

interface Project {
  id: string;
  name: string;
  description?: string;
  collectionName: string;
}

interface ProjectSelectorProps {
  selectedProject: Project | null;
  onProjectSelect: (project: Project | null) => void;
}

export default function ProjectSelector({ selectedProject, onProjectSelect }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch('/api/projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value;
    if (projectId === '') {
      onProjectSelect(null);
    } else {
      const project = projects.find(p => p.id === projectId);
      onProjectSelect(project || null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <h3 className="text-lg font-semibold text-gray-900">Loading Projects...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-red-200">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-red-900">Error</h3>
        </div>
        <p className="text-red-700">{error}</p>
        <button 
          onClick={fetchProjects}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900">Project Knowledge Base</h3>
      </div>
      
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Select Project for AI Context
        </label>
        <select 
          value={selectedProject?.id || ''} 
          onChange={handleProjectChange}
          className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">No Project (General Chat)</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        
        {selectedProject && (
          <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              <span className="text-sm font-medium text-indigo-900">Active Project</span>
            </div>
            <p className="text-sm text-indigo-700 font-medium">{selectedProject.name}</p>
            {selectedProject.description && (
              <p className="text-xs text-indigo-600 mt-1">{selectedProject.description}</p>
            )}
            <div className="mt-2 text-xs text-indigo-600">
              AI will use this project's video transcriptions, descriptions, and tutorial content to answer your questions.
            </div>
          </div>
        )}
        
        {!selectedProject && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">
              Select a project to enable AI knowledge base features. The AI will use your project's video content to provide more relevant answers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
