import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  FileText, 
  Upload, 
  Trash2, 
  RefreshCw, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  Hourglass
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
import type { Document } from '../types';

export const Documents: React.FC = () => {
  const { selectedProject, selectedApiKey } = useProject();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'indexed' | 'failed' | 'processing'>('all');

  // Upload states
  const [dragActive, setDragActive] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      // Query parameters for status if needed, otherwise filter in frontend for cleaner search/refresh
      const response = await apiClient.get<Document[]>(`/documents/${selectedProject.id}`);
      
      // Let's retrieve chunks counts for each document to show in the list
      const docs = response.data;
      const docsWithChunks = await Promise.all(docs.map(async (doc) => {
        try {
          const chunkRes = await apiClient.get(`/chunks/document/${doc.id}`);
          return {
            ...doc,
            chunks_count: chunkRes.data ? chunkRes.data.length : 0
          };
        } catch (e) {
          return { ...doc, chunks_count: 0 };
        }
      }));

      setDocuments(docsWithChunks);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchDocuments();
    
    // Set up status checker interval if there are documents currently indexing/processing
    const interval = setInterval(() => {
      const hasProcessing = documents.some(doc => 
        ['uploaded', 'queued', 'processing', 'text_extracted', 'chunking', 'chunked', 'indexing'].includes(doc.status)
      );
      if (hasProcessing) {
        fetchDocuments();
      }
    }, 5000); // Poll every 5s if indexing is active

    return () => clearInterval(interval);
  }, [selectedProject, documents, fetchDocuments]);

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const validTypes = ['text/plain', 'application/pdf'];
      if (validTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.pdf')) {
        setUploadFile(file);
        setUploadError(null);
      } else {
        setUploadError('Invalid file type. Only PDF and TXT documents are supported.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedProject || !uploadFile) return;
    setIsUploading(true);
    setUploadProgress(20);
    setUploadError(null);

    const formData = new FormData();
    formData.append('project_id', selectedProject.id);
    formData.append('file', uploadFile);

    try {
      setUploadProgress(50);
      // Call documents/upload-and-index to index immediately
      await apiClient.post('/documents/upload-and-index', formData);
      setUploadProgress(100);
      setUploadFile(null);
      fetchDocuments();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.response?.data?.detail || 'Document upload and indexing failed.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const triggerReindex = async (doc: Document) => {
    try {
      await apiClient.post(`/documents/reindex/${doc.id}`);
      fetchDocuments();
    } catch (err) {
      console.error('Reindexing failed:', err);
    }
  };

  const triggerDelete = (doc: Document) => {
    setDocToDelete(doc);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/documents/${docToDelete.id}`);
      setDeleteConfirmOpen(false);
      setDocToDelete(null);
      fetchDocuments();
    } catch (err) {
      console.error('Failed to delete document:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'indexed':
        return <Badge variant="success" className="gap-1"><CheckCircle className="h-3.5 w-3.5" />Indexed</Badge>;
      case 'failed':
        return <Badge variant="danger" className="gap-1"><AlertCircle className="h-3.5 w-3.5" />Failed</Badge>;
      case 'uploaded':
      case 'queued':
      case 'processing':
      case 'text_extracted':
      case 'chunking':
      case 'chunked':
      case 'indexing':
        return (
          <Badge variant="warning" className="gap-1 animate-pulse">
            <Hourglass className="h-3.5 w-3.5 animate-spin" />
            {status.replace('_', ' ')}
          </Badge>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'indexed') return matchesSearch && doc.status === 'indexed';
    if (statusFilter === 'failed') return matchesSearch && doc.status === 'failed';
    if (statusFilter === 'processing') {
      return matchesSearch && !['indexed', 'failed'].includes(doc.status);
    }
    return matchesSearch;
  });

  if (!selectedProject) {
    return (
      <Card className="text-center py-16 bg-white border-dashed border-2 border-slate-200 max-w-2xl mx-auto mt-12">
        <CardContent className="space-y-4">
          <div className="bg-amber-50 h-14 w-14 rounded-2xl flex items-center justify-center mx-auto border border-amber-100">
            <Upload className="h-7 w-7 text-amber-500" />
          </div>
          <div className="max-w-xs mx-auto space-y-1.5">
            <h3 className="text-md font-bold text-slate-800">No project selected</h3>
            <p className="text-xs text-slate-500">Please select or create a project in the top bar to manage documents.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Documents - {selectedProject.name}</h2>
          <p className="text-sm text-slate-500">Upload PDF/TXT documents to index them into your Vector store</p>
        </div>
        <Button onClick={fetchDocuments} variant="outline" className="gap-2 shrink-0 cursor-pointer">
          <RefreshCw className="h-4 w-4" />
          Refresh Statuses
        </Button>
      </div>

      {/* Warning if no key */}
      {!selectedApiKey && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 text-xs text-amber-800 shadow-2xs">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p>
            <strong>Note:</strong> You must configure and select an API Key for this project to perform file indexing operations. Visit the <strong>API Keys</strong> tab to generate one.
          </p>
        </div>
      )}

      {/* Main Grid: Upload left, Document Table right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Drag and drop upload */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Knowledge</CardTitle>
              <CardDescription>Support PDF and Plain Text files (.txt, .pdf)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drag active box */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                  dragActive 
                    ? "border-violet-500 bg-violet-50/50" 
                    : "border-slate-200 hover:border-violet-300 hover:bg-slate-50/30"
                }`}
              >
                <input
                  type="file"
                  id="doc-upload"
                  className="hidden"
                  accept=".pdf,.txt"
                  onChange={handleFileChange}
                />
                
                <Upload className="h-10 w-10 text-slate-400 mb-3" />
                
                <label htmlFor="doc-upload" className="text-xs font-bold text-violet-600 hover:underline cursor-pointer">
                  Click to upload
                </label>
                <span className="text-[10px] text-slate-400 mt-1.5 font-medium">or drag & drop files here</span>
                <span className="text-[9px] text-slate-400 mt-0.5">Max size: 50MB</span>
              </div>

              {/* Upload file preview */}
              {uploadFile && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 max-w-[80%]">
                    <FileText className="h-4.5 w-4.5 text-violet-600 shrink-0" />
                    <span className="truncate font-semibold text-slate-700">{uploadFile.name}</span>
                  </div>
                  <button
                    onClick={() => setUploadFile(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Progress bar */}
              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Uploading & Chunking...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-violet-600 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-700 font-semibold leading-relaxed">
                  {uploadError}
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!uploadFile || isUploading || !selectedApiKey}
                className="w-full gap-2 py-3 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                Start Ingestion
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Documents table */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Knowledge Base</CardTitle>
                  <CardDescription>All knowledge index documents for this project</CardDescription>
                </div>
                
                {/* Filter and Search */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-violet-600 text-slate-700"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden text-slate-700 font-medium"
                  >
                    <option value="all">All Statuses</option>
                    <option value="indexed">Indexed Only</option>
                    <option value="processing">Processing</option>
                    <option value="failed">Failed Only</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading && documents.length === 0 ? (
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-violet-600 mx-auto" />
                  <span className="text-xs text-slate-400 mt-2 block font-medium">Loading documents...</span>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  No documents match the selected filters or search queries.
                </div>
              ) : (
                <TableContainer className="border-none rounded-none">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Chunks</TableHead>
                        <TableHead>Uploaded At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-semibold text-slate-800 truncate max-w-[150px]" title={doc.file_name}>
                            {doc.file_name}
                          </TableCell>
                          <TableCell className="font-medium text-xs text-slate-500 uppercase">{doc.file_type}</TableCell>
                          <TableCell>{getStatusBadge(doc.status)}</TableCell>
                          <TableCell className="font-semibold text-slate-700">{doc.chunks_count || '—'}</TableCell>
                          <TableCell className="text-xs text-slate-400 font-semibold">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => triggerReindex(doc)}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-violet-600 rounded-lg transition-colors cursor-pointer"
                                title="Re-index Document"
                                disabled={!selectedApiKey}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => triggerDelete(doc)}
                                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                title="Delete Document"
                                disabled={!selectedApiKey}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Document Confirmation */}
      <Dialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirm Document Deletion"
        description="Are you sure you want to delete this document? All vector indexes, chunk blocks, and references associated with this file will be permanently deleted. This cannot be undone."
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">File Name:</span>
              <span className="font-bold text-slate-800 truncate max-w-[200px]">{docToDelete?.file_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Chunks:</span>
              <span className="font-semibold text-slate-800">{docToDelete?.chunks_count || '0'}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              onClick={confirmDelete}
            >
              Delete Document
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
