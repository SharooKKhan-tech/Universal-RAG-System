import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Terminal, 
  ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from '../components/ui/CustomUI';

export const ApiDocs: React.FC = () => {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const copyText = (text: string, path: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const endpoints = [
    {
      group: 'Projects',
      items: [
        {
          method: 'POST',
          path: '/projects',
          description: 'Create a new isolated RAG project',
          auth: 'None',
          body: `{
  "name": "Medicare Helpdesk",
  "description": "Customer support assistant for health insurance documents"
}`,
          response: `{
  "id": "proj_9m2a8k7b1c",
  "name": "Medicare Helpdesk",
  "description": "Customer support assistant for health insurance documents",
  "created_at": "2026-06-16T18:00:00Z"
}`
        },
        {
          method: 'GET',
          path: '/projects',
          description: 'List all RAG projects (Platform Admin view)',
          auth: 'None',
          response: `[
  {
    "id": "proj_9m2a8k7b1c",
    "name": "Medicare Helpdesk",
    "description": "Customer support assistant for health insurance documents",
    "created_at": "2026-06-16T18:00:00Z"
  }
]`
        },
        {
          method: 'DELETE',
          path: '/projects/{project_id}',
          description: 'Delete project and all associated document indexes',
          auth: 'X-API-Key',
          response: `{
  "message": "Project deleted completely",
  "project_id": "proj_9m2a8k7b1c"
}`
        }
      ]
    },
    {
      group: 'API Keys',
      items: [
        {
          method: 'POST',
          path: '/projects/{project_id}/api-keys',
          description: 'Generate a new API key for project authorization',
          auth: 'None',
          body: `{
  "name": "production-key"
}`,
          response: `{
  "id": "key_2n8b3c4d",
  "project_id": "proj_9m2a8k7b1c",
  "name": "production-key",
  "api_key": "rag_sk_live_2n8b3c4d9m...",
  "is_active": true,
  "created_at": "2026-06-16T18:05:00Z"
}`
        },
        {
          method: 'GET',
          path: '/projects/{project_id}/api-keys',
          description: 'List all generated API keys for a project',
          auth: 'None',
          response: `[
  {
    "id": "key_2n8b3c4d",
    "project_id": "proj_9m2a8k7b1c",
    "name": "production-key",
    "api_key": "rag_sk_live_2n8b3c4d9m...",
    "is_active": true,
    "created_at": "2026-06-16T18:05:00Z"
  }
]`
        }
      ]
    },
    {
      group: 'Documents',
      items: [
        {
          method: 'POST',
          path: '/documents/upload-and-index',
          description: 'Upload a document (PDF or TXT) and immediately trigger indexing pipeline',
          auth: 'X-API-Key',
          bodyFormat: 'FormData',
          body: `project_id: "proj_9m2a8k7b1c"\nfile: [Binary File]`,
          response: `{
  "document_id": "doc_5b2d8a",
  "file_name": "Leave_Policy.pdf",
  "status": "indexed",
  "chunks_indexed": 32,
  "created_at": "2026-06-16T18:10:00Z"
}`
        },
        {
          method: 'GET',
          path: '/documents/{project_id}',
          description: 'List all uploaded documents and their ingestion pipeline statuses',
          auth: 'X-API-Key',
          response: `[
  {
    "id": "doc_5b2d8a",
    "project_id": "proj_9m2a8k7b1c",
    "file_name": "Leave_Policy.pdf",
    "file_type": "pdf",
    "status": "indexed",
    "error_message": null,
    "created_at": "2026-06-16T18:10:00Z"
  }
]`
        }
      ]
    },
    {
      group: 'Query & Chat',
      items: [
        {
          method: 'POST',
          path: '/chat',
          description: 'Perform a grounded Q&A query against project documents',
          auth: 'X-API-Key',
          body: `{
  "project_id": "proj_9m2a8k7b1c",
  "question": "What is the casual leave policy?",
  "top_k": 3,
  "rewrite_query": true,
  "retrieval_mode": "hybrid",
  "rerank": true
}`,
          response: `{
  "answer": "According to the leave policy document, employees are entitled to 12 casual leaves per year.",
  "status": "answered",
  "confidence": "high",
  "top_similarity_score": 0.895,
  "original_query": "What is the casual leave policy?",
  "rewritten_query": "casual leave allowances details",
  "was_query_rewritten": true,
  "retrieval_mode": "hybrid",
  "rerank": true,
  "sources": [
    {
      "file_name": "Leave_Policy.pdf",
      "page_number": 2,
      "chunk_index": 0,
      "rerank_score": 0.945
    }
  ],
  "latency_ms: 1820,
  "model_name": "phi3:mini",
  "query_id": "q_7a2b9c"
}`
        },
        {
          method: 'POST',
          path: '/search',
          description: 'Perform vector search only to retrieve relevant text chunks',
          auth: 'X-API-Key',
          body: `{
  "project_id": "proj_9m2a8k7b1c",
  "query": "password rules",
  "top_k": 2,
  "retrieval_mode": "hybrid",
  "rerank": true
}`,
          response: `[
  {
    "chunk": {
      "id": "chunk_92a",
      "project_id": "proj_9m2a8k7b1c",
      "document_id": "doc_23",
      "chunk_text": "Passwords must be updated every 90 days and contain at least 8 characters.",
      "page_number": 5
    },
    "similarity_score": 0.842,
    "rerank_score": 0.912
  }
]`
        }
      ]
    }
  ];

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-emerald-50 text-emerald-800 border-emerald-100';
      case 'POST': return 'bg-blue-50 text-blue-800 border-blue-100';
      case 'DELETE': return 'bg-rose-50 text-rose-800 border-rose-100';
      default: return 'bg-slate-50 text-slate-800';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">API Documentation</h2>
        <p className="text-sm text-slate-500">Integrate the Universal RAG System endpoints directly into your codebase.</p>
      </div>

      {/* Global details card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-md">
            <Terminal className="h-5 w-5 text-violet-600" />
            Global Connection Parameters
          </CardTitle>
          <CardDescription>All endpoint queries must be directed to these base settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs font-semibold">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Base URL</span>
              <code className="text-slate-800 font-mono text-xs select-all">http://127.0.0.1:8000/api/v1</code>
            </div>
            <div className="flex-1 p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Authentication Header</span>
              <code className="text-slate-800 font-mono text-xs select-all">X-API-Key: &lt;your_project_api_key&gt;</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Group listings */}
      <div className="space-y-8">
        {endpoints.map((group) => (
          <div key={group.group} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest pl-1">{group.group}</h3>
            
            <div className="space-y-5">
              {group.items.map((ep) => {
                const uniqueId = `${ep.method}-${ep.path}`;
                
                return (
                  <Card key={uniqueId} className="overflow-hidden hover:shadow-xs border-slate-200/60 transition-shadow">
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-extrabold border ${getMethodBadgeColor(ep.method)}`}>
                          {ep.method}
                        </span>
                        <code className="font-mono text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          {ep.path}
                        </code>
                        <span className="text-slate-500 text-xs font-medium">{ep.description}</span>
                      </div>
                      
                      {/* Auth requirement */}
                      <div>
                        {ep.auth !== 'None' ? (
                          <Badge variant="warning" className="gap-1 text-[10px] font-bold uppercase">
                            <ShieldAlert className="h-3 w-3" />
                            Requires Key
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[10px] font-bold uppercase">Public</Badge>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <CardContent className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
                      {/* Left: Request properties */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                          <span>Request {(ep as any).bodyFormat === 'FormData' ? 'Form Data' : 'JSON Body'}</span>
                          {ep.body && (
                            <button
                              onClick={() => copyText(ep.body, `${uniqueId}-req`)}
                              className="text-violet-600 hover:underline flex items-center gap-1.5 uppercase cursor-pointer"
                            >
                              {copiedPath === `${uniqueId}-req` ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                              Copy
                            </button>
                          )}
                        </div>
                        {ep.body ? (
                          <pre className="bg-slate-900 text-slate-300 font-mono text-[10px] p-3.5 rounded-xl border border-slate-800 leading-relaxed overflow-x-auto max-h-56">
                            {ep.body}
                          </pre>
                        ) : (
                          <div className="h-28 flex items-center justify-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs select-none bg-slate-50/20">
                            No request body parameters
                          </div>
                        )}
                      </div>

                      {/* Right: Response properties */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                          <span>Response JSON</span>
                          <button
                            onClick={() => copyText(ep.response, `${uniqueId}-res`)}
                            className="text-violet-600 hover:underline flex items-center gap-1.5 uppercase cursor-pointer"
                          >
                            {copiedPath === `${uniqueId}-res` ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                            Copy
                          </button>
                        </div>
                        <pre className="bg-slate-900 text-slate-300 font-mono text-[10px] p-3.5 rounded-xl border border-slate-800 leading-relaxed overflow-x-auto max-h-56">
                          {ep.response}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
