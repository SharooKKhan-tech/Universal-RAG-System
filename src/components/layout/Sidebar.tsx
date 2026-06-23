import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, FolderKanban, KeyRound, FileText,
  MessageSquareCode, Search, BarChart3, CheckSquare,
  BadgeCent, Database, Settings, BookOpen, Cpu,
  Server, Activity, Users, ShieldCheck, Code2,
  LogOut, ChevronDown, Zap
} from 'lucide-react';
import apiClient from '../../services/apiClient';

interface SidebarProps { className?: string; }

const NAV_SECTIONS = [
  {
    label: 'Core',
    items: [
      { name: 'Overview', to: '/', icon: LayoutDashboard, requiresProject: false },
      { name: 'Projects', to: '/projects', icon: FolderKanban, requiresProject: false },
      { name: 'API Keys', to: '/api-keys', icon: KeyRound, requiresProject: true },
      { name: 'Documents', to: '/documents', icon: FileText, requiresProject: true },
    ],
  },
  {
    label: 'RAG Tools',
    items: [
      { name: 'Chat Playground', to: '/chat', icon: MessageSquareCode, requiresProject: true },
      { name: 'Search', to: '/search', icon: Search, requiresProject: true },
      { name: 'Analytics', to: '/analytics', icon: BarChart3, requiresProject: true },
      { name: 'Evaluation', to: '/evaluation', icon: CheckSquare, requiresProject: true },
      { name: 'Usage & Cost', to: '/usage', icon: BadgeCent, requiresProject: true },
      { name: 'Cache Stats', to: '/cache', icon: Database, requiresProject: true },
    ],
  },
  {
    label: 'Enterprise',
    items: [
      { name: 'Team Members', to: '/users', icon: Users, requiresProject: false },
      { name: 'Audit Logs', to: '/audit-logs', icon: ShieldCheck, requiresProject: false },
      { name: 'Chat Widget', to: '/widget', icon: Zap, requiresProject: true },
      { name: 'Widget Preview', to: '/widget-preview', icon: Code2, requiresProject: true },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Settings', to: '/settings', icon: Settings, requiresProject: false },
      { name: 'API Docs', to: '/api-docs', icon: BookOpen, requiresProject: false },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const { selectedProject } = useProject();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dbStatus, setDbStatus] = useState<'online' | 'offline'>('online');
  const [cacheStatus, setCacheStatus] = useState<'online' | 'offline'>('online');
  const [chromaStatus, setChromaStatus] = useState<'online' | 'offline'>('online');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await apiClient.get('/health');
        if (res.data) {
          setDbStatus(res.data.database === 'healthy' || res.data.status === 'ok' ? 'online' : 'offline');
          setChromaStatus(res.data.vector_db === 'healthy' || res.data.status === 'ok' ? 'online' : 'offline');
        }
      } catch { setDbStatus('offline'); setChromaStatus('offline'); }
      try {
        const res = await apiClient.get('/cache/health');
        setCacheStatus(res.data?.connected ? 'online' : 'offline');
      } catch { setCacheStatus('offline'); }
    };
    checkHealth();
    const id = setInterval(checkHealth, 30000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    CLIENT_ADMIN: 'Client Admin',
  };

  return (
    <aside className={`w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 h-screen sticky top-0 ${className}`}>
      {/* Brand */}
      <div className="p-5 border-b border-slate-800/60 flex items-center gap-3">
        <div className="bg-violet-600/20 p-2 rounded-xl border border-violet-500/30">
          <Cpu className="h-6 w-6 text-violet-400 animate-pulse" />
        </div>
        <div>
          <h1 className="text-md font-bold text-white tracking-tight leading-none">Universal RAG</h1>
          <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Enterprise v5</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <div className="px-2 mb-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const Icon = item.icon;
                const isDisabled = item.requiresProject && !selectedProject;

                if (isDisabled) {
                  return (
                    <div
                      key={item.name}
                      title="Select a project first"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 cursor-not-allowed select-none"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.name}</span>
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={item.name}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                        isActive
                          ? 'bg-violet-600 text-white shadow-sm shadow-violet-900'
                          : 'hover:bg-slate-800 hover:text-white text-slate-400'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* System Status */}
      <div className="px-4 py-3 border-t border-slate-800/60 bg-slate-950/30">
        <h4 className="text-[10px] font-bold tracking-wider text-slate-600 uppercase mb-2 px-1">System</h4>
        <div className="space-y-1.5 px-1">
          {[
            { label: 'PostgreSQL', status: dbStatus, icon: Server },
            { label: 'Redis Cache', status: cacheStatus, icon: Activity },
            { label: 'ChromaDB', status: chromaStatus, icon: Database },
          ].map(({ label, status, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 text-slate-500">
                <Icon className="h-3 w-3" />
                <span>{label}</span>
              </div>
              <span className={`flex items-center gap-1 font-semibold ${status === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status === 'online' ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
                {status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* User footer */}
      {user && (
        <div className="border-t border-slate-800/60 p-3">
          <button
            onClick={() => setUserMenuOpen(o => !o)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800 transition"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs font-semibold text-white truncate">{user.name}</div>
              <div className="text-[10px] text-slate-500 truncate">{ROLE_LABELS[user.role] || user.role}</div>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {userMenuOpen && (
            <div className="mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-700">
                <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
              </div>
              <button
                id="sidebar-logout"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-rose-400 hover:bg-rose-500/10 transition"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
