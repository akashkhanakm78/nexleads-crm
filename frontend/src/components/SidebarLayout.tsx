'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Users, GitFork, Settings, LogOut, Briefcase,
  Building2, Contact, Calendar, Bell, BellRing, Check, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, fetchWithAuth } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/notifications`);
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/notifications/${id}/read`, {
        method: 'PUT'
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Leads', href: '/leads', icon: Users },
    { name: 'Pipeline', href: '/pipeline', icon: GitFork },
    { name: 'Companies', href: '/companies', icon: Building2 },
    { name: 'Contacts', href: '/contacts', icon: Contact },
    { name: 'Meetings', href: '/meetings', icon: Calendar },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="glass flex flex-col justify-between border-r border-slate-200/50 shrink-0 overflow-hidden relative"
      >
        {/* Collapse toggle button */}
        <button
          onClick={() => setCollapsed(prev => !prev)}
          className="absolute -right-3.5 top-20 z-30 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:text-primary hover:border-primary transition-all cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <ChevronLeft className="w-3.5 h-3.5" />
          }
        </button>

        <div className={`flex flex-col gap-0 ${collapsed ? 'px-3 pt-5' : 'px-6 pt-6'}`}>
          {/* Logo */}
          <div className={`flex items-center gap-3 mb-10 ${collapsed ? 'justify-center' : ''}`}>
            <div className="bg-primary/10 text-primary p-2.5 rounded-2xl shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  <h1 className="font-bold text-lg leading-tight tracking-tight text-slate-800">NexLeads</h1>
                  <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-400">Sales Intelligence</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    title={collapsed ? item.name : undefined}
                    className={`relative flex items-center gap-3 py-3 rounded-xl text-sm font-medium transition-all group cursor-pointer ${
                      collapsed ? 'justify-center px-2' : 'px-4'
                    } ${
                      isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute inset-0 bg-primary/5 rounded-xl border border-primary/10"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <item.icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.15 }}
                          className="relative z-10 overflow-hidden whitespace-nowrap"
                        >
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className={`border-t border-slate-200/60 pt-4 space-y-3 ${collapsed ? 'px-3 pb-5' : 'px-6 pb-6'}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'px-2'}`}>
            <div
              title={collapsed ? (user?.name || 'User') : undefined}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-blue-400 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0"
            >
              {user?.name ? user.name[0] : 'U'}
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <h4 className="font-semibold text-sm text-slate-700 truncate whitespace-nowrap">{user?.name || 'Loading...'}</h4>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 capitalize whitespace-nowrap">
                    {user?.role?.replace('_', ' ').toLowerCase() || 'Viewer'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={logout}
            title={collapsed ? 'Logout' : undefined}
            className={`w-full flex items-center gap-3 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer group ${collapsed ? 'justify-center px-2' : 'px-4'}`}
          >
            <LogOut className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Main content wrapper */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200/50 bg-white/70 backdrop-blur-md flex items-center justify-between px-8 z-20 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 capitalize">
              {pathname.substring(1) || 'Workspace'}
            </h2>
          </div>

          <div className="flex items-center gap-6">
            {/* Notification Bell Icon */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer relative"
              >
                {unreadCount > 0 ? (
                  <>
                    <BellRing className="w-5 h-5 text-primary" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
                  </>
                ) : (
                  <Bell className="w-5 h-5" />
                )}
              </button>

              {/* Notifications Dropdown */}
              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div onClick={() => setShowNotifications(false)} className="fixed inset-0 z-30" />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden z-40"
                    >
                      <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">Alerts & Notifications</span>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px]">
                            {unreadCount} New
                          </span>
                        )}
                      </div>

                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 text-xs font-medium">
                            No notifications to display
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className={`p-4 transition-colors flex gap-2 justify-between items-start ${
                                n.isRead ? 'opacity-60 bg-white' : 'bg-blue-50/20'
                              }`}
                            >
                              <div className="space-y-1 pr-3">
                                <h4 className="font-semibold text-xs text-slate-800">{n.title}</h4>
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{n.message}</p>
                              </div>
                              {!n.isRead && (
                                <button
                                  onClick={() => handleMarkAsRead(n.id)}
                                  className="p-1 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
                                  title="Mark as Read"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-4 border-l border-slate-200/55 pl-6">
              <div className="text-right">
                <p className="text-xs text-slate-400">Server Status</p>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                  <span className="text-xs font-semibold text-slate-600">Active</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
