'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import { useAuth } from '@/context/AuthContext';
import { Plus, Search, Shield, ShieldCheck, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function SettingsPage() {
  const { fetchWithAuth, user: loggedUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('VIEWER');
  const [password, setPassword] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/users`);
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchUsers();
    }
  }, [authLoading]);

  useEffect(() => {
    const handleSocketUpdate = (e: any) => {
      if (e.detail.type === 'USERS_UPDATE') {
        fetchUsers();
      }
    };
    window.addEventListener('crm-socket-update', handleSocketUpdate);
    return () => {
      window.removeEventListener('crm-socket-update', handleSocketUpdate);
    };
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, password })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setName('');
        setEmail('');
        setRole('VIEWER');
        setPassword('');
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      // Optimistic update
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));

      const res = await fetchWithAuth(`${BACKEND_URL}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });

      if (!res.ok) {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
      fetchUsers();
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter]);

  const getRoleBadge = (userRole: string) => {
    switch (userRole) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
            <ShieldCheck className="w-3 h-3" />
            <span>Admin</span>
          </span>
        );
      case 'SALES_MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
            <Shield className="w-3 h-3" />
            <span>Manager</span>
          </span>
        );
      case 'SALES_EXECUTIVE':
      case 'MARKETING_EXECUTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
            <User className="w-3 h-3" />
            <span>Executive</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
            <User className="w-3 h-3" />
            <span>Viewer</span>
          </span>
        );
    }
  };

  const isAdmin = loggedUser?.role === 'ADMIN' || loggedUser?.role === 'SUPER_ADMIN';

  if (loading || authLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Workspace Settings</h1>
            <p className="text-xs text-slate-400">Configure roles and user workspace permissions</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create User</span>
            </button>
          )}
        </div>

        {/* Directory Filters */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/50">
          <div className="relative w-full md:max-w-xs">
            <Search className="w-4.5 h-4.5 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-primary transition-all"
            />
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full md:w-40 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none text-slate-600 font-medium"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="SALES_MANAGER">Sales Manager</option>
              <option value="SALES_EXECUTIVE">Sales Exec</option>
              <option value="MARKETING_EXECUTIVE">Marketing Exec</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-3xl border border-slate-200/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6">Role status</th>
                  <th className="py-4 px-6">Joined Date</th>
                  {isAdmin && <th className="py-4 px-6 text-right">Role Assignment</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4.5 px-6 font-semibold text-slate-800">{u.name}</td>
                      <td className="py-4.5 px-6 text-slate-500">{u.email}</td>
                      <td className="py-4.5 px-6">{getRoleBadge(u.role)}</td>
                      <td className="py-4.5 px-6 text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      {isAdmin && (
                        <td className="py-4.5 px-6 text-right">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={u.id === loggedUser?.id}
                            className="px-2 py-1.5 rounded-xl border border-slate-200 focus:outline-none text-[11px] font-semibold text-slate-600 bg-slate-50 disabled:opacity-40"
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="SALES_MANAGER">Sales Manager</option>
                            <option value="SALES_EXECUTIVE">Sales Exec</option>
                            <option value="MARKETING_EXECUTIVE">Marketing Exec</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center bg-white px-6 py-4 rounded-2xl border border-slate-200/50 text-xs font-semibold text-slate-500">
            <span>
              Showing Page {currentPage} of {totalPages || 1} ({filteredUsers.length} Total Users)
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3.5 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3.5 py-2 bg-primary text-white rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md mx-4 p-6 bg-white rounded-3xl shadow-xl z-10 border border-slate-200/50 space-y-6"
            >
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Create Workspace User</h3>
                <p className="text-xs text-slate-400">Add a new user credential to the workspace</p>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-semibold text-slate-600">
                <div className="space-y-1.5">
                  <label className="uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Richard Hendricks"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. richard@piedpiper.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="uppercase tracking-wider">User Password</label>
                  <input
                    type="password"
                    placeholder="e.g. SecretPassword123"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="uppercase tracking-wider">Workspace Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none text-slate-600"
                    required
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="SALES_MANAGER">Sales Manager</option>
                    <option value="SALES_EXECUTIVE">Sales Executive</option>
                    <option value="MARKETING_EXECUTIVE">Marketing Executive</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-1/2 py-3 border border-slate-200 text-slate-500 rounded-xl font-semibold hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-blue-600 transition-all cursor-pointer"
                  >
                    Save User
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </SidebarLayout>
  );
}
