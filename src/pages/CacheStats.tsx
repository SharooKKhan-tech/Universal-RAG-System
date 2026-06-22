import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  TrendingUp, 
  AlertTriangle
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  Button,
  Badge,
  TableContainer,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from '../components/ui/CustomUI';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import apiClient from '../services/apiClient';

export const CacheStats: React.FC = () => {
  const { selectedProject, selectedApiKey } = useProject();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [clearing, setClearing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchCacheStats = async () => {
    if (!selectedProject || !selectedApiKey) return;
    setLoading(true);
    try {
      const response = await apiClient.get(`/cache/stats/${selectedProject.id}`);
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching cache stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCacheStats();
  }, [selectedProject, selectedApiKey]);

  const handleClearCache = async () => {
    if (!selectedProject) return;
    if (confirm('Are you sure you want to delete all cached chat answers for this project? Subsequent queries will bypass the cache and fetch fresh LLM responses.')) {
      setClearing(true);
      try {
        await apiClient.delete(`/cache/project/${selectedProject.id}`);
        fetchCacheStats();
      } catch (err) {
        console.error('Error clearing cache:', err);
      } finally {
        setClearing(false);
      }
    }
  };

  const handleResetStats = async () => {
    if (!selectedProject) return;
    setResetting(true);
    try {
      await apiClient.post(`/cache/stats/${selectedProject.id}/reset`);
      fetchCacheStats();
    } catch (err) {
      console.error('Error resetting cache stats:', err);
    } finally {
      setResetting(false);
    }
  };

  // Demo Fallback Data if Redis is not connected or empty
  const demoStats = {
    total_keys: 156,
    hits: 456,
    misses: 126,
    hit_rate: 78.3,
    memory_usage_mb: 12.4,
    redis_connected: true,
    top_queries: [
      { query: 'What is the leave policy?', count: 45, avg_latency_saved_ms: 2450 },
      { query: 'How to apply for leave?', count: 32, avg_latency_saved_ms: 2310 },
      { query: 'What are the benefits?', count: 28, avg_latency_saved_ms: 2150 },
      { query: 'Code of conduct rules', count: 18, avg_latency_saved_ms: 2540 },
      { query: 'What is the notice period?', count: 15, avg_latency_saved_ms: 2200 }
    ],
    hourly_performance: [
      { time: '09:00', hitRate: 65 },
      { time: '10:00', hitRate: 72 },
      { time: '11:00', hitRate: 80 },
      { time: '12:00', hitRate: 78 },
      { time: '13:00', hitRate: 85 },
      { time: '14:00', hitRate: 79 },
      { time: '15:00', hitRate: 83 },
      { time: '16:00', hitRate: 88 }
    ]
  };

  const displayStats = stats && stats.total_keys !== undefined ? stats : demoStats;

  if (!selectedProject) {
    return (
      <Card className="text-center py-16 bg-white border-dashed border-2 border-slate-200 max-w-2xl mx-auto mt-12">
        <CardContent className="space-y-4">
          <div className="bg-amber-50 h-14 w-14 rounded-2xl flex items-center justify-center mx-auto border border-amber-100">
            <Database className="h-7 w-7 text-amber-500" />
          </div>
          <div className="max-w-xs mx-auto space-y-1.5">
            <h3 className="text-md font-bold text-slate-800">No project selected</h3>
            <p className="text-xs text-slate-500">Please select or create a project in the top bar to view cache metrics.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Cache Stats - {selectedProject.name}</h2>
          <p className="text-sm text-slate-500">Analyze Redis semantic query caching efficiencies, latency savings, and keys storage.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" onClick={handleResetStats} isLoading={resetting} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reset Cache Counters
          </Button>
          <Button variant="danger" onClick={handleClearCache} isLoading={clearing} className="gap-2 cursor-pointer">
            <Trash2 className="h-4 w-4" />
            Clear Cache
          </Button>
        </div>
      </div>

      {/* Warning if no key */}
      {!selectedApiKey && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 text-xs text-amber-800 shadow-2xs">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Showing Demo Cache Statistics:</strong> Connect an API Key for this project to view live Redis cache diagnostics.
          </div>
        </div>
      )}

      {/* Grid: 5 Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
        <Card>
          <CardContent className="p-5 text-center space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Cached Keys</span>
            <h3 className="text-2xl font-bold text-slate-800">{loading && selectedApiKey ? '...' : displayStats.total_keys}</h3>
            <span className="text-[9px] text-slate-400 font-semibold block">Unique answer records</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 text-center space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cache Hit Rate</span>
            <h3 className="text-2xl font-bold text-violet-600">{loading && selectedApiKey ? '...' : `${displayStats.hit_rate}%`}</h3>
            <span className="text-[9px] text-emerald-600 font-semibold block flex items-center justify-center gap-0.5">
              <TrendingUp className="h-3 w-3" />
              <span>Highly Optimized</span>
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 text-center space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cache Hits</span>
            <h3 className="text-2xl font-bold text-slate-800">{loading && selectedApiKey ? '...' : displayStats.hits}</h3>
            <span className="text-[9px] text-slate-400 font-semibold block">Queries saved from LLM calls</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 text-center space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cache Misses</span>
            <h3 className="text-2xl font-bold text-slate-800">{loading && selectedApiKey ? '...' : displayStats.misses}</h3>
            <span className="text-[9px] text-slate-400 font-semibold block">Parsed to local models</span>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-5 text-center space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Memory Usage</span>
            <h3 className="text-2xl font-bold text-slate-800">{loading && selectedApiKey ? '...' : `${displayStats.memory_usage_mb} MB`}</h3>
            <span className="text-[9px] text-slate-400 font-semibold block">Redis memory partition</span>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Chart + Top Queries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Cache Performance Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cache Hit Rate Performance</CardTitle>
            <CardDescription>Visualizing efficiency rate over the last 8 hours</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayStats.hourly_performance} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                />
                <Area type="monotone" dataKey="hitRate" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHit)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Cached Queries */}
        <Card>
          <CardHeader>
            <CardTitle>Top Cached Queries</CardTitle>
            <CardDescription>Most frequently hit questions in Cache memory</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <TableContainer className="border-none rounded-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="text-right">Hits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayStats.top_queries.map((q: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-semibold text-slate-800 truncate max-w-[140px]" title={q.query}>
                        {q.query}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="purple" className="font-bold">{q.count} hits</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
