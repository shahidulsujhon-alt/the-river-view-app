/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { api } from "../lib/api.js";
import { User, UserRole, UserStatus } from "../types.js";
import { motion } from "motion/react";
import { Lock, Mail, Loader2, Building2, User as UserIcon, Phone, Coins } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [shares, setShares] = useState(""); // Committed capital BDT

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (isRegistering) {
      if (!name || !email || !mobile || !password) {
        setError("Please fill in all required fields.");
        return;
      }
      setLoading(true);
      try {
        const payload = {
          name,
          email,
          mobile,
          shares: Number(shares) || 0,
          password,
        };
        const res = await api.register(payload);
        setSuccessMsg("Registration successful!");
        onLoginSuccess(res.user);
      } catch (err: any) {
        setError(err.message || "Registration failed. Please try again.");
      } finally {
        setLoading(false);
      }
    } else {
      if (!email || !password) {
        setError("Please fill in all fields.");
        return;
      }
      setLoading(true);
      try {
        const res = await api.login(email, password);
        onLoginSuccess(res.user);
      } catch (err: any) {
        setError(err.message || "Invalid credentials. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* App Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl shadow-md text-white mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-display font-bold tracking-tight text-slate-950">
          The UN River View
        </h2>
        <p className="mt-1 text-sm text-slate-500 max-w-xs mx-auto">
          Construction Project Financial Portal & Asset Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-100 sm:rounded-2xl sm:px-10 border border-slate-100">
          <div className="mb-6 flex justify-center border-b border-slate-100 pb-4 gap-6">
            <button
              onClick={() => {
                setIsRegistering(false);
                setError(null);
              }}
              className={`pb-2 text-sm font-semibold tracking-wide transition-all border-b-2 cursor-pointer ${
                !isRegistering
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsRegistering(true);
                setError(null);
              }}
              className={`pb-2 text-sm font-semibold tracking-wide transition-all border-b-2 cursor-pointer ${
                isRegistering
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Register / Sign Up
            </button>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-md text-xs text-rose-700 font-medium"
              >
                {error}
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r-md text-xs text-emerald-700 font-medium"
              >
                {successMsg}
              </motion.div>
            )}

            {/* Registration specific fields */}
            {isRegistering && (
              <>
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Full Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
                      placeholder="e.g. Shahidul Islam"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="mobile" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Mobile Number *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      id="mobile"
                      name="mobile"
                      type="text"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
                      placeholder="e.g. +880 1711-XXXXXX"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="shares" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Committed Capital / Share Value (BDT)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Coins className="w-4 h-4" />
                    </div>
                    <input
                      id="shares"
                      name="shares"
                      type="number"
                      value={shares}
                      onChange={(e) => setShares(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
                      placeholder="e.g. 500000"
                      disabled={loading}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    Enter your total committed investment capital in BDT (৳)
                  </p>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Email Address *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
                  placeholder="name@unriverview.com"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isRegistering ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

            {isRegistering && (
              <p className="text-[10px] text-blue-600 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/50 font-medium leading-normal">
                💡 <strong>Admin Provisioning Rule:</strong> The very first user account created in this system is automatically granted <strong>System Administrator</strong> rights. All subsequent registrations are provisioned as regular shareholders.
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {isRegistering ? "Create Account & Sign In" : "Sign In"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
