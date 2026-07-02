import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Dialog } from '../components/ui/CustomUI';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';

export const Settings: React.FC = () => {
  const { selectedProject, deleteProject } = useProject();
  
  const navigate = useNavigate();

  // Local settings synced to localStorage
  const [apiBaseUrl, setApiBaseUrl] = useState(
    localStorage.getItem('VITE_API_BASE_URL') || 'http://127.0.0.1:8000/api/v1'
  );
  const [defaultTopK, setDefaultTopK] = useState(
    parseInt(localStorage.getItem('defaultTopK') || '3')
  );
  const [defaultMode, setDefaultMode] = useState(
    localStorage.getItem('defaultRetrievalMode') || 'hybrid'
  );
  const [enableRewrite, setEnableRewrite] = useState(
    localStorage.getItem('defaultRewriteQuery') !== 'false'
  );
  const [enableRerank, setEnableRerank] = useState(
    localStorage.getItem('defaultRerank') !== 'false'
  );
  const [darkSidebar, setDarkSidebar] = useState(true);

  const [savedSuccess, setSavedSuccess] = useState(false);

  // LLM Provider States
  const [providers, setProviders] = useState<{name: string, display_name: string, configured: boolean, default_model: string}[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('ollama');
  const [modelName, setModelName] = useState('phi3:mini');
  const [llmSaveSuccess, setLlmSaveSuccess] = useState(false);
  const [llmSaveError, setLlmSaveError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await apiClient.get('/llm/providers');
        setProviders(res.data);
      } catch (err) {
        console.error('Error fetching LLM providers:', err);
      }
    };
    fetchProviders();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      setSelectedProvider(selectedProject.default_llm_provider || 'ollama');
      setModelName(selectedProject.default_model_name || 'phi3:mini');
    }
  }, [selectedProject]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const providerName = e.target.value;
    setSelectedProvider(providerName);
    const providerInfo = providers.find(p => p.name === providerName);
    if (providerInfo) {
      setModelName(providerInfo.default_model);
    }
  };

  const handleSaveLlmConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setLlmSaveError(null);
    setLlmSaveSuccess(false);
    try {
      await apiClient.post(`/projects/${selectedProject.id}/llm-config`, {
        default_llm_provider: selectedProvider,
        default_model_name: modelName
      });
      selectedProject.default_llm_provider = selectedProvider;
      selectedProject.default_model_name = modelName;
      setLlmSaveSuccess(true);
      setTimeout(() => setLlmSaveSuccess(false), 3000);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Failed to save LLM configuration';
      setLlmSaveError(errMsg);
    }
  };

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('VITE_API_BASE_URL', apiBaseUrl);
    localStorage.setItem('defaultTopK', defaultTopK.toString());
    localStorage.setItem('defaultRetrievalMode', defaultMode);
    localStorage.setItem('defaultRewriteQuery', enableRewrite.toString());
    localStorage.setItem('defaultRerank', enableRerank.toString());
    
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDeleteTrigger = () => {
    setDeleteConfirmationText('');
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmationText !== 'DELETE PROJECT' || !selectedProject) return;
    setIsDeleting(true);
    try {
      await deleteProject(selectedProject.id);
      setDeleteConfirmOpen(false);
      navigate('/projects');
    } catch (err) {
      console.error('Error deleting project:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Project Settings</h2>
        <p className="text-sm text-slate-500">Configure global testing settings, default models, and system properties.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Settings */}
        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>Default endpoint URLs and model connections</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs font-semibold">
            {/* API Base URL */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                API Base URL
              </label>
              <input
                type="text"
                required
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-violet-600 text-slate-800"
              />
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                Active backend endpoint. This React frontend queries this server address for ingestion/chats.
              </p>
            </div>

            {/* Layout Toggles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Default Top K Chunks</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={defaultTopK}
                  onChange={(e) => setDefaultTopK(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-violet-600 text-slate-700 bg-white font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Default Retrieval Mode</label>
                <select
                  value={defaultMode}
                  onChange={(e: any) => setDefaultMode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-violet-600 text-slate-700 bg-white font-semibold"
                >
                  <option value="semantic">Semantic Only</option>
                  <option value="keyword">Keyword Only</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-3 text-slate-700">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rewrite-check"
                  checked={enableRewrite}
                  onChange={(e) => setEnableRewrite(e.target.checked)}
                  className="accent-violet-600 cursor-pointer"
                />
                <label htmlFor="rewrite-check" className="select-none cursor-pointer">Enable Query Rewriting by default</label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rerank-check"
                  checked={enableRerank}
                  onChange={(e) => setEnableRerank(e.target.checked)}
                  className="accent-violet-600 cursor-pointer"
                />
                <label htmlFor="rerank-check" className="select-none cursor-pointer">Enable Reranking by default</label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Branding & Theme</CardTitle>
            <CardDescription>Tailor your platform display parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs font-semibold">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="space-y-0.5">
                <span className="text-slate-800 font-bold block">Dark Sidebar Mode</span>
                <span className="text-[10px] text-slate-400 font-medium block">Sets sidebar background to slate-900 (Recommended)</span>
              </div>
              <input
                type="checkbox"
                checked={darkSidebar}
                onChange={(e) => setDarkSidebar(e.target.checked)}
                className="h-4.5 w-4.5 accent-violet-600 cursor-pointer"
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Action buttons */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess ? (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-4.5 py-2 rounded-xl">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              Settings saved successfully!
            </div>
          ) : <div />}

          <Button type="submit" className="px-6 cursor-pointer">
            Save Settings
          </Button>
        </div>
      </form>

      {/* LLM Model Configuration */}
      {selectedProject && (
        <form onSubmit={handleSaveLlmConfig} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>LLM Provider & Model Configuration</CardTitle>
              <CardDescription>Configure the dynamic LLM connection used for answering queries and rewriting requests for this project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    LLM Provider
                  </label>
                  <select
                    value={selectedProvider}
                    onChange={handleProviderChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-violet-600 text-slate-700 bg-white font-semibold"
                  >
                    {providers.map(p => (
                      <option key={p.name} value={p.name}>
                        {p.display_name} {!p.configured && ' (Not Configured in .env)'}
                      </option>
                    ))}
                    {providers.length === 0 && (
                      <>
                        <option value="ollama">Ollama (Local)</option>
                        <option value="openai">OpenAI Chat</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="mock">Mock Provider (Testing)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Model Name
                  </label>
                  <input
                    type="text"
                    required
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g. gpt-4o-mini"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-violet-600 text-slate-800"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between pt-2">
            {llmSaveSuccess ? (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-4.5 py-2 rounded-xl">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                LLM Configuration saved successfully!
              </div>
            ) : llmSaveError ? (
              <div className="flex items-center gap-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 px-4.5 py-2 rounded-xl">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                {llmSaveError}
              </div>
            ) : <div />}

            <Button type="submit" className="px-6 cursor-pointer">
              Save LLM Config
            </Button>
          </div>
        </form>
      )}

      {/* Danger Zone */}
      {selectedProject && (
        <Card className="border-red-200 bg-rose-50/10 mt-10">
          <CardHeader className="border-b-red-100">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-red-600">Irreversible actions relating to this project</CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-medium">
            <div>
              <strong className="text-slate-800 font-bold">Delete this project</strong>
              <p className="text-slate-500 mt-0.5 leading-normal max-w-md">
                Once deleted, all files, vector documents, search history logs and credentials will be removed. 
              </p>
            </div>
            <Button variant="danger" onClick={handleDeleteTrigger} className="shrink-0 cursor-pointer">
              Delete Project
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title={`Delete project ${selectedProject?.name}?`}
        description="This will permanently delete this project, all uploaded documents, chunks, generated vectors, and logs. This cannot be undone."
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong>Warning:</strong> Deleting this project will break all chat widgets using its active API Keys.
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
