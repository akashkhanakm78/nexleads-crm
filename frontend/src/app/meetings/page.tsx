'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import { useAuth } from '@/context/AuthContext';
import { Plus, Trash2, Calendar, Clock, AlignLeft, User, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Lead {
  id: string;
  title: string;
  contact?: {
    phone: string | null;
  } | null;
}

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  lead: { id: string; title: string; company: { name: string } | null } | null;
}

export default function MeetingsPage() {
  const { fetchWithAuth, loading: authLoading } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);

  const fetchData = async () => {
    try {
      const meetingsRes = await fetchWithAuth(`${BACKEND_URL}/api/meetings`);
      const leadsRes = await fetchWithAuth(`${BACKEND_URL}/api/leads`);
      if (meetingsRes.ok && leadsRes.ok) {
        setMeetings(await meetingsRes.json());
        setLeads(await leadsRes.json());
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
      if (e.detail.type === 'MEETINGS_UPDATE') {
        fetchData();
      }
    };
    window.addEventListener('crm-socket-update', handleSocketUpdate);
    return () => {
      window.removeEventListener('crm-socket-update', handleSocketUpdate);
    };
  }, []);

  const handleAddMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startTime || !endTime) return;

    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          startTime,
          endTime,
          leadId: selectedLead ? selectedLead.id : undefined
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setTitle('');
        setDescription('');
        setStartTime('');
        setEndTime('');
        setSelectedLead(null);
        setLeadSearch('');
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this meeting?')) return;
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/meetings/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setMeetings(prev => prev.filter(m => m.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
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
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Meetings Calendar</h1>
            <p className="text-xs text-slate-400">View and schedule upcoming client meetings</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Meeting</span>
          </button>
        </div>

        {/* Meetings List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white border border-slate-200/50 rounded-3xl text-slate-400 text-xs font-semibold shadow-sm">
              No upcoming meetings scheduled.
            </div>
          ) : (
            meetings.map((meeting) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-5 rounded-3xl border border-slate-200/50 shadow-sm flex flex-col justify-between gap-4 group"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-800 text-sm tracking-tight leading-snug group-hover:text-primary transition-colors">
                      {meeting.title}
                    </h3>
                    <button
                      onClick={() => handleDeleteMeeting(meeting.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {meeting.description && (
                    <div className="flex gap-2 text-xs font-medium text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <AlignLeft className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                      <p className="line-clamp-2 leading-relaxed">{meeting.description}</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3.5 space-y-2 text-[11px] font-semibold text-slate-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-600">
                      {new Date(meeting.startTime).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-600">
                      {`${new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(
                        meeting.endTime
                      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  </div>
                  {meeting.lead && (
                    <div className="flex items-center gap-2 pt-1 border-t border-dashed border-slate-100">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-500 truncate font-semibold">
                        {meeting.lead.title} ({meeting.lead.company?.name || 'Independent'})
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Schedule Meeting Modal */}
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
                <h3 className="font-bold text-slate-800 text-lg">Schedule Meeting</h3>
                <p className="text-xs text-slate-400">Log a new client sync or demo call</p>
              </div>

              <form onSubmit={handleAddMeeting} className="space-y-4 text-xs font-semibold text-slate-600">
                <div className="space-y-1.5">
                  <label className="uppercase tracking-wider">Meeting Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Sales Pitch Sync"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="uppercase tracking-wider">Agenda / Description</label>
                  <textarea
                    placeholder="Provide details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium custom-scrollbar"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">Start Time</label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none text-slate-600"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="uppercase tracking-wider">End Time</label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none text-slate-600"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5 relative">
                  <label className="uppercase tracking-wider">Link to Opportunity (Lead)</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search and link to lead..."
                      value={selectedLead ? selectedLead.title : leadSearch}
                      onChange={(e) => {
                        setSelectedLead(null);
                        setLeadSearch(e.target.value);
                        setIsLeadDropdownOpen(true);
                      }}
                      onFocus={() => setIsLeadDropdownOpen(true)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-slate-700 font-medium pr-10"
                    />
                    {selectedLead && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLead(null);
                          setLeadSearch('');
                        }}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {isLeadDropdownOpen && (
                    <>
                      <div onClick={() => setIsLeadDropdownOpen(false)} className="fixed inset-0 z-10" />
                      <div className="absolute left-0 right-0 mt-1 max-h-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-y-auto divide-y divide-slate-100 custom-scrollbar font-medium">
                        {leads
                          .filter(l => 
                            l.title.toLowerCase().includes(leadSearch.toLowerCase()) ||
                            (l.contact?.phone && l.contact.phone.includes(leadSearch))
                          )
                          .map((l) => (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => {
                                setSelectedLead(l);
                                setIsLeadDropdownOpen(false);
                              }}
                              className="w-full px-3.5 py-2 text-left hover:bg-slate-50 text-slate-700 text-xs flex justify-between items-center"
                            >
                              <span>{l.title}</span>
                              {l.contact?.phone && (
                                <span className="text-[10px] text-slate-400 font-semibold">{l.contact.phone}</span>
                              )}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
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
