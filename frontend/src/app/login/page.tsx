'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { Briefcase, Mail, KeyRound, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');

    const success = await login(email, password);
    setLoading(false);

    if (!success) {
      setError('Invalid email or password. Try one of the quick login presets.');
    }
  };

  const loginPreset = async (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword('password');
    setLoading(true);
    setError('');
    const success = await login(presetEmail, 'password');
    setLoading(false);
    if (!success) {
      setError('Preset login failed.');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-900 overflow-hidden">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 z-0">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -60, 0],
            y: [0, 40, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -bottom-40 -right-40 w-[30rem] h-[30rem] rounded-full bg-indigo-500/20 blur-3xl"
        />
      </div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md mx-4 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl flex flex-col items-center"
      >
        {/* Logo */}
        <div className="bg-blue-500/10 text-blue-400 p-4 rounded-2xl mb-4 border border-blue-500/20">
          <Briefcase className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Welcome to NexLeads</h2>
        <p className="text-slate-400 text-sm mt-1 mb-8">Enter your credentials to access CRM workspace</p>

        {/* Error notification */}
        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-300 text-xs px-4 py-3 rounded-xl mb-6 text-center">
            {error}
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleLogin} className="w-full space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                <KeyRound className="w-5 h-5" />
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">
          Want to register a new organisation?{' '}
          <Link href="/register" className="text-blue-400 font-bold hover:underline">
            Register Organisation
          </Link>
        </p>

        {/* Divider */}
        <div className="relative flex py-5 items-center w-full my-4">
          <div className="flex-grow border-t border-white/5"></div>
          <span className="flex-shrink mx-4 text-slate-500 text-xs font-semibold uppercase tracking-wider">Quick Presets</span>
          <div className="flex-grow border-t border-white/5"></div>
        </div>

        {/* Quick logins presets */}
        <div className="w-full grid grid-cols-1 gap-2.5">
          <button
            onClick={() => loginPreset('admin@nexleads.com')}
            className="w-full py-2.5 px-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-left text-xs font-medium text-slate-300 transition-colors flex justify-between items-center cursor-pointer group"
          >
            <div>
              <p className="font-semibold text-white">Sarah Connor</p>
              <p className="text-[10px] text-slate-400">admin@nexleads.com</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">Admin</span>
          </button>

          <button
            onClick={() => loginPreset('executive@nexleads.com')}
            className="w-full py-2.5 px-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-left text-xs font-medium text-slate-300 transition-colors flex justify-between items-center cursor-pointer group"
          >
            <div>
              <p className="font-semibold text-white">John Doe</p>
              <p className="text-[10px] text-slate-400">executive@nexleads.com</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 group-hover:bg-green-500/20 text-[10px]">Sales Exec</span>
          </button>

          <button
            onClick={() => loginPreset('viewer@nexleads.com')}
            className="w-full py-2.5 px-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-left text-xs font-medium text-slate-300 transition-colors flex justify-between items-center cursor-pointer group"
          >
            <div>
              <p className="font-semibold text-white">Jane Smith</p>
              <p className="text-[10px] text-slate-400">viewer@nexleads.com</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 group-hover:bg-slate-500/20 text-[10px]">Viewer</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
