import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  BadgeCent, 
  Layers, 
  TrendingUp, 
  Activity, 
  Cpu
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  Button
} from '../components/ui/CustomUI';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import apiClient from '../services/apiClient';

export const UsageCost: React.FC = () => {
  const { selectedProject, selectedApiKey } = useProject();

  const [usageStats, setUsageStats] = useState<any>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      if (!selectedProject || !selectedApiKey) return;
      try {
        const response = await apiClient.get(`/usage/${selectedProject.id}`);
        setUsageStats(response.data);
      } catch (err) {
        console.error('Error fetching usage stats:', err);
      }
    };

    fetchUsage();
  }, [selectedProject, selectedApiKey]);

  // Demo Fallback Data
  const demoUsage = {
    api_requests: 1234,
    chat_requests: 645,
    document_uploads: 24,
    indexed_chunks: 1450,
    llm_calls: 645,
    embedding_calls: 1474, // chunks + query rewrites
    rerank_calls: 420,
    estimated_tokens: 423500,
    estimated_cost: 8.47, // $0.02 per 1k tokens mockup
    plan_limit_queries: 1000,
    plan_name: 'Starter'
  };

  const displayUsage = usageStats ? {
    api_requests: usageStats.total_api_requests ?? 0,
    chat_requests: usageStats.total_chat_queries ?? 0,
    document_uploads: usageStats.total_documents ?? 0,
    indexed_chunks: usageStats.total_chunks ?? 0,
    llm_calls: usageStats.total_chat_queries ?? 0,
    embedding_calls: (usageStats.total_chunks ?? 0) + (usageStats.total_chat_queries ?? 0),
    rerank_calls: 0,
    estimated_tokens: usageStats.total_estimated_tokens ?? 0,
    estimated_cost: usageStats.total_estimated_cost ?? 0,
    plan_limit_queries: 1000,
    plan_name: 'Starter'
  } : demoUsage;

  // Pie chart data for current plan usage
  const planPercentage = Math.min(Math.round((displayUsage.chat_requests / displayUsage.plan_limit_queries) * 100), 100);
  const planData = [
    { name: 'Used', value: displayUsage.chat_requests, color: '#6d28d9' },
    { name: 'Remaining', value: Math.max(displayUsage.plan_limit_queries - displayUsage.chat_requests, 0), color: '#f1f5f9' }
  ];

  // Daily API operations chart data
  const apiOpsData = [
    { name: 'Ingestion', calls: displayUsage.document_uploads * 15, fill: '#10b981' },
    { name: 'Embeddings', calls: displayUsage.embedding_calls, fill: '#3b82f6' },
    { name: 'Reranking', calls: displayUsage.rerank_calls, fill: '#f59e0b' },
    { name: 'LLM Chat', calls: displayUsage.llm_calls, fill: '#6d28d9' }
  ];

  const pricingPlans = [
    {
      name: 'Free',
      price: '$0',
      description: 'Perfect for local developer evaluations',
      features: [
        '1 Isolated RAG Project',
        '100 Chat Queries/mo',
        '10MB Max Ingestion Size',
        'Shared Embedding Models',
        'Standard Search Retrieval'
      ],
      action: 'Current Plan',
      isCurrent: displayUsage.plan_name === 'Free'
    },
    {
      name: 'Starter',
      price: '$29',
      description: 'Ideal for small customer service widgets',
      features: [
        '3 Isolated RAG Projects',
        '1,000 Chat Queries/mo',
        '50MB Max Ingestion Size',
        'Dedicated Local Phi-3 LLM',
        'Hybrid Search + Reranking',
        'Default Web Analytics'
      ],
      action: 'Upgrade Plan',
      isCurrent: displayUsage.plan_name === 'Starter'
    },
    {
      name: 'Pro',
      price: '$99',
      description: 'For corporate documentation at scale',
      features: [
        '10 Isolated RAG Projects',
        '10,000 Chat Queries/mo',
        '250MB Ingestion limit',
        'Dedicated Embeddings API',
        'Semantic Caching Enabled',
        'Custom Widget Branding',
        'Weekly Evaluation Benchmarks'
      ],
      action: 'Upgrade Plan',
      isCurrent: displayUsage.plan_name === 'Pro'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'Custom setups for high volume corporate operations',
      features: [
        'Unlimited RAG Projects',
        'Unlimited Chat Queries',
        'Dedicated Private VPC Hosting',
        'On-Premise ChromaDB / Redis',
        'SLA Guaranteed Response Times',
        'Dedicated Solutions Architect',
        'Custom SLA support'
      ],
      action: 'Contact Sales',
      isCurrent: displayUsage.plan_name === 'Enterprise'
    }
  ];

  if (!selectedProject) {
    return (
      <Card className="text-center py-16 bg-white border-dashed border-2 border-slate-200 max-w-2xl mx-auto mt-12">
        <CardContent className="space-y-4">
          <div className="bg-amber-50 h-14 w-14 rounded-2xl flex items-center justify-center mx-auto border border-amber-100">
            <BadgeCent className="h-7 w-7 text-amber-500" />
          </div>
          <div className="max-w-xs mx-auto space-y-1.5">
            <h3 className="text-md font-bold text-slate-800">No project selected</h3>
            <p className="text-xs text-slate-500">Please select or create a project in the top bar to view usage logs.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Usage & Costs - {selectedProject.name}</h2>
        <p className="text-sm text-slate-500">Track LLM generations, token usage calculations, and project service billing.</p>
      </div>

      {/* Grid: Usage metrics and Plan Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Summary Metrics (col-span-2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total LLM Calls</span>
                  <h3 className="text-xl font-bold text-slate-800">{displayUsage.llm_calls}</h3>
                  <p className="text-[9px] text-slate-400 font-semibold flex items-center gap-0.5">
                    <Activity className="h-3 w-3" />
                    <span>Chat questions answered</span>
                  </p>
                </div>
                <div className="bg-violet-50 p-2.5 rounded-xl border border-violet-100/50">
                  <Cpu className="h-5 w-5 text-violet-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Embedding Calls</span>
                  <h3 className="text-xl font-bold text-slate-800">{displayUsage.embedding_calls}</h3>
                  <p className="text-[9px] text-slate-400 font-semibold">Ingestion + query parsing</p>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100/50">
                  <Layers className="h-5 w-5 text-emerald-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Cost</span>
                  <h3 className="text-xl font-bold text-slate-800">${displayUsage.estimated_cost.toFixed(2)}</h3>
                  <p className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" />
                    <span>Based on token metrics</span>
                  </p>
                </div>
                <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100/50">
                  <BadgeCent className="h-5 w-5 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Operational Metrics Charts */}
          <Card>
            <CardHeader>
              <CardTitle>API Operational Volume</CardTitle>
              <CardDescription>RAG internal pipeline events breakdown</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apiOpsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                  />
                  <Bar dataKey="calls" radius={[6, 6, 0, 0]} barSize={32}>
                    {apiOpsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Subscription Plan Widget (col-span-1) */}
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Current Plan Usage</CardTitle>
              <CardDescription>Active Subscription: <strong className="text-slate-800 font-bold">{displayUsage.plan_name}</strong></CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-between h-[320px] pb-6">
              <div className="relative h-44 w-44 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={70}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                    >
                      {planData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Centered text */}
                <div className="absolute text-center">
                  <div className="text-3xl font-extrabold text-slate-800">{planPercentage}%</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Queries used</div>
                </div>
              </div>

              <div className="w-full space-y-3 mt-4 text-xs font-medium">
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-400">Total API Keys:</span>
                  <span className="text-slate-800 font-bold">1 Active</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-400">Monthly Query Cap:</span>
                  <span className="text-slate-800 font-bold">{displayUsage.chat_requests} / {displayUsage.plan_limit_queries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Token Volume Used:</span>
                  <span className="text-slate-800 font-bold">{displayUsage.estimated_tokens.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Subscription Pricing Matrix */}
      <div>
        <div className="text-center max-w-sm mx-auto mb-6 mt-8">
          <h3 className="text-lg font-bold text-slate-800">Plan Options</h3>
          <p className="text-xs text-slate-400">Scale your knowledge indexes as your company grows</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {pricingPlans.map((plan) => (
            <Card 
              key={plan.name}
              className={`flex flex-col justify-between ${
                plan.isCurrent 
                  ? 'border-2 border-violet-600 shadow-md relative' 
                  : 'border-slate-200'
              }`}
            >
              {plan.isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                  Current Active Plan
                </span>
              )}
              <CardHeader className="text-center pb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{plan.name}</span>
                <h4 className="text-3xl font-extrabold text-slate-800 mt-2">{plan.price}<span className="text-xs font-medium text-slate-400">/mo</span></h4>
                <p className="text-[11px] text-slate-500 mt-2 min-h-8 leading-normal">{plan.description}</p>
              </CardHeader>
              <CardContent className="pt-0 flex-1">
                <ul className="space-y-2.5 text-xs text-slate-600 pt-4 border-t border-slate-50">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold shrink-0">✓</span>
                      <span className="leading-tight">{feat}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <div className="p-5 pt-0 mt-auto">
                <Button 
                  variant={plan.isCurrent ? 'primary' : 'outline'}
                  className="w-full text-xs font-bold"
                  disabled={plan.isCurrent}
                >
                  {plan.action}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
