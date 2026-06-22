import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  AlertTriangle
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

import type { ApiKey } from '../types';

export const ApiKeyManagement: React.FC = () => {
  const { selectedProject, selectedApiKey, selectApiKey, apiKeys, generateApiKey, deleteApiKey, isLoadingKeys } = useProject();

  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  
  // Generate Key Modal state
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Newly generated key storage
  const [newKeyRecord, setNewKeyRecord] = useState<ApiKey | null>(null);
  const [copiedNewKey, setCopiedNewKey] = useState(false);

  // Warning state if no key is active


  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !keyName.trim()) return;
    setIsSubmitting(true);
    try {
      const newKey = await generateApiKey(selectedProject.id, keyName);
      setNewKeyRecord(newKey);
      setKeyName('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyKey = (keyStr: string, id: string) => {
    navigator.clipboard.writeText(keyStr);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const copyNewKey = () => {
    if (newKeyRecord) {
      navigator.clipboard.writeText(newKeyRecord.api_key);
      setCopiedNewKey(true);
      setTimeout(() => setCopiedNewKey(false), 2000);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!selectedProject) return;
    if (confirm('Are you sure you want to delete this API key? This will revoke access for any applications using this key.')) {
      try {
        await deleteApiKey(selectedProject.id, keyId);
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (!selectedProject) {
    return (
      <Card className="text-center py-16 bg-white border-dashed border-2 border-slate-200 max-w-2xl mx-auto mt-12">
        <CardContent className="space-y-4">
          <div className="bg-amber-50 h-14 w-14 rounded-2xl flex items-center justify-center mx-auto border border-amber-100">
            <FolderPlusIcon className="h-7 w-7 text-amber-500" />
          </div>
          <div className="max-w-xs mx-auto space-y-1.5">
            <h3 className="text-md font-bold text-slate-800">No project selected</h3>
            <p className="text-xs text-slate-500">Please select or create a project in the top bar to view API key settings.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">API Keys - {selectedProject.name}</h2>
          <p className="text-sm text-slate-500">Manage API keys to connect your websites or applications to this knowledge project.</p>
        </div>
        <Button onClick={() => { setNewKeyRecord(null); setIsGenerateOpen(true); }} className="gap-2 shrink-0">
          <Plus className="h-4.5 w-4.5" />
          Generate API Key
        </Button>
      </div>

      {/* API Key Warning Banner */}
      <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 text-xs text-amber-800">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
        <div className="space-y-1">
          <span className="font-bold">Important Authentication Information</span>
          <p>
            API keys are required to authenticate your client applications. Keep your API keys secure. They will grant access to all documents and search/chat functions associated with the <strong className="font-semibold text-slate-800">{selectedProject.name}</strong> project.
          </p>
        </div>
      </div>

      {/* Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Credentials</CardTitle>
          <CardDescription>Select an API Key to authenticate this dashboard's testing queries.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingKeys ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-violet-600 mx-auto" />
              <span className="text-xs text-slate-400 mt-2 block">Loading credentials...</span>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No API keys generated for this project yet. Click "Generate API Key" to create one.
            </div>
          ) : (
            <TableContainer className="border-none rounded-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key Name</TableHead>
                    <TableHead>Key Value</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Testing Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => {
                    const isActiveInSession = selectedApiKey === key.api_key;
                    
                    return (
                      <TableRow key={key.id} className={isActiveInSession ? 'bg-violet-50/20' : ''}>
                        <TableCell className="font-semibold text-slate-800">{key.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <code className="font-mono text-xs text-slate-600 bg-slate-50 border border-slate-100 px-2 py-1 rounded-sm">
                              {isActiveInSession 
                                ? key.api_key.substring(0, 10) + '...' + key.api_key.substring(key.api_key.length - 6)
                                : 'rag_sk_••••••••••••••••'
                              }
                            </code>
                            <button
                              onClick={() => copyKey(key.api_key, key.id)}
                              className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                              title="Copy API Key"
                            >
                              {copiedKeyId === key.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {new Date(key.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {isActiveInSession ? (
                            <Badge variant="purple" className="gap-1">
                              <span className="h-1.5 w-1.5 bg-violet-600 rounded-full animate-ping" />
                              Active testing key
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="py-1 h-7 text-xs font-semibold"
                              onClick={() => selectApiKey(key.api_key)}
                            >
                              Select Key
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(key.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Generate Key Modal */}
      <Dialog
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        title={newKeyRecord ? "API Key Generated Successfully!" : "Generate API Key"}
        description={newKeyRecord ? "Copy this key and save it. It will not be shown again." : "Create an API access token for this project."}
      >
        {!newKeyRecord ? (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Key Name
              </label>
              <input
                type="text"
                required
                minLength={3}
                placeholder="e.g. production-website-key"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-violet-600 text-slate-800"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setIsGenerateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Generate Key
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs flex items-start gap-2.5 text-rose-800">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <strong>Warning:</strong> For security reasons, this key will only be shown once. Copy it now and save it in your records.
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs">
                <code className="font-mono text-emerald-950 font-bold select-all flex-1 truncate">{newKeyRecord.api_key}</code>
                <button
                  onClick={copyNewKey}
                  className="p-1.5 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedNewKey ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                onClick={() => {
                  setIsGenerateOpen(false);
                  setNewKeyRecord(null);
                }}
              >
                Close & Proceed
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

// Quick helper icon component to avoid importing all files
const FolderPlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
