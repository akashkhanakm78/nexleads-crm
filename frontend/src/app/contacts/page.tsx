'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import { useAuth } from '@/context/AuthContext';
import { Plus, Search, Trash2, Mail, Phone, Building2, PhoneCall, ChevronRight, Check, AlertCircle, FileSpreadsheet, Loader2, Play, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Company {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  remarks: string | null;
  company: { id: string; name: string };
}

export default function ContactsPage() {
  const { fetchWithAuth, loading: authLoading } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 2-Step Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

  // Step 2 fields
  const [status, setStatus] = useState('No action');
  const [remarks, setRemarks] = useState('');

  // Excel Bulk Import state
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [parsedContacts, setParsedContacts] = useState<{ company_name: string; phone: string }[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const fetchData = async () => {
    try {
      const contactsRes = await fetchWithAuth(`${BACKEND_URL}/api/contacts`);
      const companiesRes = await fetchWithAuth(`${BACKEND_URL}/api/companies`);
      if (contactsRes.ok && companiesRes.ok) {
        setContacts(await contactsRes.json());
        setCompanies(await companiesRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading]);

  useEffect(() => {
    const handleSocketUpdate = (e: any) => {
      if (e.detail.type === 'CONTACTS_UPDATE') {
        fetchData();
      }
    };
    window.addEventListener('crm-socket-update', handleSocketUpdate);
    return () => {
      window.removeEventListener('crm-socket-update', handleSocketUpdate);
    };
  }, []);

  const handleAddContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCompanyInput = selectedCompany ? selectedCompany.id : companySearch;

    if (!phone || !finalCompanyInput) return;

    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          email: email || undefined,
          phone,
          companyId: finalCompanyInput,
          status,
          remarks: remarks || undefined
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setStep(1);
        setFirstName('');
        setLastName('');
        setEmail('');
        setPhone('');
        setCompanySearch('');
        setSelectedCompany(null);
        setStatus('No action');
        setRemarks('');
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleTriggerCall = async (contact: Contact) => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Calling',
          remarks: contact.remarks || 'Initiated outbound call action'
        })
      });

      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);
        
        // Map keys dynamically matching company_name and phone variations
        const contactsToUpload = data
          .map(row => ({
            company_name: String(row.company_name || row['company_name'] || row.Company || row.company || '').trim(),
            phone: String(row.phone || row['phone'] || row.Phone || row.Number || row.number || '').trim()
          }))
          .filter(c => c.company_name && c.phone);

        if (contactsToUpload.length === 0) {
          alert('No valid contacts found. Please verify that your sheet headers include "company_name" and "phone".');
          return;
        }

        setParsedContacts(contactsToUpload);
        setIsImportPreviewOpen(true);
      } catch (err) {
        console.error(err);
        alert('Error parsing Excel file.');
      }
    };
    reader.readAsBinaryString(file);
    // Clear input value so file upload triggers again if uploaded same file twice
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (parsedContacts.length === 0) return;
    setIsImporting(true);

    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/contacts/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: parsedContacts })
      });

      if (res.ok) {
        const responseData = await res.json();
        alert(responseData.message || 'Import successful!');
        setIsImportPreviewOpen(false);
        setParsedContacts([]);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Import failed: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error while importing contacts.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/contacts/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setContacts(prev => prev.filter(c => c.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    const matchesSearch =
      fullName.includes(search.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search)) ||
      (c.company?.name && c.company.name.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesCompany = companyFilter === 'ALL' || c.company?.id === companyFilter;

    return matchesSearch && matchesStatus && matchesCompany;
  });

  const totalPages = Math.ceil(filteredContacts.length / pageSize);
  const paginatedContacts = filteredContacts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, companyFilter]);

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'No action':
        return 'bg-slate-100 text-slate-600';
      case 'Ignore':
        return 'bg-red-50 text-red-600';
      case 'Not Answer':
        return 'bg-amber-50 text-amber-600';
      case 'Calling':
        return 'bg-blue-50 text-blue-600';
      default:
        return 'bg-green-50 text-green-600';
    }
  };

  const matchingCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

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
            <h1 className="text-xl font-bold text-slate-800">Lead Point of Contacts</h1>
            <p className="text-xs text-slate-400 font-medium">Verify calling queue and route actions to visual pipeline</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Import Excel</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleImportExcel}
                className="hidden"
              />
            </label>
            <button
              onClick={() => fetchData()}
              className="flex items-center justify-center p-2.5 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 active:scale-95 transition-all cursor-pointer bg-white"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Contact</span>
            </button>
          </div>
        </div>

        {/* Search & Advanced filters */}
        <div className="space-y-4 bg-white p-4.5 rounded-2xl border border-slate-200/50">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:max-w-xs">
              <Search className="w-4.5 h-4.5 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, company, number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-primary transition-all"
              />
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full md:w-40 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none text-slate-600 font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="No action">No Action</option>
                <option value="Ignore">Ignore</option>
                <option value="Not Answer">Not Answer</option>
                <option value="Calling">Calling</option>
                <option value="Qualified">Qualified</option>
                <option value="Interested">Interested</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>

              {/* Company Filter */}
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full md:w-48 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none text-slate-600 font-medium"
              >
                <option value="ALL">All Companies</option>
                {companies.map(comp => (
                  <option key={comp.id} value={comp.id}>{comp.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Directory Table */}
        <div className="bg-white rounded-3xl border border-slate-200/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-4 px-6">Contact Name</th>
                  <th className="py-4 px-6">Company</th>
                  <th className="py-4 px-6">Phone Number</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Remarks</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {paginatedContacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No contacts found matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedContacts.map((c) => {
                    const contactName = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company?.name;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-4.5 px-6 font-semibold text-slate-800">
                          {contactName}
                        </td>
                        <td className="py-4.5 px-6 text-slate-500">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.company?.name || '-'}</span>
                          </span>
                        </td>
                        <td className="py-4.5 px-6 text-slate-600 font-semibold">
                          {c.phone || '-'}
                        </td>
                        <td className="py-4.5 px-6">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(c.status)}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-4.5 px-6 text-slate-400 truncate max-w-xs font-medium">
                          {c.remarks || 'No remarks logged'}
                        </td>
                        <td className="py-4.5 px-6 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <button
                              onClick={() => handleTriggerCall(c)}
                              className="p-2 text-primary bg-primary/5 hover:bg-primary hover:text-white rounded-xl transition-all cursor-pointer"
                              title="Call Contact"
                            >
                              <PhoneCall className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteContact(c.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
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
              Showing Page {currentPage} of {totalPages || 1} ({filteredContacts.length} Total Contacts)
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

      {/* 2-Step Create Contact Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsModalOpen(false);
                setStep(1);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md mx-4 p-6 bg-white rounded-3xl shadow-xl z-10 border border-slate-200/50 space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Create Workspace Contact</h3>
                  <p className="text-xs text-slate-400">Step {step} of 2 - {step === 1 ? 'General Details' : 'Status & Calling Stage'}</p>
                </div>
                <div className="flex gap-1 text-[10px] font-bold text-slate-400">
                  <span className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-primary' : 'bg-slate-200'}`} />
                  <span className={`w-2 h-2 rounded-full ${step === 2 ? 'bg-primary' : 'bg-slate-200'}`} />
                </div>
              </div>

              {step === 1 ? (
                <div className="space-y-4 text-xs font-semibold text-slate-600">
                  {/* Phone & Company Required alert */}
                  <div className="flex items-center gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-2xl text-blue-700 text-[11px] font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Phone Number and Company Account are required.</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Phone Number *</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 99999 88888"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                      required
                    />
                  </div>

                  <div className="space-y-1.5 relative">
                    <label className="uppercase tracking-wider">Company Account *</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search or type to create company..."
                        value={selectedCompany ? selectedCompany.name : companySearch}
                        onChange={(e) => {
                          setSelectedCompany(null);
                          setCompanySearch(e.target.value);
                          setIsCompanyDropdownOpen(true);
                        }}
                        onFocus={() => setIsCompanyDropdownOpen(true)}
                        className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium pr-10"
                        required
                      />
                      {selectedCompany && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCompany(null);
                            setCompanySearch('');
                          }}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {isCompanyDropdownOpen && (companySearch || matchingCompanies.length > 0) && (
                      <>
                        <div onClick={() => setIsCompanyDropdownOpen(false)} className="fixed inset-0 z-10" />
                        <div className="absolute left-0 right-0 mt-1 max-h-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-y-auto divide-y divide-slate-100 custom-scrollbar font-medium">
                          {matchingCompanies.map((c) => (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCompany(c);
                                setIsCompanyDropdownOpen(false);
                              }}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 text-slate-700 text-xs flex justify-between items-center"
                            >
                              <span>{c.name}</span>
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          ))}
                          {!companies.some(c => c.name.toLowerCase() === companySearch.toLowerCase()) && companySearch && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsCompanyDropdownOpen(false);
                              }}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 text-primary text-xs flex justify-between items-center"
                            >
                              <span>Create new company: "{companySearch}"</span>
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="uppercase tracking-wider">First Name</label>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="uppercase tracking-wider">Last Name</label>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Email Address</label>
                    <input
                      type="email"
                      placeholder="Optional"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                    />
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
                      type="button"
                      onClick={() => {
                        if (phone && (selectedCompany || companySearch)) {
                          setStep(2);
                        }
                      }}
                      disabled={!phone || (!selectedCompany && !companySearch)}
                      className="w-1/2 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-blue-600 transition-all cursor-pointer flex justify-center items-center gap-1 disabled:opacity-50"
                    >
                      <span>Next Step</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddContactSubmit} className="space-y-4 text-xs font-semibold text-slate-600">
                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Initial Calling Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none text-slate-700 bg-slate-50"
                    >
                      <option value="No action">No action (Default)</option>
                      <option value="Ignore">Ignore</option>
                      <option value="Not Answer">Not Answer</option>
                      <option value="Calling">Calling</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Interested">Interested</option>
                      <option value="Won">Won</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Remarks / Notes</label>
                    <textarea
                      placeholder="e.g. Discussing Q3 budget and scheduling demo call..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none text-slate-700 font-medium custom-scrollbar"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-1/2 py-3 border border-slate-200 text-slate-500 rounded-xl font-semibold hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="w-1/2 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-blue-600 transition-all cursor-pointer flex justify-center items-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                      <span>Finish & Save</span>
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Excel Import Preview Modal with Progress indicator */}
      <AnimatePresence>
        {isImportPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isImporting) {
                  setIsImportPreviewOpen(false);
                  setParsedContacts([]);
                }
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl mx-4 p-6 bg-white rounded-3xl shadow-xl z-10 border border-slate-200/50 flex flex-col max-h-[85vh] space-y-6"
            >
              <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span>Bulk Import Preview ({parsedContacts.length} Row{parsedContacts.length > 1 ? 's' : ''})</span>
                </h3>
                <p className="text-xs text-slate-400 font-medium">Verify the mapped entries below before final import validation</p>
              </div>

              {/* Progress Indicator */}
              {isImporting && (
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importing records to database...</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 3, ease: 'easeInOut' }}
                      className="bg-primary h-full rounded-full"
                    />
                  </div>
                </div>
              )}

              {/* Scrollable Preview Table */}
              <div className="flex-1 overflow-y-auto border border-slate-200/50 rounded-2xl overflow-hidden custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-4">Mapped Name (Company Name)</th>
                      <th className="py-2.5 px-4">Phone Number</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-semibold">
                    {parsedContacts.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50/40">
                        <td className="py-3 px-4 flex items-center gap-1.5 text-slate-800">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.company_name}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {c.phone}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => {
                    setIsImportPreviewOpen(false);
                    setParsedContacts([]);
                  }}
                  className="w-1/2 py-3 border border-slate-200 text-slate-500 rounded-xl font-semibold hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleConfirmImport}
                  className="w-1/2 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-blue-600 transition-all cursor-pointer flex justify-center items-center gap-1.5 disabled:opacity-40"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Writing Contacts...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm Import</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </SidebarLayout>
  );
}
