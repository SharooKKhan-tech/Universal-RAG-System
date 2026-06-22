import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  Search, 
  BookOpen, 
  AlertTriangle,
  SlidersHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, Button } from '../components/ui/CustomUI';
import apiClient from '../services/apiClient';
import type { SearchResultChunk } from '../types';

export const SearchPlayground: React.FC = () => {
  const { selectedProject, selectedApiKey } = useProject();

  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [retrievalMode, setRetrievalMode] = useState<'semantic' | 'keyword' | 'hybrid'>('hybrid');
  const [rerank, setRerank] = useState(true);

  const [results, setResults] = useState<SearchResultChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !selectedProject || !selectedApiKey) return;

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<any>('/search', {
        project_id: selectedProject.id,
        query: query,
        top_k: topK,
        retrieval_mode: retrievalMode,
        rerank: rerank
      });
      
      const data = response.data;
      const rawResults = Array.isArray(data) 
        ? data 
        : (data?.results || []);
        
      const flattenedResults: SearchResultChunk[] = rawResults.map((res: any) => ({
        chunk_id: res.chunk_id,
        chunk_text: res.chunk_text,
        document_id: res.metadata?.document_id || res.document_id,
        project_id: res.metadata?.project_id || res.project_id,
        page_number: res.metadata?.page_number !== undefined ? res.metadata.page_number : res.page_number,
        file_name: res.metadata?.file_name || res.file_name,
        file_type: res.metadata?.file_type || res.file_type,
        similarity_score: res.similarity_score,
        keyword_score: res.keyword_score,
        hybrid_score: res.hybrid_score,
        rerank_score: res.rerank_score,
        confidence_score: res.confidence_score,
        retrieval_source: res.retrieval_source
      }));

      setResults(flattenedResults);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || 'Search failed due to network error.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Demo fallback results if no documents loaded or active api key missing
  const demoResults: SearchResultChunk[] = [
    {
      chunk_id: 'chunk_1',
      project_id: selectedProject?.id || 'demo_proj',
      document_id: 'doc_1',
      chunk_text: 'Employees are entitled to 12 casual leaves, 15 sick leaves, and 10 annual leaves per calendar year. Casual leaves cannot be carried forward. Sick leaves can be accumulated up to 45 days.',
      page_number: 2,
      file_name: 'HR_Leave_Policy.pdf',
      similarity_score: 0.892,
      keyword_score: 0.745,
      hybrid_score: 0.818,
      rerank_score: 0.945,
      confidence_score: 0.92
    },
    {
      chunk_id: 'chunk_2',
      project_id: selectedProject?.id || 'demo_proj',
      document_id: 'doc_1',
      chunk_text: 'All leave requests must be submitted through the HR portal at least 2 days in advance for casual leave and 7 days in advance for annual leaves. Approval is subject to manager allocation constraints.',
      page_number: 3,
      file_name: 'HR_Leave_Policy.pdf',
      similarity_score: 0.812,
      keyword_score: 0.612,
      hybrid_score: 0.712,
      rerank_score: 0.854,
      confidence_score: 0.83
    }
  ];

  const displayResults = results.length > 0 ? results : (query.length > 0 ? demoResults : []);

  if (!selectedProject) {
    return (
      <Card className="text-center py-16 bg-white border-dashed border-2 border-slate-200 max-w-2xl mx-auto mt-12">
        <CardContent className="space-y-4">
          <div className="bg-amber-50 h-14 w-14 rounded-2xl flex items-center justify-center mx-auto border border-amber-100">
            <Search className="h-7 w-7 text-amber-500" />
          </div>
          <div className="max-w-xs mx-auto space-y-1.5">
            <h3 className="text-md font-bold text-slate-800">No project selected</h3>
            <p className="text-xs text-slate-500">Please select or create a project in the top bar to run search checks.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Search Playground - {selectedProject.name}</h2>
        <p className="text-sm text-slate-500">Query your vector database directly to inspect matching text chunks and relevance scores.</p>
      </div>

      {/* Warning if no key */}
      {!selectedApiKey && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 text-xs text-amber-800 shadow-2xs">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Showing Demo Search Results:</strong> You need an active API Key selected to query this project's index database. Visit the <strong>API Keys</strong> tab to create one.
          </div>
        </div>
      )}

      {/* Search Bar + Settings Form */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              required
              placeholder="Search index database... e.g. What is the leave policy?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-violet-600 text-slate-800 shadow-2xs"
            />
          </div>
          <Button type="submit" disabled={loading} className="px-6 gap-2 shrink-0 cursor-pointer">
            <Search className="h-4.5 w-4.5" />
            Search
          </Button>
        </div>

        {/* Search Parameter Options */}
        <Card className="bg-slate-50/50">
          <CardContent className="p-4 py-3 flex flex-wrap items-center gap-6 text-xs text-slate-600 font-semibold">
            <span className="flex items-center gap-1.5 text-slate-500">
              <SlidersHorizontal className="h-4 w-4" />
              Parameters:
            </span>

            {/* Retrieval mode */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Mode:</span>
              <select
                value={retrievalMode}
                onChange={(e: any) => setRetrievalMode(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg focus:outline-hidden text-slate-700 bg-white font-semibold"
              >
                <option value="semantic">Semantic</option>
                <option value="keyword">Keyword</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            {/* Top K */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Top K:</span>
              <input
                type="number"
                min={1}
                max={20}
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value))}
                className="w-16 px-2 py-0.5 border border-slate-200 rounded-lg focus:outline-hidden text-slate-700 bg-white font-semibold"
              />
            </div>

            {/* Rerank */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rerank-toggle"
                checked={rerank}
                onChange={(e) => setRerank(e.target.checked)}
                className="h-4 w-4 accent-violet-600 cursor-pointer"
              />
              <label htmlFor="rerank-toggle" className="select-none cursor-pointer">Rerank chunks</label>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Error alert */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-semibold">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-violet-600 mx-auto" />
          <span className="text-xs text-slate-400 mt-2 block font-medium">Scanning vectors...</span>
        </div>
      )}

      {/* Search results list */}
      {!loading && displayResults.length > 0 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Retrieved Segments ({displayResults.length})</h4>
          
          <div className="space-y-4">
            {displayResults.map((res, i) => (
              <Card key={i} className="border-slate-100 hover:border-violet-100 hover:shadow-xs transition-all">
                <CardHeader className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/20">
                  <div className="flex items-center gap-2 text-xs">
                    <BookOpen className="h-4 w-4 text-violet-500" />
                    <span className="font-semibold text-slate-800">{res.file_name || 'Document'}</span>
                    <span className="text-slate-400">Page {res.page_number || '1'}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-400">Chunk #{res.chunk_id?.split('_').pop() ?? ''}</span>
                  </div>

                  {/* Similarity scores badge list */}
                  <div className="flex flex-wrap gap-1.5 text-[9px] font-bold">
                    {res.similarity_score !== undefined && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-md">
                        Semantic: {res.similarity_score.toFixed(3)}
                      </span>
                    )}
                    {res.keyword_score !== undefined && (
                      <span className="bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-md">
                        Keyword: {res.keyword_score.toFixed(3)}
                      </span>
                    )}
                    {res.hybrid_score !== undefined && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-md">
                        Hybrid: {res.hybrid_score.toFixed(3)}
                      </span>
                    )}
                    {res.rerank_score !== undefined && (
                      <span className="bg-violet-50 text-violet-700 border border-violet-100 px-1.5 py-0.5 rounded-md">
                        Rerank: {res.rerank_score.toFixed(3)}
                      </span>
                    )}
                    {res.confidence_score !== undefined && (
                      <span className="bg-slate-100 text-slate-700 border border-slate-200/60 px-1.5 py-0.5 rounded-md">
                        Confidence: {res.confidence_score.toFixed(3)}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 py-3.5 text-xs text-slate-600 leading-relaxed font-mono whitespace-pre-wrap select-all">
                  {res.chunk_text}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
