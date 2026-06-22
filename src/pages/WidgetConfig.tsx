import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquareCode, Copy, Check, RefreshCw, Save, AlertCircle, CheckCircle, Globe, Palette, ToggleLeft, ToggleRight, Eye, Code2 } from 'lucide-react';
import apiClient from '../services/apiClient';
import { useProject } from '../context/ProjectContext';

interface WidgetCfg {
  project_id: string;
  title: string;
  welcome_message: string;
  primary_color: string;
  position: string;
  is_enabled: boolean;
  widget_public_key: string;
}

const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
const PRESETS = [
  { label: 'Indigo', color: '#6366f1' },
  { label: 'Violet', color: '#7c3aed' },
  { label: 'Sky', color: '#0ea5e9' },
  { label: 'Emerald', color: '#10b981' },
  { label: 'Rose', color: '#f43f5e' },
  { label: 'Amber', color: '#f59e0b' },
];

export const WidgetConfig: React.FC = () => {
  const { selectedProject } = useProject();
  const [cfg, setCfg] = useState<WidgetCfg | null>(null);
  const [form, setForm] = useState({ title: '', welcome_message: '', primary_color: '#6366f1', position: 'bottom-right', is_enabled: true });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState('');
  const [activeTab, setActiveTab] = useState<'config' | 'embed' | 'preview'>('config');

  const fetchConfig = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(`/projects/${selectedProject.id}/widget-config`);
      setCfg(res.data);
      setForm({
        title: res.data.title,
        welcome_message: res.data.welcome_message,
        primary_color: res.data.primary_color,
        position: res.data.position,
        is_enabled: res.data.is_enabled,
      });
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load widget configuration');
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.put(`/projects/${selectedProject!.id}/widget-config`, form);
      setCfg(c => c ? { ...c, ...res.data } : c);
      setSuccess('Widget configuration saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  if (!selectedProject) {
    return (
      <div className="flex items-center justify-center h-60 text-slate-500">
        <div className="text-center">
          <MessageSquareCode className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Select a project to configure the chat widget</p>
        </div>
      </div>
    );
  }

  const embedSnippet = cfg
    ? `<script\n  src="http://localhost:8000/widget.js"\n  data-widget-key="${cfg.widget_public_key}"\n  data-position="${form.position}"\n  data-api-base="http://localhost:8000/api/v1"\n></script>`
    : '';

  const curlExample = cfg
    ? `curl -X POST http://localhost:8000/api/v1/widget/chat \\\n  -H "Content-Type: application/json" \\\n  -H "X-Widget-Key: ${cfg.widget_public_key}" \\\n  -d '{"question": "What is this project about?"}'`
    : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="bg-cyan-500/10 p-2 rounded-xl border border-cyan-500/20">
              <MessageSquareCode className="h-6 w-6 text-cyan-400" />
            </div>
            Chat Widget
          </h1>
          <p className="text-slate-400 text-sm mt-1">Embed a live RAG chat widget on any website</p>
        </div>
        <button onClick={fetchConfig} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition border border-slate-700">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm px-4 py-3 rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm px-4 py-3 rounded-xl">
          <CheckCircle className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      {/* Public key banner */}
      {cfg && (
        <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-400 mb-1">Widget Public Key</div>
            <code className="text-sm text-amber-400 font-mono truncate block">{cfg.widget_public_key}</code>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border ${form.is_enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${form.is_enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              {form.is_enabled ? 'Enabled' : 'Disabled'}
            </div>
            <button
              onClick={() => copyToClipboard(cfg.widget_public_key, 'key')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition border border-slate-700"
            >
              {copied === 'key' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'key' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/40 p-1 rounded-xl border border-slate-800 w-fit">
        {[
          { key: 'config', label: 'Configuration', icon: Palette },
          { key: 'embed', label: 'Embed Code', icon: Code2 },
          { key: 'preview', label: 'Preview', icon: Eye },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === key ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* Config Tab */}
      {activeTab === 'config' && (
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-200">Appearance</h2>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Widget Title</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition"
                  placeholder="Chat Assistant"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Welcome Message</label>
                <textarea
                  value={form.welcome_message}
                  onChange={e => setForm(f => ({ ...f, welcome_message: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition resize-none"
                  placeholder="Hi! How can I help you today?"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Primary Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESETS.map(({ label, color }) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, primary_color: color }))}
                      title={label}
                      className={`w-7 h-7 rounded-full border-2 transition ${form.primary_color === color ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                    className="w-7 h-7 rounded-full border border-slate-600 cursor-pointer bg-transparent"
                    title="Custom color"
                  />
                  <code className="text-xs text-slate-400 ml-1">{form.primary_color}</code>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-200">Behaviour</h2>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  <Globe className="h-3.5 w-3.5 inline mr-1" /> Position
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {POSITIONS.map(pos => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, position: pos }))}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${form.position === pos ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                    >
                      {pos.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Widget Status</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_enabled: !f.is_enabled }))}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition w-full ${form.is_enabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                  {form.is_enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  {form.is_enabled ? 'Widget is Enabled' : 'Widget is Disabled'}
                </button>
              </div>

              <div className="pt-2">
                <button
                  id="save-widget-config"
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold rounded-xl transition text-sm"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Embed Tab */}
      {activeTab === 'embed' && cfg && (
        <div className="space-y-5">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-200">HTML Embed Snippet</h2>
              <button
                onClick={() => copyToClipboard(embedSnippet, 'embed')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition border border-slate-700"
              >
                {copied === 'embed' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === 'embed' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs text-cyan-300 overflow-x-auto whitespace-pre">{embedSnippet}</pre>
            <p className="text-xs text-slate-500 mt-3">Add this script tag before the closing <code className="text-slate-400">&lt;/body&gt;</code> tag of any webpage.</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-200">REST API (cURL)</h2>
              <button
                onClick={() => copyToClipboard(curlExample, 'curl')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition border border-slate-700"
              >
                {copied === 'curl' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === 'curl' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs text-emerald-300 overflow-x-auto whitespace-pre">{curlExample}</pre>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-400">
            <strong>Security note:</strong> The widget public key is safe to expose publicly. It only grants access to the chat endpoint for this project. Never expose secret project API keys in browser code.
          </div>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Widget Preview</h2>
          <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl h-80 overflow-hidden">
            {/* Mock browser */}
            <div className="absolute inset-x-0 top-0 h-8 bg-slate-700/50 flex items-center px-4 gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-3 text-[10px] text-slate-500 bg-slate-800 px-4 py-0.5 rounded-full">your-website.com</span>
            </div>
            <div className="absolute inset-0 top-8 flex items-center justify-center text-slate-600 text-sm">
              Your website content here
            </div>
            {/* Widget bubble mock */}
            <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
              <div className="bg-white rounded-2xl shadow-2xl w-52 overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: form.primary_color }}>
                  <span className="h-2 w-2 bg-white/40 rounded-full" />
                  <span className="text-white text-[11px] font-semibold truncate">{form.title || 'Chat Assistant'}</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="bg-slate-100 rounded-lg p-2 text-[10px] text-slate-600 max-w-[80%]">
                    {form.welcome_message || 'Hi! How can I help?'}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <input readOnly placeholder="Ask something…" className="flex-1 bg-slate-100 rounded text-[10px] px-2 py-1 text-slate-400 outline-none" />
                    <button className="text-[10px] text-white px-2 py-1 rounded font-bold" style={{ backgroundColor: form.primary_color }}>→</button>
                  </div>
                </div>
              </div>
              <button className="h-10 w-10 rounded-full text-white flex items-center justify-center shadow-lg" style={{ backgroundColor: form.primary_color }}>
                <MessageSquareCode className="h-5 w-5" />
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 text-center">Live preview — changes reflect when you adjust configuration on the left</p>
        </div>
      )}
    </div>
  );
};
