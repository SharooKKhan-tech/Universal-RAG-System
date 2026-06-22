import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';
import type { Project, ApiKey } from '../types';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  selectedApiKey: string | null;
  apiKeys: ApiKey[];
  isLoadingProjects: boolean;
  isLoadingKeys: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
  refreshApiKeys: (projectId: string) => Promise<void>;
  selectProject: (project: Project | null) => void;
  selectApiKey: (apiKey: string | null) => void;
  createProject: (name: string, description: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  generateApiKey: (projectId: string, name: string) => Promise<ApiKey>;
  deleteApiKey: (projectId: string, keyId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedApiKey, setSelectedApiKeyState] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);
  const [isLoadingKeys, setIsLoadingKeys] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selected values from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('selectedApiKey');
    if (savedApiKey) {
      setSelectedApiKeyState(savedApiKey);
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setError(null);
    try {
      const response = await apiClient.get<Project[]>('/projects');
      setProjects(response.data);
      
      const savedProjId = localStorage.getItem('selectedProjectId');
      if (savedProjId && response.data.length > 0) {
        const found = response.data.find(p => p.id === savedProjId);
        if (found) {
          setSelectedProject(found);
        } else {
          // If saved project no longer exists, clear selections
          setSelectedProject(null);
          localStorage.removeItem('selectedProjectId');
        }
      } else if (response.data.length > 0 && !savedProjId) {
        // Auto-select first project if none saved
        const firstProj = response.data[0];
        setSelectedProject(firstProj);
        localStorage.setItem('selectedProjectId', firstProj.id);
      }
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message || 'Failed to load projects');
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const refreshApiKeys = useCallback(async (projectId: string) => {
    setIsLoadingKeys(true);
    try {
      const response = await apiClient.get<ApiKey[]>(`/projects/${projectId}/api-keys`);
      setApiKeys(response.data);
      
      // Auto-select API key if none is active or if current active is not in the list
      const savedApiKey = localStorage.getItem('selectedApiKey');
      const isCurrentKeyInProjectList = response.data.some(k => k.api_key === savedApiKey);
      
      if (response.data.length > 0) {
        if (!savedApiKey || !isCurrentKeyInProjectList) {
          const firstKey = response.data.find(k => k.is_active) || response.data[0];
          setSelectedApiKey(firstKey.api_key);
        }
      } else {
        setSelectedApiKey(null);
      }
    } catch (err) {
      console.error('Error fetching API keys:', err);
      setApiKeys([]);
    } finally {
      setIsLoadingKeys(false);
    }
  }, []);

  // Fetch projects when authenticated, clear when not
  useEffect(() => {
    if (isAuthenticated) {
      refreshProjects();
    } else {
      setProjects([]);
      setSelectedProject(null);
    }
  }, [isAuthenticated, refreshProjects]);

  // Fetch API keys whenever selected project changes
  useEffect(() => {
    if (selectedProject) {
      refreshApiKeys(selectedProject.id);
    } else {
      setApiKeys([]);
      setSelectedApiKey(null);
    }
  }, [selectedProject, refreshApiKeys]);

  const selectProject = (project: Project | null) => {
    setSelectedProject(project);
    if (project) {
      localStorage.setItem('selectedProjectId', project.id);
      // Let the keys fetch effect handle api key auto-selection
    } else {
      localStorage.removeItem('selectedProjectId');
      setSelectedApiKey(null);
    }
  };

  const setSelectedApiKey = (key: string | null) => {
    setSelectedApiKeyState(key);
    if (key) {
      localStorage.setItem('selectedApiKey', key);
    } else {
      localStorage.removeItem('selectedApiKey');
    }
  };

  const selectApiKey = (key: string | null) => {
    setSelectedApiKey(key);
  };

  const createProject = async (name: string, description: string): Promise<Project> => {
    const response = await apiClient.post<Project>('/projects', { name, description });
    await refreshProjects();
    const newProject = response.data;
    selectProject(newProject);
    return newProject;
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    // Delete project requires confirmation in frontend, and requires selected key in header for delete endpoint
    await apiClient.delete(`/projects/${projectId}`);
    
    // Clear selection if deleted project was selected
    if (selectedProject?.id === projectId) {
      selectProject(null);
    }
    await refreshProjects();
  };

  const generateApiKey = async (projectId: string, name: string): Promise<ApiKey> => {
    const response = await apiClient.post<ApiKey>(`/projects/${projectId}/api-keys`, { name });
    await refreshApiKeys(projectId);
    // Auto select the newly generated key
    setSelectedApiKey(response.data.api_key);
    return response.data;
  };

  const deleteApiKey = async (projectId: string, keyId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/api-keys/${keyId}`);
    await refreshApiKeys(projectId);
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProject,
        selectedApiKey,
        apiKeys,
        isLoadingProjects,
        isLoadingKeys,
        error,
        refreshProjects,
        refreshApiKeys,
        selectProject,
        selectApiKey,
        createProject,
        deleteProject,
        generateApiKey,
        deleteApiKey,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};
