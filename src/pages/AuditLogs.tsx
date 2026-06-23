import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw, Search, Filter, AlertCircle, Clock, User, Globe, ChevronDown, ChevronRight } from 'lucide-react';
import apiClient from '../services/apiClient';

interface AuditEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  user_id: string | null;
  client_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata_json: Record<string, any> | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  'user.register': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  'user.login': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  'user.logout': 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  'project.create': 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  'project.delete': 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  'api_key.create': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  'api_key.revoke': 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  'document.upload': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  'document.delete': 'text-rose-400 bg-rose-500/10 border-rose-500/30',
};

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/audit-logs', { params: { limit: 200 } });
      setLogs(res.data?.logs || res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const uniqueActions = [...new Set(logs.map(l => l.action))].sort();

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.action.includes(search) || l.resource_type?.includes(search) || l.ip_address?.includes(search) || l.user_id?.includes(search);
    const matchAction = !actionFilter || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const fmt = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const actionColor = (action: string) => ACTION_COLORS[action] || 'text-slate-400 bg-slate-700/30 border-slate-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
              <ShieldCheck className="h-6 w-6 text-amber-600" />
            </div>
            Audit Logs
          </h1>
          <p className="text-slate-500 text-sm mt-1">Complete trail of all sensitive system actions</p>
        </div>
        <button onClick={fetchLogs} className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm transition border border-slate-200 shadow-xs cursor-pointer">
          <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm px-4 py-3 rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Events', value: logs.length },
          { label: 'Last 24h', value: logs.filter(l => new Date(l.created_at) > new Date(Date.now() - 86400000)).length },
          { label: 'Auth Events', value: logs.filter(l => l.action.startsWith('user.')).length },
          { label: 'Unique Actions', value: uniqueActions.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search actions, IPs, users…"
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 transition shadow-2xs"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:border-violet-500 transition appearance-none shadow-2xs"
          >
            <option value="" className="bg-white text-slate-800">All actions</option>
            {uniqueActions.map(a => <option key={a} value={a} className="bg-white text-slate-800">{a}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
        <span className="flex items-center text-xs text-slate-600 px-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
          {filtered.length} events
        </span>
      </div>

      {/* Log Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Time</th>
                <th className="px-5 py-3 text-left">Action</th>
                <th className="px-5 py-3 text-left">Resource</th>
                <th className="px-5 py-3 text-left">User</th>
                <th className="px-5 py-3 text-left">IP</th>
                <th className="px-5 py-3 text-left w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center text-slate-500">
                  <RefreshCw className="h-5 w-5 animate-spin inline mr-2" /> Loading…
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-slate-500">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>No audit events found</p>
                </td></tr>
              ) : paginated.map(log => (
                <React.Fragment key={log.id}>
                  <tr
                    className="hover:bg-slate-50/50 transition cursor-pointer"
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  >
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {fmt(log.created_at)}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold border px-2 py-0.5 rounded-md ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {log.resource_type && (
                        <span>{log.resource_type}{log.resource_id ? ` · ${log.resource_id.slice(0, 8)}…` : ''}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {log.user_id ? (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-slate-400" />
                          {log.user_id.slice(0, 8)}…
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {log.ip_address ? (
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3 w-3 text-slate-400" />
                          {log.ip_address}
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-400">
                      {expanded === log.id
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </td>
                  </tr>
                  {expanded === log.id && log.metadata_json && Object.keys(log.metadata_json).length > 0 && (
                    <tr className="bg-slate-50/40">
                      <td colSpan={6} className="px-5 py-3">
                        <pre className="text-[11px] text-slate-300 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.metadata_json, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-200 rounded-lg transition cursor-pointer">← Prev</button>
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-200 rounded-lg transition cursor-pointer">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
