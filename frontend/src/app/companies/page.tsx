'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import { useAuth } from '@/context/AuthContext';
import { Plus, Search, Trash2, Globe, Building2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  contacts: any[];
  leads: any[];
}

export default function CompaniesPage() {
  const { fetchWithAuth, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('ALL');
  const [minEmp, setMinEmp] = useState('');
  const [maxEmp, setMaxEmp] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');

  const fetchCompanies = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/companies`);
      if (res.ok) {
        setCompanies(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchCompanies();
    }
  }, [authLoading]);

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          domain: domain || null,
          industry: industry || null,
          employeeCount: employeeCount ? parseInt(employeeCount) : null
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setName('');
        setDomain('');
        setIndustry('');
        setEmployeeCount('');
        fetchCompanies();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('Are you sure you want to delete this company? All linked contacts and leads will be affected.')) return;
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/companies/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCompanies(prev => prev.filter(c => c.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.industry && c.industry.toLowerCase().includes(search.toLowerCase())) ||
      (c.domain && c.domain.toLowerCase().includes(search.toLowerCase()));

    const matchesIndustry = industryFilter === 'ALL' || c.industry === industryFilter;
    const matchesMinEmp = !minEmp || (c.employeeCount !== null && c.employeeCount >= parseInt(minEmp));
    const matchesMaxEmp = !maxEmp || (c.employeeCount !== null && c.employeeCount <= parseInt(maxEmp));

    return matchesSearch && matchesIndustry && matchesMinEmp && matchesMaxEmp;
  });

  const totalPages = Math.ceil(filteredCompanies.length / pageSize);
  const paginatedCompanies = filteredCompanies.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const industriesList = Array.from(new Set(companies.map(c => c.industry).filter(Boolean))) as string[];

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, industryFilter, minEmp, maxEmp]);

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
            <h1 className="text-xl font-bold text-slate-800">Companies Directory</h1>
            <p className="text-xs text-slate-400">View and manage target accounts</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Company</span>
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-4 bg-white p-4.5 rounded-2xl border border-slate-200/50">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:max-w-xs">
              <Search className="w-4.5 h-4.5 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search companies by name, industry..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-primary transition-all"
              />
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <select
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                className="w-full md:w-48 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none text-slate-600 font-medium capitalize"
              >
                <option value="ALL">All Industries</option>
                {industriesList.map(ind => (
                  <option key={ind} value={ind}>{ind.toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Advanced employee count filters */}
          <div className="grid grid-cols-2 gap-3.5 pt-2.5 border-t border-slate-100 text-[10px] uppercase font-bold text-slate-400">
            <div className="space-y-1">
              <label>Min Employees</label>
              <input
                type="number"
                placeholder="e.g. 10"
                value={minEmp}
                onChange={(e) => setMinEmp(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none text-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label>Max Employees</label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={maxEmp}
                onChange={(e) => setMaxEmp(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none text-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Directory Table */}
        <div className="bg-white rounded-3xl border border-slate-200/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-4 px-6">Company Name</th>
                  <th className="py-4 px-6">Domain</th>
                  <th className="py-4 px-6">Industry</th>
                  <th className="py-4 px-6">Employees</th>
                  <th className="py-4 px-6">Linked Contacts</th>
                  <th className="py-4 px-6">Linked Leads</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {paginatedCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      No companies found matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedCompanies.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4.5 px-6 font-semibold text-slate-800 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span>{c.name}</span>
                      </td>
                      <td className="py-4.5 px-6 text-slate-500 flex-row items-center gap-1">
                        {c.domain ? (
                          <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                            <Globe className="w-3.5 h-3.5" />
                            <span>{c.domain}</span>
                          </a>
                        ) : '-'}
                      </td>
                      <td className="py-4.5 px-6 text-slate-500 capitalize">{c.industry?.toLowerCase() || '-'}</td>
                      <td className="py-4.5 px-6 text-slate-500">{c.employeeCount?.toLocaleString() || '-'}</td>
                      <td className="py-4.5 px-6 text-slate-500 font-medium">{c.contacts?.length || 0}</td>
                      <td className="py-4.5 px-6 text-slate-500 font-medium">{c.leads?.length || 0}</td>
                      <td className="py-4.5 px-6 text-right">
                        <button
                          onClick={() => handleDeleteCompany(c.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
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
              Showing Page {currentPage} of {totalPages || 1} ({filteredCompanies.length} Total Companies)
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

      {/* Add Company Modal */}
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
                <h3 className="font-bold text-slate-800 text-lg">Create Target Account</h3>
                <p className="text-xs text-slate-400">Add a new company profile to the database</p>
              </div>

              <form onSubmit={handleAddCompany} className="space-y-4 text-xs font-semibold text-slate-600">
                <div className="space-y-1.5">
                  <label className="uppercase tracking-wider">Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="uppercase tracking-wider">Domain / Website URL</label>
                  <input
                    type="text"
                    placeholder="e.g. acme.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Industry</label>
                    <input
                      type="text"
                      placeholder="e.g. SaaS"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Employees</label>
                    <input
                      type="number"
                      placeholder="e.g. 500"
                      value={employeeCount}
                      onChange={(e) => setEmployeeCount(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                    />
                  </div>
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
                    Save Account
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
