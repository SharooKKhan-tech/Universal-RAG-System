import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  BarChart, 
  MessageSquare, 
  Clock, 
  AlertCircle,
  TrendingUp,
  CheckCircle
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  TableContainer,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Badge
} from '../components/ui/CustomUI';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend,
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line
} from 'recharts';
import apiClient from '../services/apiClient';
import type { AnalyticsSummary, DocumentUsage, QueryRecord } from '../types';

export const Analytics: React.FC = () => {
  const { selectedProject, selectedApiKey } = useProject();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [documentUsage, setDocumentUsage] = useState<DocumentUsage[]>([]);
  const [recentQueries, setRecentQueries] = useState<QueryRecord[]>([]);

  // Weekly line chart data
  const [queriesHistory, setQueriesHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!selectedProject || !selectedApiKey) return;
      setLoading(true);
      try {
        // Fetch summary
        const summaryRes = await apiClient.get<any>(`/analytics/${selectedProject.id}`);
        const sData = summaryRes.data;
        if (sData) {
          const mappedSummary: AnalyticsSummary = {
            total_queries: sData.total_queries ?? 0,
            answered_queries: sData.answered_queries ?? 0,
            no_answer_queries: sData.no_answer_queries ?? 0,
            answer_rate: sData.answer_rate ?? sData.answer_rate_percentage ?? 0,
            average_latency_ms: sData.average_latency_ms ?? 0,
            average_sources: sData.average_sources ?? sData.average_sources_per_answer ?? 0,
            model_distribution: sData.model_distribution ?? sData.model_usage ?? {}
          };
          setSummary(mappedSummary);
        }

        // Fetch documents usage
        const docsUsageRes = await apiClient.get<any>(`/analytics/${selectedProject.id}/documents`);
        const backendDocs = docsUsageRes.data?.documents || [];
        const totalUsedCount = backendDocs.reduce((sum: number, doc: any) => sum + doc.used_count, 0) || 1;
        const mappedDocs: DocumentUsage[] = backendDocs.map((doc: any, index: number) => ({
          document_id: String(index + 1),
          file_name: doc.file_name || 'Unknown',
          query_count: doc.used_count,
          percentage: Number(((doc.used_count / totalUsedCount) * 100).toFixed(1))
        }));
        setDocumentUsage(mappedDocs);

        // Fetch query list for recent queries table
        const queriesRes = await apiClient.get<QueryRecord[]>(`/queries/${selectedProject.id}`);
        setRecentQueries(queriesRes.data.slice(0, 10)); // Show latest 10

        // Parse query history over time
        const qList = queriesRes.data;
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayCounts: Record<string, number> = {};
        
        // Populate last 7 days
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          dayCounts[days[d.getDay()]] = 0;
        }

        qList.forEach(q => {
          const qDate = new Date(q.created_at);
          const dayName = days[qDate.getDay()];
          if (dayName in dayCounts) {
            dayCounts[dayName]++;
          }
        });

        const chartData = Object.entries(dayCounts).map(([day, count]) => ({
          day,
          queries: count
        }));
        setQueriesHistory(chartData);

      } catch (err) {
        console.error('Error fetching analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [selectedProject, selectedApiKey]);

  // Demo Fallback Data
  const demoSummary = {
    total_queries: 432,
    answered_queries: 398,
    no_answer_queries: 34,
    answer_rate: 92.1,
    average_latency_ms: 2450,
    average_sources: 2.1,
    model_distribution: { 'phi3:mini': 380, 'chatgpt-4o': 52 }
  };

  const demoDocUsage = [
    { document_id: '1', file_name: 'Employee_Handbook.pdf', query_count: 184, percentage: 42.5 },
    { document_id: '2', file_name: 'Leave_Policy.pdf', query_count: 102, percentage: 23.6 },
    { document_id: '3', file_name: 'IT_Security_Policy.pdf', query_count: 85, percentage: 19.6 },
    { document_id: '4', file_name: 'Benefits_Guide.pdf', query_count: 42, percentage: 9.7 },
    { document_id: '5', file_name: 'Other_Docs', query_count: 19, percentage: 4.6 }
  ];

  const demoHistory = [
    { day: 'Mon', queries: 45 },
    { day: 'Tue', queries: 58 },
    { day: 'Wed', queries: 82 },
    { day: 'Thu', queries: 64 },
    { day: 'Fri', queries: 91 },
    { day: 'Sat', queries: 35 },
    { day: 'Sun', queries: 57 }
  ];

  const displaySummary = summary || demoSummary;
  const displayDocUsage = documentUsage.length > 0 ? documentUsage : demoDocUsage;
  const displayHistory = queriesHistory.length > 0 ? queriesHistory : demoHistory;

  const pieData = [
    { name: 'Answered', value: displaySummary.answered_queries, color: '#10b981' },
    { name: 'No Answer', value: displaySummary.no_answer_queries, color: '#f59e0b' }
  ];

  if (!selectedProject) {
    return (
      <Card className="text-center py-16 bg-white border-dashed border-2 border-slate-200 max-w-2xl mx-auto mt-12">
        <CardContent className="space-y-4">
          <div className="bg-amber-50 h-14 w-14 rounded-2xl flex items-center justify-center mx-auto border border-amber-100">
            <BarChart className="h-7 w-7 text-amber-500" />
          </div>
          <div className="max-w-xs mx-auto space-y-1.5">
            <h3 className="text-md font-bold text-slate-800">No project selected</h3>
            <p className="text-xs text-slate-500">Please select or create a project in the top bar to view analytics dashboards.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Analytics - {selectedProject.name}</h2>
        <p className="text-sm text-slate-500">Analyze conversational performance, query response times and model usage.</p>
      </div>

      {/* Warning banner for API key */}
      {!selectedApiKey && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 text-xs text-amber-800">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Showing Demo Analytics:</strong> Add and select an API Key for this project to view live streaming search metrics.
          </div>
        </div>
      )}

      {/* Grid: 4 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Queries</span>
              <h3 className="text-2xl font-bold text-slate-800">{loading && selectedApiKey ? '...' : displaySummary.total_queries}</h3>
              <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" />
                <span>+12.5% vs last 30d</span>
              </p>
            </div>
            <div className="bg-violet-50 p-2.5 rounded-xl border border-violet-100/50">
              <MessageSquare className="h-5.5 w-5.5 text-violet-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Answered Queries</span>
              <h3 className="text-2xl font-bold text-slate-800">{loading && selectedApiKey ? '...' : displaySummary.answered_queries}</h3>
              <p className="text-[10px] text-emerald-600 font-semibold">
                {displaySummary.answer_rate}% answer rate
              </p>
            </div>
            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100/50">
              <CheckCircle className="h-5.5 w-5.5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No-Answer rate</span>
              <h3 className="text-2xl font-bold text-slate-800">
                {loading && selectedApiKey ? '...' : `${((displaySummary.no_answer_queries / displaySummary.total_queries) * 100).toFixed(1)}%`}
              </h3>
              <p className="text-[10px] text-amber-600 font-semibold">
                {displaySummary.no_answer_queries} fallbacks triggered
              </p>
            </div>
            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100/50">
              <AlertCircle className="h-5.5 w-5.5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Latency</span>
              <h3 className="text-2xl font-bold text-slate-800">
                {loading && selectedApiKey ? '...' : `${(displaySummary.average_latency_ms / 1000).toFixed(2)}s`}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold">
                {displaySummary.average_sources} sources parsed per query
              </p>
            </div>
            <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100/50">
              <Clock className="h-5.5 w-5.5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left chart: Queries Over Time Line Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Queries Over Time</CardTitle>
            <CardDescription>Daily query volume for this project</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayHistory} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                  labelClassName="font-semibold text-slate-700 text-xs"
                />
                <Line type="monotone" dataKey="queries" stroke="#6d28d9" strokeWidth={2.5} activeDot={{ r: 6 }} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Right chart: Answer Rate Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Answer Distribution</CardTitle>
            <CardDescription>Successful answer rate vs fallbacks</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Popular files & Recent Queries list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Popular Source Files Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top Source Documents</CardTitle>
            <CardDescription>Most frequently cited documents</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart
                layout="vertical"
                data={displayDocUsage}
                margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis dataKey="file_name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                />
                <Bar dataKey="query_count" fill="#4f46e5" radius={[0, 6, 6, 0]} barSize={12} />
              </ReBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Queries Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Query Logs</CardTitle>
            <CardDescription>Latest questions handled by the assistant</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading && selectedApiKey ? (
              <div className="text-center py-12 text-xs text-slate-400">Loading queries...</div>
            ) : recentQueries.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400">No query logs recorded yet.</div>
            ) : (
              <TableContainer className="border-none rounded-none">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentQueries.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium text-slate-800 max-w-[200px] truncate" title={q.question}>
                          {q.question}
                        </TableCell>
                        <TableCell>
                          <Badge variant={q.status === 'answered' ? 'success' : 'warning'}>
                            {q.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{(q.latency_ms / 1000).toFixed(2)}s</TableCell>
                        <TableCell className="text-[10px] text-slate-400 font-semibold">
                          {new Date(q.created_at).toLocaleTimeString()}
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
  );
};
