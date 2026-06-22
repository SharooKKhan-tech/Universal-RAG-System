export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface ApiKey {
  id: string;
  project_id: string;
  name: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  text_path: string | null;
  status: 'uploaded' | 'queued' | 'processing' | 'text_extracted' | 'chunking' | 'chunked' | 'indexing' | 'indexed' | 'failed';
  error_message: string | null;
  created_at: string;
  chunks_count?: number;
}

export interface Chunk {
  id: string;
  project_id: string;
  document_id: string;
  chunk_text: string;
  chunk_index: number;
  page_number: number | null;
  created_at: string;
}

export interface SearchRequest {
  project_id: string;
  query: string;
  top_k: number;
  retrieval_mode: 'semantic' | 'keyword' | 'hybrid';
  rerank: boolean;
}

export interface SearchResultChunk {
  chunk_id: string;
  chunk_text: string;
  document_id: string;
  project_id: string;
  page_number: number | null;
  file_name?: string;
  file_type?: string;
  similarity_score?: number;
  keyword_score?: number;
  hybrid_score?: number;
  rerank_score?: number;
  confidence_score?: number;
  retrieval_source?: string;
}

export interface SearchResponse {
  query: string;
  project_id: string;
  top_k: number;
  candidate_top_k?: number;
  retrieval_mode: 'semantic' | 'keyword' | 'hybrid';
  rerank: boolean;
  results: SearchResultChunk[];
}

export interface ChatRequest {
  project_id: string;
  question: string;
  top_k: number;
  rewrite_query: boolean;
  retrieval_mode: 'semantic' | 'keyword' | 'hybrid';
  rerank: boolean;
}

export interface Source {
  file_name: string;
  page_number: number | null;
  chunk_index: number;
  similarity_score?: number;
  keyword_score?: number;
  semantic_score?: number;
  hybrid_score?: number;
  rerank_score?: number;
}

export interface ChatResponse {
  answer: string;
  status: 'answered' | 'no_answer';
  confidence: 'high' | 'medium' | 'low';
  top_similarity_score: number;
  original_query: string;
  rewritten_query: string | null;
  was_query_rewritten: boolean;
  retrieval_mode: 'semantic' | 'keyword' | 'hybrid';
  rerank: boolean;
  sources: Source[];
  latency_ms: number;
  model_name: string;
  query_id: string;
}

export interface QueryRecord {
  id: string;
  project_id: string;
  question: string;
  answer: string;
  status: string;
  latency_ms: number;
  created_at: string;
}

export interface AnalyticsSummary {
  total_queries: number;
  answered_queries: number;
  no_answer_queries: number;
  answer_rate: number;
  average_latency_ms: number;
  average_sources: number;
  model_distribution: Record<string, number>;
}

export interface DocumentUsage {
  document_id: string;
  file_name: string;
  query_count: number;
  percentage: number;
}

export interface EvaluationTestCase {
  id: string;
  project_id: string;
  question: string;
  expected_answer_keywords: string[];
  expected_source_file: string | null;
  expected_should_answer: boolean;
  top_k: number;
  rewrite_query: boolean;
  retrieval_mode: 'semantic' | 'keyword' | 'hybrid';
  rerank: boolean;
  notes: string | null;
  created_at: string;
}

export interface EvaluationResultCase {
  test_case_id: string;
  question: string;
  generated_answer: string;
  expected_keywords: string[];
  matched_keywords: string[];
  missing_keywords: string[];
  expected_source_file: string | null;
  matched_source_file: string | null;
  passed: boolean;
  failure_reasons: string[];
  latency_ms: number;
  confidence: string;
}

export interface EvaluationRun {
  id: string;
  project_id: string;
  run_at: string;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  pass_rate: number;
  average_latency_ms: number;
  average_keyword_match_score: number;
  source_match_count: number;
  results: EvaluationResultCase[];
}
