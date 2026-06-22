import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Cpu, Mail, Lock, User as UserIcon, Building2, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', company_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.company_name);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { id: 'reg-name', label: 'Full name', field: 'name', type: 'text', icon: UserIcon, placeholder: 'John Doe' },
    { id: 'reg-company', label: 'Company name', field: 'company_name', type: 'text', icon: Building2, placeholder: 'Acme Corp' },
    { id: 'reg-email', label: 'Work email', field: 'email', type: 'email', icon: Mail, placeholder: 'you@company.com' },
    { id: 'reg-password', label: 'Password', field: 'password', type: 'password', icon: Lock, placeholder: 'min 6 characters' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950/30 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-violet-600/20 p-3 rounded-2xl border border-violet-500/30 mb-4">
            <Cpu className="h-8 w-8 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Universal RAG System</h1>
          <p className="text-slate-400 text-sm mt-1">Create your enterprise account</p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {['Unlimited projects', 'Multi-LLM support', 'Audit logs', 'Widget embed'].map(b => (
            <div key={b} className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              {b}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">Get started for free</h2>

          {error && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm px-4 py-3 rounded-xl mb-5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(({ id, label, field, type, icon: Icon, placeholder }) => (
              <div key={field}>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id={id}
                    type={type}
                    required
                    value={(form as any)[field]}
                    onChange={set(field)}
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition"
                    placeholder={placeholder}
                  />
                </div>
              </div>
            ))}

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Creating account…</> : 'Create account'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
