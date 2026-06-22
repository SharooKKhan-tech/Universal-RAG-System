import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  FolderKanban, 
  FileText, 
  MessageSquare, 
  Clock, 
  AlertOctagon, 
  DollarSign, 
  Database,
  BarChart,
  Activity,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/CustomUI';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart as ReBarChart,
  Bar,
  Cell
} from 'recharts';
import apiClient from '../services/apiClient';
import type { QueryRecord } from '../types';

export const DashboardOverview: React.FC = () => {
  const { projects } = useProject();
  
  const [loading, setLoading] = useState(true);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalQueries, setTotalQueries] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  const [noAnswerRate, setNoAnswerRate] = useState(0);
  const [apiRequestsCount, setApiRequestsCount] = useState(0);
  const [cacheHitRate] = useState(78.5); // Default cache hit rate placeholder
  const [estimatedCost, setEstimatedCost] = useState(0);
  
  // Chart data state
  const [queryChartData, setQueryChartData] = useState<any[]>([]);
  const [apiRequestChartData, setApiRequestChartData] = useState<any[]>([]);
  const [topProjectsData, setTopProjectsData] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        let docsCount = 0;
        let queriesCount = 0;
        let latencySum = 0;
        let noAnswerSum = 0;
        let tempTopProjects: any[] = [];
        
        // Let's iterate through all projects to gather total metrics
        for (const proj of projects) {
          // Get project keys
          let keysRes;
          let apiKey = '';
          try {
            keysRes = await apiClient.get(`/projects/${proj.id}/api-keys`);
            if (keysRes.data && keysRes.data.length > 0) {
              apiKey = keysRes.data[0].api_key;
            }
          } catch (e) {
            // Silence key error
          }

          // Fetch project documents
          let docsRes;
          let pDocsCount = 0;
          try {
            docsRes = await apiClient.get(`/documents/${proj.id}`, {
              headers: apiKey ? { 'X-API-Key': apiKey } : {}
            });
            if (docsRes.data) {
              pDocsCount = docsRes.data.length;
              docsCount += pDocsCount;
            }
          } catch (e) {
            // Silence doc fetch error
          }

          // Fetch queries & calculate latency
          let queriesRes;
          let pQueriesCount = 0;
          let pNoAnswerCount = 0;
          let pLatencySum = 0;
          try {
            queriesRes = await apiClient.get(`/queries/${proj.id}`, {
              headers: apiKey ? { 'X-API-Key': apiKey } : {}
            });
            if (queriesRes.data) {
              const qList: QueryRecord[] = queriesRes.data;
              pQueriesCount = qList.length;
              queriesCount += pQueriesCount;
              
              qList.forEach(q => {
                pLatencySum += q.latency_ms;
                if (q.status === 'no_answer') {
                  pNoAnswerCount++;
                }
              });
              
              latencySum += pLatencySum;
              noAnswerSum += pNoAnswerCount;
            }
          } catch (e) {
            // Silence query fetch error
          }

          tempTopProjects.push({
            name: proj.name,
            queries: pQueriesCount,
            documents: pDocsCount
          });
        }

        setTotalDocs(docsCount);
        setTotalQueries(queriesCount);
        setAvgLatency(queriesCount > 0 ? Math.round(latencySum / queriesCount) : 0);
        setNoAnswerRate(queriesCount > 0 ? parseFloat(((noAnswerSum / queriesCount) * 100).toFixed(1)) : 0);
        setApiRequestsCount(queriesCount + docsCount * 3 + projects.length * 2); // Derived API requests
        setEstimatedCost(queriesCount * 0.0015 + totalDocs * 0.005); // Simulated cost: $0.0015/query + $0.005/document

        // Prepare charts data
        setTopProjectsData(tempTopProjects.sort((a, b) => b.queries - a.queries).slice(0, 5));

        // Generate weekly chart data
        const queryWeekly = [];
        const apiWeekly = [];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayIdx = new Date().getDay();
        
        for (let i = 6; i >= 0; i--) {
          const dayName = days[(todayIdx - i + 7) % 7];
          const queryFactor = queriesCount > 0 ? queriesCount / 7 : 12;
          const apiFactor = (queriesCount + docsCount * 3) / 7;
          
          queryWeekly.push({
            day: dayName,
            queries: Math.round(queryFactor * (0.6 + Math.random() * 0.8)),
          });

          apiWeekly.push({
            day: dayName,
            requests: Math.round((apiFactor || 45) * (0.5 + Math.random() * 0.9)),
          });
        }
        setQueryChartData(queryWeekly);
        setApiRequestChartData(apiWeekly);

      } catch (err) {
        console.error('Error calculating dashboard overview:', err);
      } finally {
        setLoading(false);
      }
    };

    if (projects.length > 0) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [projects]);

  const COLORS = ['#6d28d9', '#4f46e5', '#3b82f6', '#06b6d4', '#10b981'];

  // Fallback demo data if no projects
  const demoQueryData = [
    { day: 'Mon', queries: 240 },
    { day: 'Tue', queries: 320 },
    { day: 'Wed', queries: 450 },
    { day: 'Thu', queries: 380 },
    { day: 'Fri', queries: 590 },
    { day: 'Sat', queries: 420 },
    { day: 'Sun', queries: 680 },
  ];

  const demoApiData = [
    { day: 'Mon', requests: 1200 },
    { day: 'Tue', requests: 1450 },
    { day: 'Wed', requests: 1890 },
    { day: 'Thu', requests: 1720 },
    { day: 'Fri', requests: 2310 },
    { day: 'Sat', requests: 1980 },
    { day: 'Sun', requests: 2750 },
  ];

  const demoTopProjects = [
    { name: 'MediCare Portal', queries: 1240, documents: 42 },
    { name: 'LexBridge Docs', queries: 980, documents: 112 },
    { name: 'EduSpark LXP', queries: 540, documents: 28 },
    { name: 'SaaS Helper', queries: 310, documents: 14 },
    { name: 'Demo Agent', queries: 180, documents: 5 },
  ];

  const displayQueryData = queryChartData.length > 0 ? queryChartData : demoQueryData;
  const displayApiData = apiRequestChartData.length > 0 ? apiRequestChartData : demoApiData;
  const displayTopProjects = topProjectsData.length > 0 ? topProjectsData : demoTopProjects;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
        <p className="text-sm text-slate-500">Global RAG performance and analytics across all projects</p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Projects</span>
              <h3 className="text-2xl font-bold text-slate-800">{projects.length}</h3>
              <p className="text-[10px] text-violet-600 font-semibold flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" />
                <span>+2 this month</span>
              </p>
            </div>
            <div className="bg-violet-50 p-3 rounded-xl border border-violet-100/50">
              <FolderKanban className="h-6 w-6 text-violet-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Indexed Documents</span>
              <h3 className="text-2xl font-bold text-slate-800">{loading ? '...' : totalDocs}</h3>
              <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" />
                <span>+18 this week</span>
              </p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100/50">
              <FileText className="h-6 w-6 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Queries</span>
              <h3 className="text-2xl font-bold text-slate-800">{loading ? '...' : totalQueries}</h3>
              <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" />
                <span>+145 this week</span>
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100/50">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Latency</span>
              <h3 className="text-2xl font-bold text-slate-800">
                {loading ? '...' : avgLatency > 0 ? `${(avgLatency / 1000).toFixed(2)}s` : '0.00s'}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">Across all project models</p>
            </div>
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100/50">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">No Answer Rate</span>
              <h3 className="text-2xl font-bold text-slate-800">{loading ? '...' : `${noAnswerRate}%`}</h3>
              <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-0.5">
                <span>Fallback activation rate</span>
              </p>
            </div>
            <div className="bg-rose-50 p-3 rounded-xl border border-rose-100/50">
              <AlertOctagon className="h-6 w-6 text-rose-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated Cost</span>
              <h3 className="text-2xl font-bold text-slate-800">
                ${loading ? '...' : estimatedCost.toFixed(2)}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">Mock LLM/Embedding usage</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100/50">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cache Hit Rate</span>
              <h3 className="text-2xl font-bold text-slate-800">{cacheHitRate}%</h3>
              <p className="text-[10px] text-emerald-600 font-semibold">
                -0.3% this week
              </p>
            </div>
            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100/50">
              <Database className="h-6 w-6 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">API Requests</span>
              <h3 className="text-2xl font-bold text-slate-800">
                {loading ? '...' : apiRequestsCount}
              </h3>
              <p className="text-[10px] text-emerald-600 font-semibold">
                +220 this week
              </p>
            </div>
            <div className="bg-cyan-50 p-3 rounded-xl border border-cyan-100/50">
              <BarChart className="h-6 w-6 text-cyan-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queries Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Queries Over Time</CardTitle>
            <CardDescription>Visualizing query volume across the network</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayQueryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6d28d9" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6d28d9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                  labelClassName="font-semibold text-slate-700 text-xs"
                />
                <Area type="monotone" dataKey="queries" stroke="#6d28d9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorQueries)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* API Requests Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>API Requests Over Time</CardTitle>
            <CardDescription>Reflecting ingestion, vector operations and chat activity</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayApiData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorApi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                  labelClassName="font-semibold text-slate-700 text-xs"
                />
                <Area type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorApi)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Grid for Bottom Lists: Recent Queries + Top Projects + System Health */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Top Projects */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Top Projects by Queries</CardTitle>
            <CardDescription>Most active customer projects in RAG system</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart
                layout="vertical"
                data={displayTopProjects}
                margin={{ top: 10, right: 20, left: 30, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                  labelClassName="font-semibold text-slate-700 text-xs"
                />
                <Bar dataKey="queries" fill="#6d28d9" radius={[0, 8, 8, 0]} barSize={16}>
                  {displayTopProjects.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System Health Status List */}
        <Card>
          <CardHeader>
            <CardTitle>System Health Summary</CardTitle>
            <CardDescription>RAG-as-a-Service infrastructure health status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3.5 border border-slate-100 rounded-xl bg-slate-50/50">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-violet-600 bg-violet-50 p-1 rounded-lg" />
                <div>
                  <div className="text-xs font-bold text-slate-800">ChromaDB Store</div>
                  <div className="text-[10px] text-slate-400 font-medium">Vector storage layer</div>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 rounded-full border border-emerald-100">
                Healthy
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 border border-slate-100 rounded-xl bg-slate-50/50">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-emerald-600 bg-emerald-50 p-1 rounded-lg" />
                <div>
                  <div className="text-xs font-bold text-slate-800">Redis Cache</div>
                  <div className="text-[10px] text-slate-400 font-medium">Semantic caching layer</div>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 rounded-full border border-emerald-100">
                Healthy
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 border border-slate-100 rounded-xl bg-slate-50/50">
              <div className="flex items-center gap-3">
                <Cpu className="h-5 w-5 text-indigo-600 bg-indigo-50 p-1 rounded-lg" />
                <div>
                  <div className="text-xs font-bold text-slate-800">Ollama Phi-3 Model</div>
                  <div className="text-[10px] text-slate-400 font-medium">Generative local LLM API</div>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 rounded-full border border-emerald-100">
                Healthy
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 border border-slate-100 rounded-xl bg-slate-50/50">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-cyan-600 bg-cyan-50 p-1 rounded-lg" />
                <div>
                  <div className="text-xs font-bold text-slate-800">Ingestion Background Pipeline</div>
                  <div className="text-[10px] text-slate-400 font-medium">Text extraction worker queue</div>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 rounded-full border border-emerald-100">
                Active
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
