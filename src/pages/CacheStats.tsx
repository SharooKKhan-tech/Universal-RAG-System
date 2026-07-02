import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import {
  Database,
  Trash2,
  RefreshCw,
  TrendingUp,
  WifiOff,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
} from '../components/ui/CustomUI';
import apiClient from '../services/apiClient';

export const CacheStats: React.FC = () => {
  const { selectedProject } = useProject();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [clearing, setClearing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchCacheStats = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const response = await apiClient.get(`/cache/stats/${selectedProject.id}`);
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching cache stats:', err);
      setStats({ redis_connected: false, error: 'Failed to reach server' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCacheStats();
  }, [selectedProject?.id]); // eslint-disable-line

  const handleClearCache = async () => {
    if (!selectedProject) return;
    if (!confirm('Clear all cached answers for this project? Subsequent queries will call Gemini directly.')) return;
    setClearing(true);
    try {
      await apiClient.delete(`/cache/project/${selectedProject.id}`);
      fetchCacheStats();
    } catch (err) {
      console.error('Error clearing cache:', err);
    } finally {
      setClearing(false);
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

  if (!selectedProject) {
    return (
      <Card className="text-center py-16 bg-white border-dashed border-2 border-slate-200 max-w-2xl mx-auto mt-12">
        <CardContent className="space-y-4">
          <div className="bg-amber-50 h-14 w-14 rounded-2xl flex items-center justify-center mx-auto border border-amber-100">
            <Database className="h-7 w-7 text-amber-500" />
          </div>
          <div className="max-w-xs mx-auto space-y-1.5">
            <h3 className="text-md font-bold text-slate-800">No project selected</h3>
            <p className="text-xs text-slate-500">Please select a project to view cache metrics.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const redisOnline = stats?.redis_connected === true;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Cache Stats — {selectedProject.name}</h2>
          <p className="text-sm text-slate-500">Redis semantic query caching — reduce repeated Gemini API calls</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" onClick={fetchCacheStats} className="gap-2 cursor-pointer">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {redisOnline && (
            <>
              <Button variant="outline" onClick={handleResetStats} isLoading={resetting} className="gap-2 cursor-pointer">
                Reset Counters
              </Button>
              <Button variant="danger" onClick={handleClearCache} isLoading={clearing} className="gap-2 cursor-pointer">
                <Trash2 className="h-4 w-4" />
                Clear Cache
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Redis connection status banner */}
      {loading ? (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting to Redis...
        </div>
      ) : redisOnline ? (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-sm text-emerald-800 font-semibold">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <strong>Redis is Online</strong>
            <span className="font-normal text-emerald-700 ml-2">— Caching active. Repeated identical queries will be served from cache instantly.</span>
          </div>
        </div>
      ) : (
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="bg-slate-200 h-12 w-12 rounded-xl flex items-center justify-center shrink-0">
              <WifiOff className="h-6 w-6 text-slate-500" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">Redis is Offline</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                The Redis cache server is not running. The system works fine without it — all queries go directly to Gemini AI.
                Caching is optional and only improves performance for repeated identical questions.
              </p>
              <div className="pt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-slate-600">
                <span className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
                  ✅ Gemini chat — fully working
                </span>
                <span className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
                  ✅ Document upload — fully working
                </span>
                <span className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
                  ⚪ Response caching — disabled (optional)
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-slate-100 rounded-lg">
            <p className="text-[11px] font-mono text-slate-600 font-semibold">
              To enable Redis caching, run:
            </p>
            <code className="text-[11px] font-mono text-violet-700 block mt-1">
              docker run -d -p 6379:6379 redis:alpine
            </code>
            <p className="text-[10px] text-slate-400 mt-1">Then restart the backend server.</p>
          </div>
        </div>
      )}

      {/* Stats cards — only shown when Redis is online */}
      {!loading && redisOnline && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            <Card>
              <CardContent className="p-5 text-center space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cached Keys</span>
                <h3 className="text-2xl font-bold text-slate-800">{stats.total_keys}</h3>
                <span className="text-[9px] text-slate-400 font-semibold block">Unique answer records</span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 text-center space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hit Rate</span>
                <h3 className="text-2xl font-bold text-violet-600">{stats.hit_rate}%</h3>
                <span className="text-[9px] text-emerald-600 font-semibold flex items-center justify-center gap-0.5">
                  <TrendingUp className="h-3 w-3" /> Efficiency
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 text-center space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cache Hits</span>
                <h3 className="text-2xl font-bold text-slate-800">{stats.hits}</h3>
                <span className="text-[9px] text-slate-400 font-semibold block">Saved Gemini calls</span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 text-center space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cache Misses</span>
                <h3 className="text-2xl font-bold text-slate-800">{stats.misses}</h3>
                <span className="text-[9px] text-slate-400 font-semibold block">Forwarded to Gemini</span>
              </CardContent>
            </Card>
          </div>

          {/* Info about what's not tracked */}
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-slate-500 leading-relaxed">
                <strong className="text-slate-700">Note:</strong> Per-query hit counts and hourly charts require additional Redis time-series storage (not yet implemented).
                Currently tracked: total hits, misses, hit rate, and live cached key count for this project.
                Cache TTL is <strong>1 hour</strong> per answer.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
