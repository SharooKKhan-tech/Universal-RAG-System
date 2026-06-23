import React, { useState, useEffect, useCallback } from 'react';
import { Users as UsersIcon, UserPlus, Shield, Mail, Trash2, RefreshCw, AlertCircle, CheckCircle, Clock, ChevronDown } from 'lucide-react';
import apiClient from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  CLIENT_ADMIN: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
};

const ROLES = ['CLIENT_ADMIN'];

export const UserManagement: React.FC = () => {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: 'CLIENT_ADMIN' });
  const [inviting, setInviting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/users');
      setUsers(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError('');
    try {
      await apiClient.post('/users/invite', invite);
      flash('User invited successfully!');
      setShowInvite(false);
      setInvite({ name: '', email: '', role: 'CLIENT_ADMIN' });
      fetchUsers();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await apiClient.patch(`/users/${userId}/role`, { role: newRole });
      flash('Role updated');
      fetchUsers();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm('Deactivate this user?')) return;
    try {
      await apiClient.patch(`/users/${userId}/deactivate`);
      flash('User deactivated');
      fetchUsers();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to deactivate user');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="bg-violet-500/10 p-2 rounded-xl border border-violet-500/20">
              <UsersIcon className="h-6 w-6 text-violet-600" />
            </div>
            Team Members
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage users and their access roles</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm transition border border-slate-200 shadow-xs cursor-pointer">
            <RefreshCw className="h-4 w-4 text-slate-500" /> Refresh
          </button>
          <button
            id="invite-user-btn"
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition"
          >
            <UserPlus className="h-4 w-4" /> Invite User
          </button>
        </div>
      </div>

      {/* Alerts */}
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

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-violet-600" /> Invite Team Member
            </h2>
            <form onSubmit={handleInvite} className="space-y-4">
              {[
                { label: 'Full Name', key: 'name', type: 'text', placeholder: 'John Doe' },
                { label: 'Email Address', key: 'email', type: 'email', placeholder: 'john@company.com' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                  <input
                    type={type}
                    required
                    value={(invite as any)[key]}
                    onChange={e => setInvite(i => ({ ...i, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                <select
                  value={invite.role}
                  onChange={e => setInvite(i => ({ ...i, role: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                >
                  {ROLES.map(r => <option key={r} value={r} className="bg-white text-slate-800">{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvite(false)} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm transition border border-transparent cursor-pointer">Cancel</button>
                <button id="invite-submit" type="submit" disabled={inviting} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition cursor-pointer">
                  {inviting ? 'Inviting…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: users.length, color: 'violet' },
          { label: 'Active', value: users.filter(u => u.is_active).length, color: 'emerald' },
          { label: 'Admins', value: users.filter(u => u.role.includes('ADMIN')).length, color: 'blue' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className={`text-2xl font-bold ${color === 'violet' ? 'text-violet-600' : color === 'emerald' ? 'text-emerald-600' : 'text-blue-600'}`}>{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-sm font-semibold text-slate-800">Team Members ({users.length})</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <UsersIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No team members yet. Invite someone!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map(u => (
              <div key={u.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition">
                {/* Avatar */}
                <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 truncate">{u.name}</span>
                    {u.id === me?.id && <span className="text-[10px] bg-violet-500/20 text-violet-600 border border-violet-500/30 px-1.5 py-0.5 rounded-full font-semibold">You</span>}
                    {!u.is_active && <span className="text-[10px] bg-rose-500/10 text-rose-600 border border-rose-500/30 px-1.5 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <Mail className="h-3 w-3" /> {u.email}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Role badge / changer */}
                  {u.role === 'SUPER_ADMIN' ? (
                    <span className={`text-xs font-semibold border px-2.5 py-1 rounded-lg ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      SUPER ADMIN
                    </span>
                  ) : (
                    <div className="relative">
                      <select
                        value={u.role}
                        disabled={u.id === me?.id}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className={`text-xs font-semibold border px-2.5 py-1 rounded-lg appearance-none pr-6 bg-slate-50 border-slate-200 text-slate-700 cursor-pointer disabled:cursor-default`}
                      >
                        {ROLES.map(r => <option key={r} value={r} className="bg-white text-slate-800">{r.replace('_', ' ')}</option>)}
                      </select>
                      {u.id !== me?.id && <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none opacity-60 text-slate-500" />}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    {new Date(u.created_at).toLocaleDateString()}
                  </div>
                  {u.id !== me?.id && u.is_active && (
                    <button
                      onClick={() => handleDeactivate(u.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                      title="Deactivate user"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role legend */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
        <h3 className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-2">
          <Shield className="h-3.5 w-3.5" /> Role Permissions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { role: 'SUPER_ADMIN', desc: 'System-wide owner: manage all clients and global telemetry' },
            { role: 'CLIENT_ADMIN', desc: 'Company/Client owner: manage projects, invite users, view logs' },
          ].map(({ role, desc }) => (
            <div key={role} className="flex items-start gap-2">
              <span className={`text-[10px] font-bold border px-2 py-0.5 rounded shrink-0 mt-0.5 ${ROLE_COLORS[role]}`}>{role.replace('_', ' ')}</span>
              <span className="text-xs text-slate-600">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
