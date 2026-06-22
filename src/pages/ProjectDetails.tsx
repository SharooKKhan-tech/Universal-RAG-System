import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { 
  FolderKanban, 
  Upload, 
  MessageSquare, 
  BarChart3, 
  BadgeCent, 
  Calendar,
  FileText,
  ArrowLeft,
  Copy,
  Check
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  Button, 
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '../components/ui/CustomUI';
import apiClient from '../services/apiClient';

// Sub-tab page components
import { Documents } from './Documents';
import { ApiKeyManagement } from './ApiKeyManagement';
import { Analytics } from './Analytics';
import { Evaluation } from './Evaluation';
import { UsageCost } from './UsageCost';
import { ChatWidgetPreview } from './ChatWidgetPreview';

export const ProjectDetails: React.FC = () => {
  const { project_id: _project_id } = useParams<{ project_id: string }>();
  const navigate = useNavigate();
  const { selectedProject, selectedApiKey } = useProject();

  const [activeTab, setActiveTab] = useState('documents');
  const [copiedKey, setCopiedKey] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [queriesCount, setQueriesCount] = useState(0);

  // Fetch counts on project changes
  useEffect(() => {
    const fetchCounts = async () => {
      if (!selectedProject) return;
      try {
        const docRes = await apiClient.get(`/documents/${selectedProject.id}`);
        setDocCount(docRes.data ? docRes.data.length : 0);
      } catch (e) {}
      
      try {
        const queriesRes = await apiClient.get(`/queries/${selectedProject.id}`);
        setQueriesCount(queriesRes.data ? queriesRes.data.length : 0);
      } catch (e) {}
    };

    fetchCounts();
  }, [selectedProject, activeTab]);

  const copyApiKey = () => {
    if (selectedApiKey) {
      navigator.clipboard.writeText(selectedApiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (!selectedProject) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto" />
        <span className="text-sm text-slate-400 mt-3 block">Loading project configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/projects')}
          className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <FolderKanban className="h-3.5 w-3.5" />
            <span>Project Details</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 leading-tight">{selectedProject.name}</h2>
        </div>
      </div>

      {/* Main Grid: Project Info & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Card: Info preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
            <CardDescription>Workspace metadata and auth token preview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs font-semibold">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Description</span>
                <p className="text-slate-700 leading-normal">{selectedProject.description || 'No description provided.'}</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Testing API Key</span>
                {selectedApiKey ? (
                  <div className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg p-1 px-2.5 font-mono text-[11px] text-slate-700">
                    <span className="truncate">
                      {selectedApiKey.substring(0, 12)}...{selectedApiKey.substring(selectedApiKey.length - 8)}
                    </span>
                    <button
                      onClick={copyApiKey}
                      className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                      title="Copy API Key"
                    >
                      {copiedKey ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-600 font-semibold">
                    No active API Key selected.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2 text-slate-500 text-[11px]">
              <span className="flex items-center gap-1.5 font-semibold">
                <Calendar className="h-4 w-4 text-slate-400" />
                Created: {new Date(selectedProject.created_at).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5 font-semibold">
                <FileText className="h-4 w-4 text-slate-400" />
                Documents: {docCount} files
              </span>
              <span className="flex items-center gap-1.5 font-semibold">
                <MessageSquare className="h-4 w-4 text-slate-400" />
                Queries handled: {queriesCount} calls
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right Card: Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Shortcut workflows for this project</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pb-6">
            <Button
              variant="outline"
              onClick={() => setActiveTab('documents')}
              className="flex-col h-20 text-xs gap-1.5 justify-center rounded-xl cursor-pointer"
            >
              <Upload className="h-5 w-5 text-violet-600" />
              Upload Document
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/chat')}
              className="flex-col h-20 text-xs gap-1.5 justify-center rounded-xl cursor-pointer"
            >
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              Chat with Project
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveTab('analytics')}
              className="flex-col h-20 text-xs gap-1.5 justify-center rounded-xl cursor-pointer"
            >
              <BarChart3 className="h-5 w-5 text-blue-600" />
              View Analytics
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveTab('usage')}
              className="flex-col h-20 text-xs gap-1.5 justify-center rounded-xl cursor-pointer"
            >
              <BadgeCent className="h-5 w-5 text-amber-600" />
              View Usage
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="documents" activeTab={activeTab} onClick={setActiveTab}>
            Documents
          </TabsTrigger>
          <TabsTrigger value="apikeys" activeTab={activeTab} onClick={setActiveTab}>
            API Keys
          </TabsTrigger>
          <TabsTrigger value="analytics" activeTab={activeTab} onClick={setActiveTab}>
            Analytics
          </TabsTrigger>
          <TabsTrigger value="evals" activeTab={activeTab} onClick={setActiveTab}>
            Evaluation
          </TabsTrigger>
          <TabsTrigger value="usage" activeTab={activeTab} onClick={setActiveTab}>
            Usage & Billing
          </TabsTrigger>
          <TabsTrigger value="widget" activeTab={activeTab} onClick={setActiveTab}>
            Widget Preview
          </TabsTrigger>
        </TabsList>

        <div className="pt-2">
          <TabsContent value="documents" activeTab={activeTab}>
            <Documents />
          </TabsContent>
          <TabsContent value="apikeys" activeTab={activeTab}>
            <ApiKeyManagement />
          </TabsContent>
          <TabsContent value="analytics" activeTab={activeTab}>
            <Analytics />
          </TabsContent>
          <TabsContent value="evals" activeTab={activeTab}>
            <Evaluation />
          </TabsContent>
          <TabsContent value="usage" activeTab={activeTab}>
            <UsageCost />
          </TabsContent>
          <TabsContent value="widget" activeTab={activeTab}>
            <ChatWidgetPreview />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
