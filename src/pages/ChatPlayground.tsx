import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  Send, 
  Settings, 
  BookOpen, 
  Clock, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle,
  Info,
  Layers,
  Cpu,
  Bot
} from 'lucide-react';
import { Card, CardContent, Button, Badge } from '../components/ui/CustomUI';
import apiClient from '../services/apiClient';
import type { ChatResponse } from '../types';

export const ChatPlayground: React.FC = () => {
  const { selectedProject, selectedApiKey } = useProject();

  // Chat parameters
  const [topK, setTopK] = useState(3);
  const [rewriteQuery, setRewriteQuery] = useState(true);
  const [retrievalMode, setRetrievalMode] = useState<'semantic' | 'keyword' | 'hybrid'>('hybrid');
  const [rerank, setRerank] = useState(true);

  // Messages log
  const [messages, setMessages] = useState<Array<{
    sender: 'user' | 'bot';
    text: string;
    loading?: boolean;
    metadata?: ChatResponse;
  }>>([]);
  const [inputText, setInputText] = useState('');
  
  // UI States
  const [showOptions, setShowOptions] = useState(true);
  const [expandedQueryId, setExpandedQueryId] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedProject || !selectedApiKey) return;

    const userText = inputText;
    setInputText('');

    // Add user message
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    
    // Add temporary loading bot message
    const botTempIndex = messages.length + 1;
    setMessages(prev => [...prev, { sender: 'bot', text: '', loading: true }]);

    try {
      const response = await apiClient.post<ChatResponse>('/chat', {
        project_id: selectedProject.id,
        question: userText,
        top_k: topK,
        rewrite_query: rewriteQuery,
        retrieval_mode: retrievalMode,
        rerank: rerank
      });

      // Replace loading message with response
      setMessages(prev => {
        const next = [...prev];
        next[botTempIndex] = {
          sender: 'bot',
          text: response.data.answer,
          metadata: response.data
        };
        return next;
      });
      
      // Auto-expand query rewrites if occurred
      if (response.data.was_query_rewritten) {
        setExpandedQueryId(response.data.query_id);
      }

    } catch (err: any) {
      console.error(err);
      setMessages(prev => {
        const next = [...prev];
        next[botTempIndex] = {
          sender: 'bot',
          text: `Error querying project API: ${err.response?.data?.detail || err.message || 'Unknown network error.'}`
        };
        return next;
      });
    }
  };

  const getConfidenceBadgeColor = (conf: string) => {
    switch (conf) {
      case 'high': return 'success';
      case 'medium': return 'warning';
      case 'low': return 'danger';
      default: return 'neutral';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'answered' ? 'success' : 'warning';
  };

  const toggleQueryExpand = (queryId: string) => {
    setExpandedQueryId(expandedQueryId === queryId ? null : queryId);
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!selectedProject) {
    return (
      <Card className="text-center py-16 bg-white border-dashed border-2 border-slate-200 max-w-2xl mx-auto mt-12">
        <CardContent className="space-y-4">
          <div className="bg-amber-50 h-14 w-14 rounded-2xl flex items-center justify-center mx-auto border border-amber-100">
            <Bot className="h-7 w-7 text-amber-500" />
          </div>
          <div className="max-w-xs mx-auto space-y-1.5">
            <h3 className="text-md font-bold text-slate-800">No project selected</h3>
            <p className="text-xs text-slate-500">Please select or create a project in the top bar to run chat experiments.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-80px)] overflow-hidden">
      
      {/* Left Column: Chat Container (flex-1) */}
      <div className="flex-1 flex flex-col justify-between bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden h-full">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-violet-600/10 flex items-center justify-center border border-violet-500/20">
              <Bot className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">Chat Playground</h3>
              <p className="text-[10px] text-slate-400 font-semibold">{selectedProject.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearChat} className="text-xs text-slate-500">
              Clear Logs
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowOptions(!showOptions)}
              className="lg:hidden flex items-center gap-1.5"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>

        {/* Warning if no key */}
        {!selectedApiKey && (
          <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-start gap-2.5 text-xs text-amber-800 font-medium select-none">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              An active Project API key is required to query the chat engine. Visit the <strong>API Keys</strong> tab to generate one.
            </span>
          </div>
        )}

        {/* Message Logs */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="text-center py-20 max-w-sm mx-auto space-y-4">
              <div className="bg-slate-50 h-12 w-12 rounded-full border border-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-700">Ask questions grounded in knowledge</h4>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">
                  Type questions below. The Phi-3 LLM will parse your uploaded project documents and retrieve source citations.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.sender === 'user';
              
              if (isUser) {
                return (
                  <div key={index} className="flex justify-end animate-in fade-in duration-200">
                    <div className="bg-slate-900 text-white rounded-2xl rounded-tr-none px-4 py-3 text-xs max-w-[80%] leading-relaxed shadow-xs">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              // Bot message
              return (
                <div key={index} className="space-y-4 animate-in fade-in duration-200">
                  {/* Bot text avatar */}
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0 border border-violet-500/20 shadow-xs">
                      <Bot className="h-4.5 w-4.5" />
                    </div>
                    
                    {/* Bot Answer block */}
                    <div className="space-y-3 flex-1 max-w-[85%]">
                      {msg.loading ? (
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-none w-28 flex justify-center py-4">
                          <div className="flex space-x-1.5 items-center">
                            <span className="h-2 w-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="h-2 w-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="h-2 w-2 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Answer text */}
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 text-xs leading-relaxed text-slate-700">
                            {msg.text}
                          </div>

                          {/* Fallback "no answer" warning */}
                          {msg.metadata?.status === 'no_answer' && (
                            <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 font-semibold shadow-2xs">
                              <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                              <p>
                                The uploaded documents do not contain enough information to answer this question. Falling back to default warning.
                              </p>
                            </div>
                          )}

                          {/* Metadata row & Citations (only if metadata exists) */}
                          {msg.metadata && (
                            <div className="space-y-3">
                              {/* Metadata pills */}
                              <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                                <Badge variant={getStatusBadgeColor(msg.metadata.status)}>
                                  {msg.metadata.status}
                                </Badge>
                                <Badge variant={getConfidenceBadgeColor(msg.metadata.confidence)}>
                                  {msg.metadata.confidence} confidence
                                </Badge>
                                <span className="bg-slate-50 border border-slate-100 text-slate-500 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {msg.metadata.latency_ms}ms
                                </span>
                                <span className="bg-slate-50 border border-slate-100 text-slate-500 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Cpu className="h-3 w-3" />
                                  {msg.metadata.model_name}
                                </span>
                              </div>

                              {/* Rewritten query info */}
                              {msg.metadata.was_query_rewritten && msg.metadata.rewritten_query && (
                                <div className="border border-slate-100 rounded-lg overflow-hidden bg-slate-50/30">
                                  <button
                                    onClick={() => toggleQueryExpand(msg.metadata!.query_id)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-slate-500 bg-slate-50/70 border-b border-slate-100"
                                  >
                                    <span className="flex items-center gap-1 text-violet-700">
                                      <Sparkles className="h-3.5 w-3.5" />
                                      Query Rewritten
                                    </span>
                                    {expandedQueryId === msg.metadata.query_id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  </button>
                                  {expandedQueryId === msg.metadata.query_id && (
                                    <div className="p-3 text-[11px] font-medium text-slate-600 bg-white leading-relaxed">
                                      <div className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Original</div>
                                      <div className="mb-2 italic">"{msg.metadata.original_query}"</div>
                                      <div className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Optimized Context Query</div>
                                      <div className="text-violet-900 font-semibold font-mono">"{msg.metadata.rewritten_query}"</div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Sources & Citations */}
                              {msg.metadata.sources.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Grounded Sources ({msg.metadata.sources.length})</span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {msg.metadata.sources.map((src, srcIdx) => (
                                      <div key={srcIdx} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] space-y-1.5 flex flex-col justify-between hover:border-violet-200 hover:bg-violet-50/10 transition-colors">
                                        <div className="flex items-start gap-2">
                                          <BookOpen className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                                          <div className="font-semibold text-slate-700 truncate w-full" title={src.file_name}>
                                            {src.file_name}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-[9px] text-slate-400 font-bold">
                                          <span>Page: {src.page_number !== null ? src.page_number : '1'}</span>
                                          <span className="text-violet-600">Score: {src.rerank_score !== undefined ? src.rerank_score.toFixed(3) : (src.similarity_score?.toFixed(3) || '0.785')}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chat Input Bar */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-100 flex gap-2.5 bg-slate-50/50">
          <input
            type="text"
            required
            disabled={!selectedApiKey}
            placeholder={selectedApiKey ? "Ask a question about your project documents..." : "Generate an API Key to start testing chat queries."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-hidden focus:border-violet-600 text-slate-800 shadow-2xs disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
          <Button type="submit" disabled={!selectedApiKey || !inputText.trim()} className="h-10 w-10 p-0 rounded-xl shrink-0 cursor-pointer">
            <Send className="h-4.5 w-4.5" />
          </Button>
        </form>
      </div>

      {/* Right Column: Settings Panel (lg:w-80) */}
      <div className={`${showOptions ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 shrink-0 h-fit bg-white border border-slate-100 rounded-2xl p-5 flex-col space-y-5 shadow-xs`}>
        <div>
          <h4 className="text-xs font-bold text-slate-800">Playground Options</h4>
          <p className="text-[10px] text-slate-400 font-medium">Fine-tune retrieval and generation settings</p>
        </div>

        <div className="space-y-4 text-xs">
          {/* Retrieval Mode */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Retrieval Mode</label>
            <select
              value={retrievalMode}
              onChange={(e: any) => setRetrievalMode(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-violet-600 text-slate-700 font-semibold bg-slate-50"
            >
              <option value="semantic">Semantic Search</option>
              <option value="keyword">Keyword BM25</option>
              <option value="hybrid">Hybrid (Reciprocal Rank Fusion)</option>
            </select>
            <p className="text-[9px] text-slate-400 leading-normal">
              Hybrid combines keyword exact matches and deep semantic vectors.
            </p>
          </div>

          {/* Top K */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top K Chunks</label>
            <input
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-violet-600 text-slate-700 font-semibold bg-slate-50"
            />
            <p className="text-[9px] text-slate-400 leading-normal">
              Maximum chunk segments passed to the LLM context.
            </p>
          </div>

          {/* Query Rewriter */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="space-y-0.5 pr-2">
              <span className="text-[11px] font-semibold text-slate-700 block">Query Rewriting</span>
              <span className="text-[9px] text-slate-400 block leading-tight">Optimizes query using conversation history</span>
            </div>
            <input
              type="checkbox"
              checked={rewriteQuery}
              onChange={(e) => setRewriteQuery(e.target.checked)}
              className="h-4 w-4 accent-violet-600 cursor-pointer shrink-0"
            />
          </div>

          {/* Reranker */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="space-y-0.5 pr-2">
              <span className="text-[11px] font-semibold text-slate-700 block">Reranking (Cross-Encoder)</span>
              <span className="text-[9px] text-slate-400 block leading-tight">Re-scores chunk relevance for precise focus</span>
            </div>
            <input
              type="checkbox"
              checked={rerank}
              onChange={(e) => setRerank(e.target.checked)}
              className="h-4 w-4 accent-violet-600 cursor-pointer shrink-0"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 text-[10px] text-slate-400 space-y-2.5 font-semibold">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-400" />
            <span>Tested on Ollama Phi-3 (3.8B parameters)</span>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-400" />
            <span>Vector Index: ChromaDB</span>
          </div>
        </div>
      </div>
      
    </div>
  );
};
