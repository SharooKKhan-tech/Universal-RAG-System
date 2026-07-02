import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import {
  FileText,
  Upload,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  CloudUpload,
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
  TableCell,
} from '../components/ui/CustomUI';
import apiClient from '../services/apiClient';
import type { Document } from '../types';

const PROCESSING_STATUSES = ['uploaded', 'queued', 'processing', 'text_extracted', 'chunking', 'chunked', 'indexing'];

export const Documents: React.FC = () => {
  const { selectedProject } = useProject();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'indexed' | 'failed' | 'processing'>('all');

  // Upload states — clean state machine
  const [dragActive, setDragActive] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Single stable polling ref — avoids stale closures / effect loops
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedProjectRef = useRef(selectedProject);
  useEffect(() => { selectedProjectRef.current = selectedProject; }, [selectedProject]);

  // ── Fetch document list (lightweight — no per-doc chunk fetch) ──────────
  const fetchDocuments = useCallback(async (silent = false) => {
    if (!selectedProjectRef.current) return;
    if (!silent) setLoading(true);
    try {
      const response = await apiClient.get<Document[]>(`/documents/${selectedProjectRef.current.id}`);
      setDocuments(response.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Polling helpers ─────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return; // already running
    pollRef.current = setInterval(async () => {
      if (!selectedProjectRef.current) return;
      try {
        const response = await apiClient.get<Document[]>(`/documents/${selectedProjectRef.current.id}`);
        const docs = response.data;
        setDocuments(docs);
        const stillProcessing = docs.some(d => PROCESSING_STATUSES.includes(d.status));
        if (!stillProcessing) {
          stopPolling();
          setUploadStatus(prev => (prev === 'processing' ? 'done' : prev));
          setUploadingDocId(null);
        }
      } catch { /* silent */ }
    }, 2500);
  }, [stopPolling]);

  // ── Initial load + cleanup on project change ────────────────────────────
  useEffect(() => {
    setDocuments([]);
    setUploadFile(null);
    setUploadStatus('idle');
    setUploadError(null);
    setUploadingDocId(null);
    setUploadProgress(0);
    stopPolling();
    fetchDocuments();
    return () => stopPolling();
  }, [selectedProject?.id]); // eslint-disable-line

  // ── Auto-start polling whenever docs list has a processing doc ───────────
  useEffect(() => {
    const hasProcessing = documents.some(d => PROCESSING_STATUSES.includes(d.status));
    if (hasProcessing) startPolling();
  }, [documents, startPolling]);

  // ── Drag & Drop ─────────────────────────────────────────────────────────
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const validateAndSetFile = (file: File) => {
    const valid = ['text/plain', 'application/pdf'];
    if (valid.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.pdf')) {
      setUploadFile(file);
      setUploadError(null);
      setUploadStatus('idle');
    } else {
      setUploadError('Invalid file type. Only PDF and TXT documents are supported.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  // ── Upload — uses background endpoint (returns immediately) ─────────────
  const handleUpload = async () => {
    if (!selectedProject || !uploadFile) return;

    setUploadStatus('uploading');
    setUploadProgress(10);
    setUploadError(null);

    const formData = new FormData();
    formData.append('project_id', selectedProject.id);
    formData.append('file', uploadFile);

    // Animate progress bar while bytes are sending
    const progressTimer = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 8, 88));
    }, 200);

    try {
      const res = await apiClient.post<{ document_id: string }>(
        '/documents/upload-background',
        formData
      );

      clearInterval(progressTimer);
      setUploadProgress(100);
      setUploadingDocId(res.data.document_id);
      setUploadStatus('processing');
      setUploadFile(null);

      // Immediately show the doc row (status = queued/processing)
      await fetchDocuments(true);

      // Kick off polling
      startPolling();
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error('Upload failed:', err);
      setUploadError(err.response?.data?.detail || 'Upload failed. Please try again.');
      setUploadStatus('error');
      setUploadProgress(0);
    }
  };

  // ── Reindex / Delete ────────────────────────────────────────────────────
  const triggerReindex = async (doc: Document) => {
    try {
      await apiClient.post(`/documents/reindex/${doc.id}`);
      await fetchDocuments(true);
      startPolling();
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
      await fetchDocuments(true);
    } catch (err) {
      console.error('Failed to delete document:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Status badge ────────────────────────────────────────────────────────
  const getStatusBadge = (status: string, docId?: string) => {
    switch (status) {
      case 'indexed':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3.5 w-3.5" />
            Indexed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="danger" className="gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="warning" className={`gap-1 ${docId === uploadingDocId ? 'ring-1 ring-amber-400' : ''}`}>
            <Loader2 className="h-3 w-3 animate-spin" />
            {status.replace(/_/g, ' ')}
          </Badge>
        );
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'indexed') return matchesSearch && doc.status === 'indexed';
    if (statusFilter === 'failed') return matchesSearch && doc.status === 'failed';
    if (statusFilter === 'processing') return matchesSearch && !['indexed', 'failed'].includes(doc.status);
    return matchesSearch;
  });

  const uploadButtonLabel = () => {
    if (uploadStatus === 'uploading') return 'Uploading...';
    if (uploadStatus === 'processing') return 'Processing in background...';
    if (uploadStatus === 'done') return 'Upload Another';
    return 'Start Ingestion';
  };

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Documents — {selectedProject.name}</h2>
          <p className="text-sm text-slate-500">Upload PDF/TXT documents to index them into your vector store</p>
        </div>
        <Button onClick={() => fetchDocuments()} variant="outline" className="gap-2 shrink-0 cursor-pointer">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upload panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Knowledge</CardTitle>
              <CardDescription>Supports PDF and plain text (.txt, .pdf)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-violet-500 bg-violet-50/50'
                    : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50/30'
                }`}
              >
                <input type="file" id="doc-upload" className="hidden" accept=".pdf,.txt" onChange={handleFileChange} />
                <CloudUpload className="h-10 w-10 text-slate-400 mb-3" />
                <label htmlFor="doc-upload" className="text-xs font-bold text-violet-600 hover:underline cursor-pointer">
                  Click to upload
                </label>
                <span className="text-[10px] text-slate-400 mt-1.5 font-medium">or drag & drop files here</span>
                <span className="text-[9px] text-slate-400 mt-0.5">PDF or TXT · Max 50 MB</span>
              </div>

              {/* File preview */}
              {uploadFile && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 max-w-[80%]">
                    <FileText className="h-4 w-4 text-violet-600 shrink-0" />
                    <span className="truncate font-semibold text-slate-700">{uploadFile.name}</span>
                  </div>
                  <button
                    onClick={() => { setUploadFile(null); setUploadStatus('idle'); }}
                    className="text-slate-400 hover:text-slate-600 font-bold text-base"
                  >×</button>
                </div>
              )}

              {/* Progress bar */}
              {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      {uploadStatus === 'uploading' ? 'Uploading file...' : 'Indexing in background...'}
                    </span>
                    {uploadStatus === 'uploading' && <span>{uploadProgress}%</span>}
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    {uploadStatus === 'uploading' ? (
                      <div
                        className="bg-violet-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    ) : (
                      <div className="bg-violet-400 h-full rounded-full animate-pulse" />
                    )}
                  </div>
                  {uploadStatus === 'processing' && (
                    <p className="text-[10px] text-slate-400 text-center pt-1">
                      The document list updates automatically — no need to refresh.
                    </p>
                  )}
                </div>
              )}

              {/* Success */}
              {uploadStatus === 'done' && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-[11px] text-emerald-700 font-semibold">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  Document indexed successfully!
                </div>
              )}

              {/* Error */}
              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-700 font-semibold leading-relaxed flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {uploadError}
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!uploadFile || uploadStatus === 'uploading' || uploadStatus === 'processing'}
                className="w-full gap-2 py-3 cursor-pointer"
              >
                {(uploadStatus === 'uploading' || uploadStatus === 'processing')
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Upload className="h-4 w-4" />
                }
                {uploadButtonLabel()}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Document table */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Knowledge Base</CardTitle>
                  <CardDescription>
                    {documents.length} document{documents.length !== 1 ? 's' : ''} in this project
                    {documents.some(d => PROCESSING_STATUSES.includes(d.status)) && (
                      <span className="ml-2 text-amber-600 font-semibold animate-pulse">· Indexing in progress...</span>
                    )}
                  </CardDescription>
                </div>
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
                  {documents.length === 0
                    ? 'No documents yet. Upload a PDF or TXT file to get started.'
                    : 'No documents match your current filters.'}
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
                        <TableHead>Uploaded</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.map((doc) => (
                        <TableRow key={doc.id} className={doc.id === uploadingDocId ? 'bg-violet-50/40' : ''}>
                          <TableCell className="font-semibold text-slate-800 truncate max-w-[150px]" title={doc.file_name}>
                            {doc.file_name}
                          </TableCell>
                          <TableCell className="font-medium text-xs text-slate-500 uppercase">{doc.file_type}</TableCell>
                          <TableCell>{getStatusBadge(doc.status, doc.id)}</TableCell>
                          <TableCell className="font-semibold text-slate-700">{(doc as any).chunks_count || '—'}</TableCell>
                          <TableCell className="text-xs text-slate-400 font-semibold">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => triggerReindex(doc)}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-violet-600 rounded-lg transition-colors cursor-pointer"
                                title="Re-index Document"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => triggerDelete(doc)}
                                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                title="Delete Document"
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

      {/* Delete Dialog */}
      <Dialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirm Document Deletion"
        description="Are you sure you want to delete this document? All vector indexes, chunk blocks, and references will be permanently deleted. This cannot be undone."
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">File Name:</span>
              <span className="font-bold text-slate-800 truncate max-w-[200px]">{docToDelete?.file_name}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="danger" isLoading={isDeleting} onClick={confirmDelete}>Delete Document</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
