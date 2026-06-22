import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  Plus, 
  Trash2, 
  Eye, 
  Search, 
  LayoutGrid, 
  List, 
  Calendar, 
  FileText, 
  MessageSquare, 
  AlertTriangle,
  Key,
  Copy,
  Check,
  FolderKanban
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  Button, 
  Dialog,
  Badge,
  TableContainer,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from '../components/ui/CustomUI';
import apiClient from '../services/apiClient';
import type { Project } from '../types';
import { useNavigate } from 'react-router-dom';

export const Projects: React.FC = () => {
  const { 
    projects, 
    isLoadingProjects, 
    createProject, 
    selectProject,
    generateApiKey 
  } = useProject();

  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  // Create Project State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Post-Creation State
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Project Stats cache
  const [projectStats, setProjectStats] = useState<Record<string, { docs: number; queries: number }>>({});

  useEffect(() => {
    const fetchProjectStats = async () => {
      const stats: Record<string, { docs: number; queries: number }> = {};
      for (const p of projects) {
        let docs = 0;
        let queries = 0;
        
        try {
          // Attempt to load documents for count
          const docsRes = await apiClient.get(`/documents/${p.id}`);
          if (docsRes.data) docs = docsRes.data.length;
        } catch (e) {}

        try {
          // Attempt to load queries count
          const queriesRes = await apiClient.get(`/queries/${p.id}`);
          if (queriesRes.data) queries = queriesRes.data.length;
        } catch (e) {}

        stats[p.id] = { docs, queries };
      }
      setProjectStats(stats);
    };

    if (projects.length > 0) {
      fetchProjectStats();
    }
  }, [projects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;
    setIsSubmitting(true);
    try {
      const p = await createProject(projName, projDesc);
      setCreatedProject(p);
      setProjName('');
      setProjDesc('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateKeyAfterCreate = async () => {
    if (!createdProject) return;
    try {
      const keyRecord = await generateApiKey(createdProject.id, 'default-key');
      setGeneratedKey(keyRecord.api_key);
    } catch (err) {
      console.error(err);
    }
  };

  const copyApiKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleDeleteTrigger = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(p);
    setDeleteConfirmationText('');
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmationText !== 'DELETE PROJECT' || !projectToDelete) return;
    setIsDeleting(true);
    try {
      // Set headers with project's api key to authorize deletion if any key exists
      let keysRes;
      let headers = {};
      try {
        keysRes = await apiClient.get(`/projects/${projectToDelete.id}/api-keys`);
        if (keysRes.data && keysRes.data.length > 0) {
          headers = { 'X-API-Key': keysRes.data[0].api_key };
        }
      } catch (e) {}

      await apiClient.delete(`/projects/${projectToDelete.id}`, { headers });
      setDeleteConfirmOpen(false);
      setProjectToDelete(null);
      // Force reload page by context refresh
      navigate('/projects');
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const navigateToProject = (p: Project) => {
    selectProject(p);
    navigate(`/projects/${p.id}`);
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Projects</h2>
          <p className="text-sm text-slate-500">Manage isolated RAG environments for your organizations</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggles */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200/50">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white text-violet-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <LayoutGrid className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-white text-violet-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <List className="h-4.5 w-4.5" />
            </button>
          </div>
          {/* Create button */}
          <Button onClick={() => { setCreatedProject(null); setGeneratedKey(null); setIsCreateOpen(true); }} className="gap-2">
            <Plus className="h-4.5 w-4.5" />
            Create Project
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-violet-600 text-slate-800 shadow-2xs"
        />
      </div>

      {/* Main projects grid/list */}
      {isLoadingProjects ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
          <span className="text-sm text-slate-400 mt-3 block">Loading projects...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="text-center py-16 bg-white border-dashed border-2 border-slate-200">
          <CardContent className="space-y-4">
            <div className="bg-slate-50 h-14 w-14 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
              <FolderKanban className="h-7 w-7 text-slate-400" />
            </div>
            <div className="max-w-xs mx-auto space-y-1.5">
              <h3 className="text-md font-bold text-slate-800">No projects found</h3>
              <p className="text-xs text-slate-500">Create a new RAG project to start uploading documents and querying knowledge bases.</p>
            </div>
            <Button onClick={() => { setCreatedProject(null); setGeneratedKey(null); setIsCreateOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Create your first project
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((proj) => {
            const stats = projectStats[proj.id] || { docs: 0, queries: 0 };
            return (
              <Card 
                key={proj.id} 
                className="cursor-pointer border-slate-200/60 hover:border-violet-300 hover:shadow-md transition-all flex flex-col justify-between"
                onClick={() => navigateToProject(proj)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <Badge variant="purple">Active</Badge>
                    <button
                      onClick={(e) => handleDeleteTrigger(proj, e)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <CardTitle className="mt-2 text-md font-bold text-slate-800">{proj.name}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-8 text-xs">{proj.description || 'No description provided.'}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 pb-5">
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4 text-xs">
                    <div className="flex items-center gap-2 text-slate-500">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="font-semibold text-slate-800">{stats.docs}</div>
                        <div>Documents</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <MessageSquare className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="font-semibold text-slate-800">{stats.queries}</div>
                        <div>Queries</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Created: {new Date(proj.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Queries</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((proj) => {
                const stats = projectStats[proj.id] || { docs: 0, queries: 0 };
                return (
                  <TableRow key={proj.id} className="cursor-pointer" onClick={() => navigateToProject(proj)}>
                    <TableCell className="font-semibold text-slate-800">{proj.name}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-slate-500">{proj.description || '—'}</TableCell>
                    <TableCell className="font-medium">{stats.docs}</TableCell>
                    <TableCell className="font-medium">{stats.queries}</TableCell>
                    <TableCell className="text-xs text-slate-500">{new Date(proj.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="success">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="gap-1.5"
                          onClick={() => navigateToProject(proj)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => handleDeleteTrigger(proj, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Creation Modal */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={createdProject ? "Project Created Successfully!" : "Create New Project"}
        description={createdProject ? "Get started by generating your API key." : "Create an isolated workspace."}
      >
        {!createdProject ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Project Name
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={100}
                placeholder="e.g. MediCare Assistant"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-violet-600 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Description (Optional)
              </label>
              <textarea
                maxLength={500}
                rows={3}
                placeholder="Describe what this project will handle..."
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-violet-600 text-slate-800 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Create Project
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Name:</span>
                <span className="font-semibold text-slate-800">{createdProject.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">ID:</span>
                <code className="font-mono font-semibold text-violet-700">{createdProject.id}</code>
              </div>
            </div>

            {generatedKey ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Copy API Key (Saved in local storage)
                </label>
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs">
                  <code className="font-mono text-emerald-900 select-all flex-1 truncate">{generatedKey}</code>
                  <button
                    onClick={copyApiKey}
                    className="p-1.5 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                  >
                    {copiedKey ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-amber-600 font-semibold">
                  ⚠️ Make sure to copy it now. You won't be able to see it again!
                </p>
              </div>
            ) : (
              <Button onClick={handleGenerateKeyAfterCreate} className="w-full gap-2 py-3">
                <Key className="h-4 w-4" />
                Generate Project API Key
              </Button>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsCreateOpen(false);
                  navigateToProject(createdProject);
                }}
              >
                Go to Project details
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete Project Completely?"
        description="This will permanently delete the project, all uploaded documents, generated chunks, vector indexes, and query logs. This action is irreversible!"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5 animate-bounce" />
            <div>
              <strong>Warning:</strong> Deleting <span className="font-bold">{projectToDelete?.name}</span> will instantly break any embedded web chat widgets using this project's API keys.
            </div>
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              To confirm, type <span className="text-red-600 font-bold">DELETE PROJECT</span> below:
            </label>
            <input
              type="text"
              placeholder="DELETE PROJECT"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              className="w-full px-3.5 py-2 border border-rose-200 rounded-xl text-sm focus:outline-hidden focus:border-red-600 text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteConfirmationText !== 'DELETE PROJECT'}
              isLoading={isDeleting}
              onClick={handleDeleteConfirm}
            >
              Delete Project
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
