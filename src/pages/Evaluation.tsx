import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  CheckSquare, 
  Plus, 
  Play, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Info
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  Button, 
  Dialog,
  Badge
} from '../components/ui/CustomUI';
import apiClient from '../services/apiClient';
import type { EvaluationTestCase, EvaluationRun } from '../types';

export const Evaluation: React.FC = () => {
  const { selectedProject, selectedApiKey } = useProject();

  const [testCases, setTestCases] = useState<EvaluationTestCase[]>([]);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  
  // Create test case modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [keywords, setKeywords] = useState('');
  const [sourceFile, setSourceFile] = useState('');
  const [shouldAnswer, setShouldAnswer] = useState(true);
  const [topK, setTopK] = useState(3);
  const [rewriteQuery, setRewriteQuery] = useState(true);
  const [retrievalMode, setRetrievalMode] = useState<'semantic' | 'keyword' | 'hybrid'>('hybrid');
  const [rerank, setRerank] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSubmittingCase, setIsSubmittingCase] = useState(false);

  // Run Evaluation State
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [latestRun, setLatestRun] = useState<EvaluationRun | null>(null);

  // Fetch test cases and runs
  const fetchEvaluationData = async () => {
    if (!selectedProject || !selectedApiKey) return;
    setLoadingCases(true);
    try {
      const casesRes = await apiClient.get<EvaluationTestCase[]>(`/evaluations/${selectedProject.id}/test-cases`);
      setTestCases(casesRes.data);

      const runsRes = await apiClient.get<EvaluationRun[]>(`/evaluations/${selectedProject.id}/runs`);
      setRuns(runsRes.data);
      if (runsRes.data.length > 0) {
        setLatestRun(runsRes.data[0]); // Default to show latest
      }
    } catch (e) {
      console.error('Error fetching evaluations:', e);
    } finally {
      setLoadingCases(false);
    }
  };

  useEffect(() => {
    fetchEvaluationData();
  }, [selectedProject, selectedApiKey]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !question.trim()) return;
    setIsSubmittingCase(true);
    try {
      const keywordsArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
      await apiClient.post(`/evaluations/${selectedProject.id}/test-cases`, {
        question,
        expected_answer_keywords: keywordsArray,
        expected_source_file: sourceFile.trim() || null,
        expected_should_answer: shouldAnswer,
        top_k: topK,
        rewrite_query: rewriteQuery,
        retrieval_mode: retrievalMode,
        rerank,
        notes: notes.trim() || null
      });
      setIsCreateOpen(false);
      
      // Reset form
      setQuestion('');
      setKeywords('');
      setSourceFile('');
      setShouldAnswer(true);
      setTopK(3);
      setRewriteQuery(true);
      setRetrievalMode('hybrid');
      setRerank(true);
      setNotes('');

      fetchEvaluationData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingCase(false);
    }
  };

  const handleRunEvaluation = async () => {
    if (!selectedProject) return;
    setIsRunningEval(true);
    try {
      // Run evaluation for all test cases
      const res = await apiClient.post<EvaluationRun>(`/evaluations/${selectedProject.id}/run`, {
        test_case_ids: null // Null runs all test cases
      });
      setLatestRun(res.data);
      fetchEvaluationData();
    } catch (err) {
      console.error('Evaluation run failed:', err);
    } finally {
      setIsRunningEval(false);
    }
  };

  // Demo fallback run details if no runs completed
  const demoRun: EvaluationRun = {
    id: 'run_demo_123',
    project_id: selectedProject?.id || 'demo_id',
    run_at: new Date().toISOString(),
    total_cases: 3,
    passed_cases: 2,
    failed_cases: 1,
    pass_rate: 66.7,
    average_latency_ms: 2240,
    average_keyword_match_score: 83.3,
    source_match_count: 2,
    results: [
      {
        test_case_id: 'tc_1',
        question: 'What is the leave policy?',
        generated_answer: 'Employees are entitled to 12 casual leaves, 15 sick leaves, and 10 annual leaves per calendar year.',
        expected_keywords: ['casual', 'sick', 'annual'],
        matched_keywords: ['casual', 'sick', 'annual'],
        missing_keywords: [],
        expected_source_file: 'Leave_Policy.pdf',
        matched_source_file: 'Leave_Policy.pdf',
        passed: true,
        failure_reasons: [],
        latency_ms: 2150,
        confidence: 'high'
      },
      {
        test_case_id: 'tc_2',
        question: 'What is the password complexity requirement?',
        generated_answer: 'Passwords must contain at least 8 characters, including upper case, numbers and special symbols.',
        expected_keywords: ['8 characters', 'upper case', 'special symbols'],
        matched_keywords: ['8 characters', 'upper case'],
        missing_keywords: ['special symbols'],
        expected_source_file: 'IT_Security_Policy.pdf',
        matched_source_file: 'IT_Security_Policy.pdf',
        passed: false,
        failure_reasons: ['Missing expected keywords: special symbols'],
        latency_ms: 2540,
        confidence: 'medium'
      },
      {
        test_case_id: 'tc_3',
        question: 'How do I claim medical insurance reimbursement?',
        generated_answer: 'Claims should be submitted online via the MediCare insurer portal within 30 days of hospital discharge.',
        expected_keywords: ['insurer portal', '30 days'],
        matched_keywords: ['insurer portal', '30 days'],
        missing_keywords: [],
        expected_source_file: 'Benefits_Guide.pdf',
        matched_source_file: 'Benefits_Guide.pdf',
        passed: true,
        failure_reasons: [],
        latency_ms: 2030,
        confidence: 'high'
      }
    ]
  };

  const normalizeRun = (run: any) => {
    if (!run) return null;
    return {
      id: run.id,
      project_id: run.project_id,
      run_at: run.run_at || run.created_at,
      total_cases: run.total_cases ?? 0,
      passed_cases: run.passed_cases ?? 0,
      failed_cases: run.failed_cases ?? 0,
      pass_rate: run.pass_rate !== undefined ? run.pass_rate : (run.pass_rate_percentage !== undefined ? run.pass_rate_percentage : 0),
      average_latency_ms: run.average_latency_ms ?? 0,
      average_keyword_match_score: run.average_keyword_match_score !== undefined 
        ? (run.average_keyword_match_score > 1.0 ? run.average_keyword_match_score : run.average_keyword_match_score * 100) 
        : 0,
      source_match_count: run.source_match_count ?? 0,
      results: (run.results || []).map((r: any) => ({
        test_case_id: r.test_case_id,
        question: r.question,
        generated_answer: r.generated_answer,
        expected_keywords: r.expected_keywords || r.expected_answer_keywords || [],
        matched_keywords: r.matched_keywords || [],
        missing_keywords: r.missing_keywords || [],
        expected_source_file: r.expected_source_file,
        matched_source_file: r.matched_source_file,
        passed: r.passed,
        failure_reasons: r.failure_reasons || [],
        latency_ms: r.latency_ms ?? 0,
        confidence: r.confidence || 'medium'
      }))
    };
  };

  const currentRun = normalizeRun(latestRun || (runs.length > 0 ? runs[0] : null)) || (testCases.length > 0 ? demoRun : null);

  if (!selectedProject) {
    return (
      <Card className="text-center py-16 bg-white border-dashed border-2 border-slate-200 max-w-2xl mx-auto mt-12">
        <CardContent className="space-y-4">
          <div className="bg-amber-50 h-14 w-14 rounded-2xl flex items-center justify-center mx-auto border border-amber-100">
            <CheckSquare className="h-7 w-7 text-amber-500" />
          </div>
          <div className="max-w-xs mx-auto space-y-1.5">
            <h3 className="text-md font-bold text-slate-800">No project selected</h3>
            <p className="text-xs text-slate-500">Please select or create a project in the top bar to view RAG evaluations.</p>
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
          <h2 className="text-2xl font-bold text-slate-800">Evaluation Metrics - {selectedProject.name}</h2>
          <p className="text-sm text-slate-500">Benchmark your RAG answer quality, keyword match rates, and source accuracy.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4.5 w-4.5" />
            Add Test Case
          </Button>
          <Button 
            onClick={handleRunEvaluation} 
            disabled={testCases.length === 0 && !selectedApiKey}
            isLoading={isRunningEval}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Run Evaluation Suite
          </Button>
        </div>
      </div>

      {/* Warning if no key */}
      {!selectedApiKey && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 text-xs text-amber-800 shadow-2xs">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Showing Demo Run Results:</strong> Add and select an API Key for this project to create test cases and run live benchmark assessments.
          </div>
        </div>
      )}

      {/* Grid: 2 Columns. Left (Test cases list), Right (Evaluation Run Results) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Test Cases List (col-span-1) */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Test Cases</CardTitle>
              <CardDescription>Benchmark queries set ({testCases.length})</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingCases && selectedApiKey ? (
                <div className="text-center py-12 text-xs text-slate-400">Loading cases...</div>
              ) : testCases.length === 0 && !selectedApiKey ? (
                // Render demo test cases if no active api key
                <div className="divide-y divide-slate-50">
                  <div className="p-4 space-y-1.5">
                    <div className="text-xs font-semibold text-slate-800">1. What is the leave policy?</div>
                    <div className="text-[10px] text-slate-400 font-semibold">Keywords: casual, sick, annual</div>
                  </div>
                  <div className="p-4 space-y-1.5">
                    <div className="text-xs font-semibold text-slate-800">2. What is the password complexity requirement?</div>
                    <div className="text-[10px] text-slate-400 font-semibold">Keywords: 8 characters, upper case</div>
                  </div>
                </div>
              ) : testCases.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 p-4">
                  No evaluation test cases defined yet. Click "Add Test Case" to create one.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto custom-scrollbar">
                  {testCases.map((tc) => (
                    <div key={tc.id} className="p-4 hover:bg-slate-50/50 transition-colors space-y-1">
                      <div className="text-xs font-semibold text-slate-800">{tc.question}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tc.expected_answer_keywords.map((kw, i) => (
                          <span key={i} className="text-[9px] bg-slate-100 border border-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded-sm font-semibold">
                            {kw}
                          </span>
                        ))}
                      </div>
                      {tc.expected_source_file && (
                        <div className="text-[9px] text-violet-600 font-medium pt-1">
                          Source File: {tc.expected_source_file}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Run Results breakdown (col-span-2) */}
        <div className="xl:col-span-2 space-y-6">
          {currentRun ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pass Rate</span>
                    <h4 className="text-xl font-bold text-violet-600">{currentRun.pass_rate}%</h4>
                    <span className="text-[9px] text-slate-400 font-semibold">{currentRun.passed_cases} / {currentRun.total_cases} passed</span>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keyword Match</span>
                    <h4 className="text-xl font-bold text-emerald-600">{currentRun.average_keyword_match_score.toFixed(1)}%</h4>
                    <span className="text-[9px] text-slate-400 font-semibold">Average matching score</span>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source Grounding</span>
                    <h4 className="text-xl font-bold text-blue-600">
                      {Math.round((currentRun.source_match_count / currentRun.total_cases) * 100)}%
                    </h4>
                    <span className="text-[9px] text-slate-400 font-semibold">{currentRun.source_match_count} source files matched</span>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Latency</span>
                    <h4 className="text-xl font-bold text-slate-800">{(currentRun.average_latency_ms / 1000).toFixed(2)}s</h4>
                    <span className="text-[9px] text-slate-400 font-semibold">Response duration</span>
                  </CardContent>
                </Card>
              </div>

              {/* Case Results breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Test Run Report</CardTitle>
                  <CardDescription>Grounding verification details per question</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentRun.results.map((res: any, i: number) => (
                    <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50/30">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Test Case #{i+1}</span>
                          <h5 className="text-xs font-bold text-slate-800 leading-tight">{res.question}</h5>
                        </div>
                        <Badge variant={res.passed ? 'success' : 'danger'} className="gap-1">
                          {res.passed ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {res.passed ? 'Passed' : 'Failed'}
                        </Badge>
                      </div>

                      {/* Generated answer */}
                      <div className="p-3 bg-white border border-slate-100 rounded-lg text-xs leading-relaxed text-slate-600">
                        <strong className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Generated Answer</strong>
                        {res.generated_answer}
                      </div>

                      {/* Keywords & Sources row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {/* Keywords match */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Keywords Matching</span>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {res.matched_keywords.map((kw: string, idx: number) => (
                              <span key={idx} className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-sm font-semibold text-[9px]">
                                ✓ {kw}
                              </span>
                            ))}
                            {res.missing_keywords.map((kw: string, idx: number) => (
                              <span key={idx} className="bg-rose-50 border border-rose-100 text-rose-800 px-1.5 py-0.5 rounded-sm font-semibold text-[9px]">
                                ✗ {kw}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Source match */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Grounded Source Verification</span>
                          <div className="pt-1.5 space-y-1 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Expected File:</span>
                              <span className="font-semibold text-slate-700">{res.expected_source_file || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Matched File:</span>
                              <span className={`font-semibold ${res.expected_source_file === res.matched_source_file ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {res.matched_source_file || 'None'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Fail reasons if failed */}
                      {!res.passed && res.failure_reasons.length > 0 && (
                        <div className="text-[10px] text-rose-600 font-bold border-t border-rose-100/50 pt-2 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Failure reason: {res.failure_reasons.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="text-center py-16">
              <CardContent className="space-y-3">
                <CheckSquare className="h-10 w-10 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">No evaluations run yet</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Click "Run Evaluation Suite" to run the test queries against your documents and review output accuracy metrics.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Test Case Modal */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Evaluation Test Case"
        description="Define a reference query and expected groundings to test your RAG system's response quality."
      >
        <form onSubmit={handleCreateCase} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1.5 custom-scrollbar">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Test Question
            </label>
            <input
              type="text"
              required
              minLength={3}
              placeholder="e.g. What is the casual leave policy?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-violet-600 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Expected Keywords (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. casual, annual, 12 days"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-violet-600 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Expected Source File (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Leave_Policy.pdf"
              value={sourceFile}
              onChange={(e) => setSourceFile(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-violet-600 text-slate-800"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-700">Expected to Answer (Not fallback)</span>
            <input
              type="checkbox"
              checked={shouldAnswer}
              onChange={(e) => setShouldAnswer(e.target.checked)}
              className="h-4.5 w-4.5 accent-violet-600 cursor-pointer"
            />
          </div>

          {/* Advanced Toggles Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs border-t border-slate-100 pt-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Retrieval Mode</label>
              <select
                value={retrievalMode}
                onChange={(e: any) => setRetrievalMode(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden text-slate-700 font-semibold"
              >
                <option value="semantic">Semantic</option>
                <option value="keyword">Keyword</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Top K</label>
              <input
                type="number"
                min={1}
                max={20}
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value))}
                className="w-full px-2 py-1 border border-slate-200 rounded-lg focus:outline-hidden text-slate-700 font-semibold"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rewrite"
                checked={rewriteQuery}
                onChange={(e) => setRewriteQuery(e.target.checked)}
                className="accent-violet-600"
              />
              <label htmlFor="rewrite" className="font-semibold text-slate-600 select-none">Rewrite query</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rerank-check"
                checked={rerank}
                onChange={(e) => setRerank(e.target.checked)}
                className="accent-violet-600"
              />
              <label htmlFor="rerank-check" className="font-semibold text-slate-600 select-none">Enable reranking</label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Verifies leave balances retrieval"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-violet-600 text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingCase}>
              Create Test Case
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
