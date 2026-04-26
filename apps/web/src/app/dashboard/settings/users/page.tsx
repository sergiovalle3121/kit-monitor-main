'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Building2, 
  Search, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Filter,
  ArrowRight,
  ShieldCheck,
  Factory
} from 'lucide-react';

// --- Types ---
interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  tenantId: string;
  lastLoginAt?: string;
  createdAt: string;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  'Admin': { bg: 'bg-purple-50', text: 'text-purple-700', icon: ShieldCheck },
  'SystemAdmin': { bg: 'bg-red-50', text: 'text-red-700', icon: Shield },
  'PlantManager': { bg: 'bg-blue-50', text: 'text-blue-700', icon: Factory },
  'ExecutiveManager': { bg: 'bg-amber-50', text: 'text-amber-700', icon: Building2 },
  'Supervisor': { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: Users },
  'Operator': { bg: 'bg-slate-50', text: 'text-slate-700', icon: Users },
};

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/governance/users');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FBFBFD] p-8">
      {/* --- Header Section --- */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-blue-600 font-medium mb-2"
            >
              <Shield className="w-4 h-4" />
              <span className="text-sm tracking-wide uppercase">System Security</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-4xl font-semibold text-[#1D1D1F] tracking-tight"
            >
              Identity & Access
            </motion.h1>
            <p className="text-[#86868B] mt-2 text-lg">Manage multi-tenant roles, plant scopes and user permissions.</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 bg-[#1D1D1F] text-white px-6 py-3 rounded-full font-medium transition-all shadow-lg shadow-black/5"
          >
            <UserPlus className="w-5 h-5" />
            Add Team Member
          </motion.button>
        </div>
      </div>

      {/* --- Stats Quick View --- */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-600' },
          { label: 'Active Sessions', value: '12', icon: ArrowRight, color: 'text-emerald-600' },
          { label: 'Security Alerts', value: '0', icon: Shield, color: 'text-slate-400' },
          { label: 'Pending Audits', value: '3', icon: Filter, color: 'text-amber-600' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-[#F2F2F7] shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-xl bg-slate-50 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-[#1D1D1F]">{stat.value}</div>
            <div className="text-sm text-[#86868B] font-medium">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* --- Main Table Container --- */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto bg-white rounded-[32px] border border-[#F2F2F7] shadow-sm overflow-hidden"
      >
        {/* Table Toolbar */}
        <div className="p-6 border-b border-[#F2F2F7] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
            <input 
              type="text"
              placeholder="Search by name, email or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[#F5F5F7] rounded-2xl border-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="p-3 bg-[#F5F5F7] rounded-xl text-[#1D1D1F] hover:bg-[#E8E8ED] transition-colors">
              <Filter className="w-4 h-4" />
            </button>
            <button className="text-sm font-medium text-blue-600 px-4 py-2 hover:bg-blue-50 rounded-lg transition-colors">
              Export CSV
            </button>
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FBFBFD] text-[#86868B] text-xs uppercase tracking-widest font-semibold">
                <th className="px-8 py-4">User Identity</th>
                <th className="px-6 py-4">System Role</th>
                <th className="px-6 py-4">Tenant / Plant</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Access</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F7]">
              <AnimatePresence mode='popLayout'>
                {filteredUsers.map((user) => {
                  const roleStyle = ROLE_COLORS[user.role] || ROLE_COLORS['Operator'];
                  return (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={user.id}
                      className="group hover:bg-[#F5F5F7]/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedUser(user)}
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-inner">
                            {user.firstName?.[0]}{user.lastName?.[0] || user.username[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-[#1D1D1F] group-hover:text-blue-600 transition-colors">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-xs text-[#86868B]">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}>
                          <roleStyle.icon className="w-3.5 h-3.5" />
                          {user.role}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-[#1D1D1F]">{user.tenantId || 'Default Tenant'}</span>
                          <span className="text-[10px] text-[#86868B] uppercase tracking-tighter">Global Access</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {user.isActive ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Active
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                            <XCircle className="w-3.5 h-3.5" />
                            Inactive
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 text-xs text-[#86868B]">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button className="p-2 text-[#86868B] hover:text-[#1D1D1F] transition-colors rounded-lg hover:bg-white shadow-sm border border-transparent hover:border-[#F2F2F7]">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && !loading && (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-medium text-[#1D1D1F]">No users found</h3>
            <p className="text-[#86868B] mt-1">Try adjusting your search or filters.</p>
          </div>
        )}

        {loading && (
          <div className="p-20 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-[#86868B] mt-4 font-medium">Synchronizing Identity Vault...</p>
          </div>
        )}
      </motion.div>

      {/* --- Simple Footer --- */}
      <div className="max-w-7xl mx-auto mt-8 flex justify-between items-center px-4">
        <p className="text-[11px] text-[#86868B] uppercase tracking-widest font-medium">
          AXOS OS CORE • SECURITY PROTOCOL 2.4
        </p>
        <div className="flex items-center gap-6 text-[11px] text-[#86868B] uppercase tracking-widest font-medium">
          <a href="#" className="hover:text-[#1D1D1F] transition-colors">Privacy</a>
          <a href="#" className="hover:text-[#1D1D1F] transition-colors">Audit Logs</a>
          <a href="#" className="hover:text-[#1D1D1F] transition-colors">API Keys</a>
        </div>
      </div>
    </div>
  );
}
