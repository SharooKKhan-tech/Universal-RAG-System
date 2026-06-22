import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProjectProvider } from './context/ProjectContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';

// Auth pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';

// Main pages
import { DashboardOverview } from './pages/DashboardOverview';
import { Projects } from './pages/Projects';
import { ProjectDetails } from './pages/ProjectDetails';
import { ApiKeyManagement } from './pages/ApiKeyManagement';
import { Documents } from './pages/Documents';
import { ChatPlayground } from './pages/ChatPlayground';
import { SearchPlayground } from './pages/SearchPlayground';
import { Analytics } from './pages/Analytics';
import { Evaluation } from './pages/Evaluation';
import { UsageCost } from './pages/UsageCost';
import { CacheStats } from './pages/CacheStats';
import { Settings } from './pages/Settings';
import { ApiDocs } from './pages/ApiDocs';

// Enterprise pages
import { UserManagement } from './pages/UserManagement';
import { AuditLogs } from './pages/AuditLogs';
import { WidgetConfig } from './pages/WidgetConfig';
import { ChatWidgetPreview } from './pages/ChatWidgetPreview';

// ── Protected layout wrapper ─────────────────────────────────────────────────
const AppShell: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
          <Routes>
            <Route path="/" element={<DashboardOverview />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:project_id" element={<ProjectDetails />} />
            <Route path="/api-keys" element={<ApiKeyManagement />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/chat" element={<ChatPlayground />} />
            <Route path="/search" element={<SearchPlayground />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/evaluation" element={<Evaluation />} />
            <Route path="/usage" element={<UsageCost />} />
            <Route path="/cache" element={<CacheStats />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/api-docs" element={<ApiDocs />} />
            {/* Enterprise routes */}
            <Route path="/users" element={<UserManagement />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/widget" element={<WidgetConfig />} />
            <Route path="/widget-preview" element={<ChatWidgetPreview />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

// ── Root app with auth-gated routing ─────────────────────────────────────────
const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <ProjectProvider>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<LoginRedirect />} />
            <Route path="/register" element={<RegisterRedirect />} />
            {/* Protected app shell */}
            <Route path="/*" element={<AppShell />} />
          </Routes>
        </ProjectProvider>
      </AuthProvider>
    </Router>
  );
};

// Redirect already-authenticated users away from /login and /register
const LoginRedirect: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Login />;
};

const RegisterRedirect: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Register />;
};

export default App;
