import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { 
  Copy, 
  Check, 
  ChevronDown, 
  Key, 
  AlertTriangle, 
  FolderPlus
} from 'lucide-react';
import { Button, Dialog } from '../ui/CustomUI';

export const Topbar: React.FC = () => {
  const { 
    projects, 
    selectedProject, 
    selectedApiKey, 
    selectProject,
    createProject 
  } = useProject();

  const [copiedProjId, setCopiedProjId] = useState(false);
  const [isOpenProjSelect, setIsOpenProjSelect] = useState(false);
  
  // Create Project state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const copyProjectId = () => {
    if (selectedProject) {
      navigator.clipboard.writeText(selectedProject.id);
      setCopiedProjId(true);
      setTimeout(() => setCopiedProjId(false), 2000);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;
    setIsSubmitting(true);
    try {
      await createProject(projName, projDesc);
      setIsCreateOpen(false);
      setProjName('');
      setProjDesc('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <header className="h-16 border-b border-slate-100 bg-white px-6 flex items-center justify-between sticky top-0 z-40 shadow-2xs">
      {/* Project Selector Section */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setIsOpenProjSelect(!isOpenProjSelect)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-colors cursor-pointer"
          >
            <span className="text-violet-600 font-bold">Project:</span>
            <span>{selectedProject ? selectedProject.name : 'Select Project'}</span>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>

          {isOpenProjSelect && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsOpenProjSelect(false)} />
              <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-100 rounded-xl shadow-lg z-20 p-2 py-1.5 animate-in fade-in-50 duration-100">
                <div className="text-[10px] font-bold text-slate-400 px-3 py-1.5 uppercase tracking-wider">
                  Switch Project
                </div>
                <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-0.5">
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => {
                        selectProject(proj);
                        setIsOpenProjSelect(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${
                        selectedProject?.id === proj.id
                          ? 'bg-violet-50 text-violet-700 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="truncate">{proj.name}</span>
                      {selectedProject?.id === proj.id && (
                        <Check className="h-3.5 w-3.5 text-violet-600" />
                      )}
                    </button>
                  ))}
                  {projects.length === 0 && (
                    <div className="text-xs text-slate-400 p-3 text-center">No projects available</div>
                  )}
                </div>
                
                <div className="border-t border-slate-50 mt-1.5 pt-1.5">
                  <button
                    onClick={() => {
                      setIsOpenProjSelect(false);
                      setIsCreateOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    Create New Project
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Selected Project ID display */}
        {selectedProject && (
          <div className="hidden md:flex items-center gap-1 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-[11px] text-slate-500 font-medium">
            <span className="text-slate-400">ID:</span>
            <code className="text-slate-700 font-semibold select-all">{selectedProject.id}</code>
            <button
              onClick={copyProjectId}
              className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-md transition-colors ml-1 cursor-pointer"
              title="Copy Project ID"
            >
              {copiedProjId ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        )}
      </div>

      {/* Right User & Key status info */}
      <div className="flex items-center gap-4">
        {/* Active API Key Indicator */}
        {selectedProject && (
          <div className="flex items-center gap-2.5">
            {selectedApiKey ? (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1.5 rounded-xl text-xs font-semibold">
                <Key className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden sm:inline">API Key:</span>
                <span className="font-mono text-[11px] bg-emerald-100 px-1.5 py-0.5 rounded-sm">
                  {selectedApiKey.substring(0, 6)}...{selectedApiKey.substring(selectedApiKey.length - 4)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-100 px-3 py-1.5 rounded-xl text-xs font-semibold">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 animate-bounce" />
                <span className="hidden sm:inline">Protected Mode:</span>
                <span>No API Key</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Project"
        description="Set up an isolated environment for your documents and chatbots."
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Project Name
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={100}
              placeholder="e.g. Medicare Support"
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
              placeholder="Write a brief summary of what this project does..."
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
      </Dialog>
    </header>
  );
};
