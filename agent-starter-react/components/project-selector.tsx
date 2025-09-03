'use client';

import { useState } from 'react';
import { CaretDown, FolderOpen, CircleNotch } from '@phosphor-icons/react';
import { useProjects, type Project } from '@/hooks/useProjects';

interface ProjectSelectorProps {
  selectedProject: Project | null;
  onProjectSelect: (project: Project | null) => void;
}

export function ProjectSelector({ selectedProject, onProjectSelect }: ProjectSelectorProps) {
  const { projects, isLoading, error } = useProjects();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white">
        <CircleNotch size={20} className="animate-spin" />
        <span className="text-sm">Loading projects...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-lg text-red-200">
        <p className="text-sm">Failed to load projects</p>
        <p className="text-xs opacity-75">{error}</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="px-4 py-3 bg-yellow-500/20 backdrop-blur-sm border border-yellow-400/30 rounded-lg text-yellow-200">
        <p className="text-sm">No projects available</p>
        <p className="text-xs opacity-75">Create a project in the management app to get started</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full min-w-[280px] px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white hover:bg-white/15 transition-all duration-200"
      >
        <div className="flex items-center space-x-3">
          <FolderOpen size={20} className="text-blue-300" />
          <div className="text-left">
            {selectedProject ? (
              <>
                <p className="text-sm font-medium">{selectedProject.name}</p>
                {selectedProject.description && (
                  <p className="text-xs text-white/70 truncate max-w-[200px]">
                    {selectedProject.description}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-white/70">Select a project</p>
            )}
          </div>
        </div>
        <CaretDown 
          size={16} 
          className={`text-white/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-2xl z-50 max-h-64 overflow-y-auto">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  onProjectSelect(project);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/10 last:border-b-0 ${
                  selectedProject?.id === project.id ? 'bg-white/20' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FolderOpen size={16} className="text-blue-300 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-white/70 truncate">{project.description}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
