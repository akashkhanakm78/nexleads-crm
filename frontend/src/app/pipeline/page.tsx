'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import LeadDetailsPanel from '@/components/LeadDetailsPanel';
import { useAuth } from '@/context/AuthContext';
import { ChevronRight, ChevronLeft, Target, Award, ShieldAlert, ArrowLeftRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Lead {
  id: string;
  title: string;
  status: string;
  priority: string;
  value: number | null;
  company: { name: string } | null;
}

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

export default function PipelinePage() {
  const { fetchWithAuth, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const fetchLeads = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/leads`);
      if (res.ok) {
        setLeads(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchLeads();
    }
  }, [authLoading]);

  const handleMoveStage = async (leadId: string, currentStatus: string, direction: 'forward' | 'backward') => {
    const currentIndex = STAGES.indexOf(currentStatus);
    let nextIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex < 0 || nextIndex >= STAGES.length) return;

    const nextStatus = STAGES[nextIndex];

    try {
      // Optimistic state update
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: nextStatus } : l));

      const res = await fetchWithAuth(`${BACKEND_URL}/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!res.ok) {
        // Rollback on failure
        fetchLeads();
      }
    } catch (e) {
      console.error(e);
      fetchLeads();
    }
  };

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'border-l-4 border-l-red-500';
      case 'MEDIUM':
        return 'border-l-4 border-l-amber-500';
      case 'LOW':
      default:
        return 'border-l-4 border-l-slate-300';
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
      <div className="space-y-6 h-full flex flex-col">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-800">Visual Sales Pipeline</h1>
          <p className="text-xs text-slate-400">Track deal progress and transition stages dynamically</p>
        </div>

        {/* Board */}
        <div className="flex-1 overflow-x-auto flex gap-5 pb-6 items-start custom-scrollbar">
          {STAGES.map((stage) => {
            const stageLeads = leads.filter(l => l.status === stage);
            const totalValue = stageLeads.reduce((acc, curr) => acc + (curr.value || 0), 0);

            return (
              <div key={stage} className="w-72 shrink-0 bg-slate-100/60 rounded-3xl p-4 flex flex-col max-h-[72vh] border border-slate-200/30">
                {/* Column header */}
                <div className="flex justify-between items-center mb-4 px-1">
                  <div>
                    <h3 className="font-bold text-xs text-slate-800 tracking-tight capitalize">
                      {stage.toLowerCase()}
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                      {stageLeads.length} Deals • ₹{totalValue.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Cards list */}
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar">
                  {stageLeads.length === 0 ? (
                    <div className="border border-dashed border-slate-300/60 rounded-2xl p-6 text-center text-[10px] text-slate-400 font-medium">
                      No deals here
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <motion.div
                        key={lead.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`bg-white p-4 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col justify-between gap-3 cursor-pointer hover:shadow-md transition-all ${getPriorityBorder(
                          lead.priority
                        )}`}
                      >
                        <div>
                          <h4 className="font-semibold text-xs text-slate-800 tracking-tight leading-snug truncate">
                            {lead.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium">{lead.company?.name || 'Independent'}</p>
                        </div>

                        <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                          <span className="text-xs font-bold text-slate-800">
                            {lead.value ? `₹${lead.value.toLocaleString()}` : '₹-'}
                          </span>

                          {/* Move action buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              disabled={STAGES.indexOf(stage) === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveStage(lead.id, stage, 'backward');
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={STAGES.indexOf(stage) === STAGES.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveStage(lead.id, stage, 'forward');
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
    </SidebarLayout>
  );
}
