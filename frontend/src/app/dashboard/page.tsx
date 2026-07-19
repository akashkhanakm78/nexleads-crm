'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import { useAuth } from '@/context/AuthContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Users, IndianRupee, Target, Activity, Calendar, ArrowUpRight, CheckCircle2, Circle } from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface DashboardData {
  cards: {
    totalLeads: number;
    newLeads: number;
    activeDeals: number;
    conversionRate: number;
    monthlyRevenue: number;
    todaysFollowups: number;
  };
  charts: {
    funnelData: { name: string; value: number }[];
    revenueTrend: { month: string; revenue: number }[];
    teamPerformance: { name: string; tasks: number; activities: number }[];
  };
}

interface Task {
  id: string;
  title: string;
  isDone: boolean;
  dueDate: string;
}

export default function DashboardPage() {
  const { fetchWithAuth, user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const statsRes = await fetchWithAuth(`${BACKEND_URL}/api/analytics`);
      const tasksRes = await fetchWithAuth(`${BACKEND_URL}/api/tasks`);
      
      if (statsRes.ok && tasksRes.ok) {
        const statsJson = await statsRes.json();
        const tasksJson = await tasksRes.json();
        setData(statsJson);
        setTasks(tasksJson);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchDashboardData();
    }
  }, [authLoading]);

  useEffect(() => {
    const handleSocketUpdate = (e: any) => {
      // Reload dashboard metrics when leads or contacts change
      fetchDashboardData();
    };
    window.addEventListener('crm-socket-update', handleSocketUpdate);
    return () => {
      window.removeEventListener('crm-socket-update', handleSocketUpdate);
    };
  }, []);

  const handleToggleTask = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/tasks/${id}/toggle`, {
        method: 'PUT'
      });
      if (res.ok) {
        // Optimistic toggle
        setTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: !t.isDone } : t));
        // Refresh stats
        const statsRes = await fetchWithAuth(`${BACKEND_URL}/api/analytics`);
        if (statsRes.ok) {
          setData(await statsRes.json());
        }
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

  const statCards = [
    { name: 'Total Leads', value: data?.cards.totalLeads, icon: Users, color: 'from-blue-500 to-indigo-500' },
    { name: 'Active Deals', value: data?.cards.activeDeals, icon: Activity, color: 'from-amber-500 to-orange-500' },
    { name: 'Conversion Rate', value: `${data?.cards.conversionRate}%`, icon: Target, color: 'from-emerald-500 to-teal-500' },
    { name: 'Revenue', value: `₹${data?.cards.monthlyRevenue?.toLocaleString()}`, icon: IndianRupee, color: 'from-violet-500 to-fuchsia-500' },
  ];

  return (
    <SidebarLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome Back, {user?.name}!</h1>
          <p className="text-slate-500 text-sm">Here is your sales intelligence overview for today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {statCards.map((card, idx) => (
            <motion.div
              key={card.name}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="glass p-6 rounded-3xl relative overflow-hidden"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.name}</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-2">{card.value}</h3>
                </div>
                <div className={`p-3 rounded-2xl bg-gradient-to-tr ${card.color} text-white shadow-md`}>
                  <card.icon className="w-5 h-5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts and Tasks Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sales Revenue Trend Chart */}
          <div className="lg:col-span-2 glass p-6 rounded-3xl space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800">Monthly Sales Revenue</h3>
                <p className="text-xs text-slate-400">Total won deal values tracked over the months</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.charts.revenueTrend}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip formatter={(value) => value !== undefined ? [`₹${Number(value).toLocaleString()}`, 'Revenue'] : ['', '']} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Today's Tasks */}
          <div className="glass p-6 rounded-3xl flex flex-col">
            <div className="mb-6">
              <h3 className="font-bold text-slate-800">Today's Action Items</h3>
              <p className="text-xs text-slate-400">Complete follow-ups to progress deals</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {tasks.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No tasks scheduled. Nice work!
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/40 hover:bg-white border border-slate-200/40 hover:border-slate-200 transition-all cursor-pointer group"
                  >
                    {task.isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                    )}
                    <span className={`text-xs font-medium truncate ${task.isDone ? 'line-through text-slate-400' : 'text-slate-600'}`}>
                      {task.title}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Lower section: Pipeline Funnel Stats & Team Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Funnel list */}
          <div className="glass p-6 rounded-3xl space-y-6">
            <div>
              <h3 className="font-bold text-slate-800">Sales Pipeline Funnel</h3>
              <p className="text-xs text-slate-400">Total lead counts at each stage</p>
            </div>
            <div className="space-y-4">
              {data?.charts.funnelData.map((stage) => {
                const total = data.cards.totalLeads || 1;
                const percentage = Math.round((stage.value / total) * 100);
                return (
                  <div key={stage.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600 capitalize">{stage.name.toLowerCase()}</span>
                      <span className="text-slate-400">{stage.value} leads ({percentage}%)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team performance leaderboard */}
          <div className="glass p-6 rounded-3xl space-y-6">
            <div>
              <h3 className="font-bold text-slate-800">Agent Performance Leaderboard</h3>
              <p className="text-xs text-slate-400">Activity volume generated per sales agent</p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts.teamPerformance}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="activities" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
