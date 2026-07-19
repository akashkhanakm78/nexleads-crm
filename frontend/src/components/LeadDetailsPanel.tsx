'use client';

import React, { useEffect, useState } from 'react';
import { X, Calendar, Phone, Mail, FileText, Send, CheckSquare, Plus, Download, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Activity {
  id: string;
  type: 'CALL' | 'EMAIL' | 'WHATSAPP' | 'MEETING' | 'VISIT' | 'TASK' | 'NOTE';
  content: string;
  createdAt: string;
  user: { name: string };
}

interface Document {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  createdAt: string;
}

interface LeadDetailsPanelProps {
  leadId: string;
  onClose: () => void;
  onUpdate: () => void;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

export default function LeadDetailsPanel({ leadId, onClose, onUpdate, fetchWithAuth }: LeadDetailsPanelProps) {
  const [lead, setLead] = useState<any>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Action form state
  const [activeTab, setActiveTab] = useState<'NOTE' | 'CALL' | 'EMAIL' | 'MEETING'>('NOTE');
  const [logContent, setLogContent] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingStart, setMeetingStart] = useState('');

  // Edit fields state
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  // File upload state
  const [uploading, setUploading] = useState(false);

  const fetchLeadDetails = async () => {
    try {
      const leadRes = await fetchWithAuth(`${BACKEND_URL}/api/leads`);
      if (leadRes.ok) {
        const allLeads = await leadRes.json();
        const current = allLeads.find((l: any) => l.id === leadId);
        if (current) {
          setLead(current);
          setTitle(current.title);
          setValue(current.value?.toString() || '');
          setStatus(current.status);
          setPriority(current.priority);
        }
      }

      const actRes = await fetchWithAuth(`${BACKEND_URL}/api/leads/${leadId}/activities`);
      if (actRes.ok) {
        setActivities(await actRes.json());
      }

      const docRes = await fetchWithAuth(`${BACKEND_URL}/api/documents?leadId=${leadId}`);
      if (docRes.ok) {
        setDocuments(await docRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadDetails();
  }, [leadId]);

  const handleUpdateLead = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          value: value ? parseFloat(value) : null,
          status,
          priority
        })
      });
      if (res.ok) {
        onUpdate();
        fetchLeadDetails();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logContent && activeTab !== 'MEETING') return;

    try {
      if (activeTab === 'MEETING') {
        if (!meetingTitle || !meetingStart) return;
        const res = await fetchWithAuth(`${BACKEND_URL}/api/meetings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: meetingTitle,
            description: logContent,
            startTime: meetingStart,
            endTime: new Date(new Date(meetingStart).getTime() + 60 * 60 * 1000).toISOString(), // +1hr
            leadId
          })
        });
        if (res.ok) {
          setMeetingTitle('');
          setMeetingStart('');
          setLogContent('');
          fetchLeadDetails();
        }
      } else {
        const res = await fetchWithAuth(`${BACKEND_URL}/api/leads/${leadId}/activities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: activeTab,
            content: logContent
          })
        });
        if (res.ok) {
          setLogContent('');
          fetchLeadDetails();
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('leadId', leadId);

    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/documents/upload`, {
        method: 'POST',
        body: formData // FetchWithAuth handles stripping default Content-Type for boundary inclusion
      });
      if (res.ok) {
        fetchLeadDetails();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'CALL':
        return <Phone className="w-3.5 h-3.5 text-blue-500" />;
      case 'EMAIL':
        return <Mail className="w-3.5 h-3.5 text-violet-500" />;
      case 'MEETING':
        return <Calendar className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 z-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />

      {/* Slide-over Container */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-xl h-full bg-slate-50 border-l border-slate-200/50 shadow-2xl flex flex-col justify-between z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 bg-white border-b border-slate-200/50 flex justify-between items-center">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400">Opportunity Profile</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleUpdateLead}
              className="block font-bold text-slate-800 text-lg focus:outline-none focus:ring-1 focus:ring-primary/20 rounded px-1 -ml-1 mt-0.5 border-none bg-transparent w-full"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Metadata Card */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/50 space-y-4 shadow-sm text-xs font-semibold text-slate-500">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="uppercase tracking-wider">Status Stage</label>
                <select
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); }}
                  onBlur={handleUpdateLead}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-none text-slate-700 bg-slate-50"
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

              <div className="space-y-1">
                <label className="uppercase tracking-wider">Deal Value ($)</label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onBlur={handleUpdateLead}
                  placeholder="0.00"
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-none text-slate-700 bg-slate-50 font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="uppercase tracking-wider">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => { setPriority(e.target.value); }}
                  onBlur={handleUpdateLead}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-none text-slate-700 bg-slate-50"
                >
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="uppercase tracking-wider">Associated Company</label>
                <div className="px-2.5 py-2.5 rounded-xl border border-transparent bg-slate-100/60 text-slate-700 font-medium">
                  {lead?.company?.name || 'Independent Lead'}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Logger */}
          <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden shadow-sm">
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              {(['NOTE', 'CALL', 'EMAIL', 'MEETING'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                    activeTab === tab
                      ? 'border-primary text-primary bg-white'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleLogActivity} className="p-4 space-y-4 text-xs font-semibold text-slate-500">
              {activeTab === 'MEETING' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="uppercase tracking-wider">Meeting Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Contract Review"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-none text-slate-700 font-medium"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="uppercase tracking-wider">Start Time</label>
                    <input
                      type="datetime-local"
                      value={meetingStart}
                      onChange={(e) => setMeetingStart(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-none text-slate-700 font-medium"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="uppercase tracking-wider">
                  {activeTab === 'MEETING' ? 'Agenda / Details' : `${activeTab.toLowerCase()} Summary`}
                </label>
                <textarea
                  placeholder={`Write details about this ${activeTab.toLowerCase()}...`}
                  value={logContent}
                  onChange={(e) => setLogContent(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none text-slate-700 font-medium custom-scrollbar"
                  required={activeTab !== 'MEETING'}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4.5 py-2 bg-primary hover:bg-blue-600 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Log Activity</span>
                </button>
              </div>
            </form>
          </div>

          {/* Document Upload panel */}
          <div className="space-y-3.5">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Attachments</h3>
              <label className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-blue-600 transition-colors cursor-pointer">
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                  </>
                )}
                <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} />
              </label>
            </div>

            <div className="space-y-2">
              {documents.length === 0 ? (
                <div className="text-center py-6 bg-white border border-dashed border-slate-200/80 rounded-2xl text-slate-400 text-xs font-medium">
                  No attachments logged
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex justify-between items-center p-3 rounded-2xl bg-white border border-slate-200/50 shadow-sm"
                  >
                    <div className="flex items-center gap-2 overflow-hidden pr-4">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 truncate">{doc.fileName}</span>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        ({doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : '0 KB'})
                      </span>
                    </div>
                    <a
                      href={`${BACKEND_URL}${doc.fileUrl}`}
                      download
                      className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="space-y-3.5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Activity Timeline</h3>
            <div className="space-y-4 relative before:absolute before:inset-y-1 before:left-3.5 before:w-[1px] before:bg-slate-200">
              {activities.length === 0 ? (
                <div className="text-center py-6 bg-white border border-dashed border-slate-200/80 rounded-2xl text-slate-400 text-xs font-medium">
                  No timeline logs recorded
                </div>
              ) : (
                activities.map((act) => (
                  <div key={act.id} className="relative flex gap-4 pl-8 group">
                    <div className="absolute left-1 top-0.5 w-6.5 h-6.5 rounded-full bg-slate-100 border-2 border-slate-50 flex items-center justify-center shadow-sm z-10">
                      {getActivityIcon(act.type)}
                    </div>
                    <div className="flex-1 bg-white p-3 rounded-2xl border border-slate-200/50 shadow-sm space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                        <span className="font-semibold text-slate-500">{act.user?.name || 'System'}</span>
                        <span>{new Date(act.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-600 leading-normal">{act.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
