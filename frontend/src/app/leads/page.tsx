'use client';

import React, { useEffect, useState, useCallback } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import LeadDetailsPanel from '@/components/LeadDetailsPanel';
import SearchableDropdown from '@/components/SearchableDropdown';
import { useAuth } from '@/context/AuthContext';
import { Plus, Search, Filter, Trash2, ArrowUpDown, PhoneCall, CalendarPlus, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const CONTACT_STATUSES = [
  'Contacted',
  'Not Answer',
  'Call Later',
  'Not Availabe',
  'Rejected',
];

interface Activity {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  user?: { name: string };
}

interface Lead {
  id: string;
  title: string;
  status: string;
  priority: string;
  contactStatus: string | null;
  value: number | null;
  company: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string; email: string; phone?: string } | null;
  activities: Activity[];
  createdAt: string;
}

interface Company {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
}

export default function LeadsPage() {
  const { fetchWithAuth, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Meeting scheduler modal state
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [meetingLeadId, setMeetingLeadId] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingStart, setMeetingStart] = useState('');
  const [meetingEnd, setMeetingEnd] = useState('');
  const [meetingDesc, setMeetingDesc] = useState('');

  // Search & Filter state (all sent to backend)
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [contactStatusFilter, setContactStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [minVal, setMinVal] = useState('');
  const [maxVal, setMaxVal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Modal form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newStatus, setNewStatus] = useState('NEW');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newContactStatus, setNewContactStatus] = useState('');
  const [newCompanyId, setNewCompanyId] = useState('');
  const [newContactId, setNewContactId] = useState('');

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (contactStatusFilter !== 'ALL') params.set('contactStatus', contactStatusFilter);
    if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);
    if (minVal) params.set('minVal', minVal);
    if (maxVal) params.set('maxVal', maxVal);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return params.toString();
  }, [search, statusFilter, contactStatusFilter, priorityFilter, minVal, maxVal, startDate, endDate]);

  const fetchLeads = useCallback(async () => {
    try {
      const qs = buildQueryParams();
      const leadsRes = await fetchWithAuth(`${BACKEND_URL}/api/leads${qs ? `?${qs}` : ''}`);
      if (leadsRes.ok) {
        setLeads(await leadsRes.json());
      }
    } catch (e) {
      console.error(e);
    }
  }, [buildQueryParams, fetchWithAuth]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, companiesRes, contactsRes] = await Promise.all([
        fetchWithAuth(`${BACKEND_URL}/api/leads${buildQueryParams() ? `?${buildQueryParams()}` : ''}`),
        fetchWithAuth(`${BACKEND_URL}/api/companies`),
        fetchWithAuth(`${BACKEND_URL}/api/contacts`),
      ]);

      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (companiesRes.ok) setCompanies(await companiesRes.json());
      if (contactsRes.ok) setContacts(await contactsRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, fetchWithAuth]);

  const handleCallAction = async (leadId: string) => {
    try {
      await fetchWithAuth(`${BACKEND_URL}/api/leads/${leadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CALL',
          content: 'Initiated outbound call to contact.'
        })
      });
      fetchLeads();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingTitle || !meetingStart || !meetingEnd || !meetingLeadId) return;

    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meetingTitle,
          description: meetingDesc || null,
          startTime: meetingStart,
          endTime: meetingEnd,
          leadId: meetingLeadId
        })
      });

      if (res.ok) {
        setIsMeetingModalOpen(false);
        setMeetingTitle('');
        setMeetingStart('');
        setMeetingEnd('');
        setMeetingDesc('');
        setMeetingLeadId('');
        fetchLeads();
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading]);

  // Re-fetch leads when any filter/search changes
  useEffect(() => {
    if (!authLoading) {
      setCurrentPage(1);
      fetchLeads();
    }
  }, [search, statusFilter, contactStatusFilter, priorityFilter, minVal, maxVal, startDate, endDate]);

  useEffect(() => {
    const handleSocketUpdate = (e: any) => {
      if (e.detail.type === 'LEADS_UPDATE' || e.detail.type === 'CONTACTS_UPDATE') {
        fetchLeads();
      }
    };
    window.addEventListener('crm-socket-update', handleSocketUpdate);
    return () => {
      window.removeEventListener('crm-socket-update', handleSocketUpdate);
    };
  }, [fetchLeads]);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          value: newValue,
          status: newStatus,
          priority: newPriority,
          contactStatus: newContactStatus || null,
          companyId: newCompanyId || undefined,
          contactId: newContactId || undefined
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setNewTitle('');
        setNewValue('');
        setNewStatus('NEW');
        setNewPriority('MEDIUM');
        setNewContactStatus('');
        setNewCompanyId('');
        setNewContactId('');
        fetchLeads();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/leads/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setLeads(prev => prev.filter(l => l.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // All filtering now done server-side; pagination is client-side on returned results
  const totalPages = Math.ceil(leads.length / pageSize);
  const paginatedLeads = leads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">High</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">Medium</span>;
      case 'LOW':
        default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">Low</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'WON':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">Won</span>;
      case 'LOST':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700">Lost</span>;
      case 'NEGOTIATION':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700">Negotiation</span>;
      case 'PROPOSAL':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">Proposal</span>;
      case 'QUALIFIED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700">Qualified</span>;
      case 'CONTACTED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">Contacted</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 capitalize">{status.toLowerCase()}</span>;
    }
  };

  const getContactStatusBadge = (cs: string | null) => {
    if (!cs) return <span className="text-slate-300 text-[10px]">—</span>;
    const colors: Record<string, string> = {
      'Contacted': 'bg-emerald-100 text-emerald-700',
      'Not Answer': 'bg-amber-100 text-amber-700',
      'Call Later': 'bg-sky-100 text-sky-700',
      'Not Availabe': 'bg-orange-100 text-orange-700',
      'Rejected': 'bg-rose-100 text-rose-700',
    };
    const cls = colors[cs] || 'bg-slate-100 text-slate-600';
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{cs}</span>;
  };

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
        {/* Page title and button */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Leads Directory</h1>
            <p className="text-xs text-slate-400">View and manage target lead accounts</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLeads()}
              className="flex items-center justify-center p-2.5 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 active:scale-95 transition-all cursor-pointer bg-white"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Lead</span>
            </button>
          </div>
        </div>

        {/* Filter and search bar */}
        <div className="space-y-4 bg-white p-4.5 rounded-2xl border border-slate-200/50">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:max-w-xs">
              <Search className="w-4.5 h-4.5 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search leads, logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-primary transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              {/* Stage Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full md:w-36 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none text-slate-600 font-medium"
              >
                <option value="ALL">All Stages</option>
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="PROPOSAL">Proposal</option>
                <option value="NEGOTIATION">Negotiation</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
              </select>

              {/* Contact Status Filter */}
              <select
                value={contactStatusFilter}
                onChange={(e) => setContactStatusFilter(e.target.value)}
                className="w-full md:w-40 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none text-slate-600 font-medium"
              >
                <option value="ALL">All Call Status</option>
                {CONTACT_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Priority Filter */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full md:w-36 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none text-slate-600 font-medium"
              >
                <option value="ALL">All Priorities</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-2.5 border-t border-slate-100 text-[10px] uppercase font-bold text-slate-400">
            <div className="space-y-1">
              <label>Min Value (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={minVal}
                onChange={(e) => setMinVal(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none text-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label>Max Value (₹)</label>
              <input
                type="number"
                placeholder="No limit"
                value={maxVal}
                onChange={(e) => setMaxVal(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none text-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none text-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none text-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-3xl border border-slate-200/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-4 px-6">Lead Title</th>
                  <th className="py-4 px-6">Company</th>
                  <th className="py-4 px-6">Contact</th>
                  <th className="py-4 px-6">Phone</th>
                  <th className="py-4 px-6">Value</th>
                  <th className="py-4 px-6">Stage</th>
                  <th className="py-4 px-6">Call Status</th>
                  <th className="py-4 px-6">Priority</th>
                  <th className="py-4 px-6">Last Log</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {paginatedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-400">
                      No leads found matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedLeads.map((lead) => {
                    const lastActivity = lead.activities?.[0];
                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/40 transition-colors">
                        <td onClick={() => setSelectedLeadId(lead.id)} className="py-4.5 px-6 font-semibold text-slate-800 cursor-pointer">{lead.title}</td>
                        <td onClick={() => setSelectedLeadId(lead.id)} className="py-4.5 px-6 text-slate-500 cursor-pointer">{lead.company?.name || '-'}</td>
                        <td onClick={() => setSelectedLeadId(lead.id)} className="py-4.5 px-6 text-slate-500 cursor-pointer">{lead.contact?.email || '-'}</td>
                        <td onClick={() => setSelectedLeadId(lead.id)} className="py-4.5 px-6 text-slate-500 cursor-pointer">{lead.contact?.phone || '-'}</td>
                        <td onClick={() => setSelectedLeadId(lead.id)} className="py-4.5 px-6 font-semibold text-slate-800 cursor-pointer">
                          {lead.value ? `₹${lead.value.toLocaleString()}` : '-'}
                        </td>
                        <td onClick={() => setSelectedLeadId(lead.id)} className="py-4.5 px-6 cursor-pointer">{getStatusBadge(lead.status)}</td>
                        <td onClick={() => setSelectedLeadId(lead.id)} className="py-4.5 px-6 cursor-pointer">{getContactStatusBadge(lead.contactStatus)}</td>
                        <td onClick={() => setSelectedLeadId(lead.id)} className="py-4.5 px-6 cursor-pointer">{getPriorityBadge(lead.priority)}</td>
                        <td onClick={() => setSelectedLeadId(lead.id)} className="py-4.5 px-6 cursor-pointer max-w-[180px]">
                          {lastActivity ? (
                            <div>
                              <p className="text-slate-600 truncate font-medium" title={lastActivity.content}>{lastActivity.content}</p>
                              <p className="text-[10px] text-slate-400">{new Date(lastActivity.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-4.5 px-6 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCallAction(lead.id);
                              }}
                              className="p-2 text-primary bg-primary/5 hover:bg-primary hover:text-white rounded-xl transition-all cursor-pointer"
                              title="Log Call"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMeetingLeadId(lead.id);
                                setMeetingTitle(`Sync: ${lead.title}`);
                                setIsMeetingModalOpen(true);
                              }}
                              className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-600 hover:text-white rounded-xl transition-all cursor-pointer"
                              title="Schedule Meeting"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLead(lead.id);
                              }}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center bg-white px-6 py-4 rounded-2xl border border-slate-200/50 text-xs font-semibold text-slate-500">
            <span>
              Showing Page {currentPage} of {totalPages || 1} ({leads.length} Total Leads)
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

      {/* Add Lead Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md mx-4 p-6 bg-white rounded-3xl shadow-xl z-10 border border-slate-200/50 space-y-6"
            >
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Create New Lead</h3>
                <p className="text-xs text-slate-400">Add a new deal opportunity to the CRM</p>
              </div>

              <form onSubmit={handleAddLead} className="space-y-4 text-xs font-semibold text-slate-600">
                <div className="space-y-1.5">
                  <label className="uppercase tracking-wider">Opportunity Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Enterprise License Deal"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Deal Value (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 50000"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Priority</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none text-slate-600"
                    >
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Company</label>
                    <SearchableDropdown
                      options={companies.map(c => ({ id: c.id, name: c.name }))}
                      selectedId={newCompanyId}
                      onChange={(id) => setNewCompanyId(id)}
                      placeholder="Select Company"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Contact</label>
                    <SearchableDropdown
                      options={contacts.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
                      selectedId={newContactId}
                      onChange={(id) => setNewContactId(id)}
                      placeholder="Select Contact"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Stage</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none text-slate-600"
                    >
                      <option value="NEW">New</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="QUALIFIED">Qualified</option>
                      <option value="PROPOSAL">Proposal</option>
                      <option value="NEGOTIATION">Negotiation</option>
                      <option value="WON">Won</option>
                      <option value="LOST">Lost</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Call Status</label>
                    <select
                      value={newContactStatus}
                      onChange={(e) => setNewContactStatus(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none text-slate-600"
                    >
                      <option value="">None</option>
                      {CONTACT_STATUSES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
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
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lead Details Slide-over Panel */}
      <AnimatePresence>
        {selectedLeadId && (
          <LeadDetailsPanel
            leadId={selectedLeadId}
            onClose={() => setSelectedLeadId(null)}
            onUpdate={fetchLeads}
            fetchWithAuth={fetchWithAuth}
          />
        )}
      </AnimatePresence>

      {/* Schedule Meeting Modal */}
      <AnimatePresence>
        {isMeetingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMeetingModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md mx-4 p-6 bg-white rounded-3xl shadow-xl z-10 border border-slate-200/50 space-y-6"
            >
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Schedule Lead Meeting</h3>
                <p className="text-xs text-slate-400">Log a new event directly on this opportunity</p>
              </div>

              <form onSubmit={handleCreateMeeting} className="space-y-4 text-xs font-semibold text-slate-600">
                <div className="space-y-1.5">
                  <label className="uppercase tracking-wider">Meeting Title</label>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="uppercase tracking-wider">Agenda / Description</label>
                  <textarea
                    placeholder="Enter details..."
                    value={meetingDesc}
                    onChange={(e) => setMeetingDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium custom-scrollbar"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Start Time</label>
                    <input
                      type="datetime-local"
                      value={meetingStart}
                      onChange={(e) => setMeetingStart(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none text-slate-600"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">End Time</label>
                    <input
                      type="datetime-local"
                      value={meetingEnd}
                      onChange={(e) => setMeetingEnd(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none text-slate-600"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsMeetingModalOpen(false)}
                    className="w-1/2 py-3 border border-slate-200 text-slate-500 rounded-xl font-semibold hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-blue-600 transition-all cursor-pointer"
                  >
                    Save Meeting
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
