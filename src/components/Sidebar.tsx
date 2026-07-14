/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { User, UserRole } from "../types.js";
import {
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  FileText,
  UserPlus,
  Users,
  LogOut,
  Building2,
  Lock,
  Settings,
  Cloud,
} from "lucide-react";

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export function Sidebar({ user, activeTab, setActiveTab, onLogout }: SidebarProps) {
  const isAdmin = user.role === UserRole.ADMIN;

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.USER] },
    { id: "deposits", label: "Deposits", icon: ArrowUpRight, roles: [UserRole.ADMIN, UserRole.USER] },
    { id: "withdrawals", label: "Withdrawals", icon: ArrowDownRight, roles: [UserRole.ADMIN, UserRole.USER] },
    { id: "expenses", label: "Expenses", icon: Receipt, roles: [UserRole.ADMIN, UserRole.USER] }, // Admin add/edit, user view
    { id: "report", label: "Advance Report", icon: FileText, roles: [UserRole.ADMIN, UserRole.USER] },
    { id: "gdrive", label: "Project Drive", icon: Cloud, roles: [UserRole.ADMIN, UserRole.USER] },
    { id: "user-management", label: "User Management", icon: Users, roles: [UserRole.ADMIN] },
    { id: "settings", label: "System Settings", icon: Settings, roles: [UserRole.ADMIN] },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-slate-100 bg-white">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-2.5 px-6 border-b border-slate-50">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-display font-bold text-slate-900 leading-tight">The UN River View</h1>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Asset Management</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
        {menuItems
          .filter((item) => item.roles.includes(user.role))
          .map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-blue-50/60 text-blue-600 font-semibold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-150 ${isActive ? "scale-110" : ""}`} />
                {item.label}
              </button>
            );
          })}
      </nav>

      {/* Logged User Footer & Logout */}
      <div className="p-4 border-t border-slate-50">
        {/* User Card */}
        <div className="flex items-center gap-3 p-2 bg-slate-50/70 rounded-xl mb-3">
          <img
            src={user.photo || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80"}
            alt={user.name}
            className="w-9 h-9 rounded-full object-cover border border-slate-100 bg-white"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 truncate leading-none mb-1">{user.name}</p>
            <div className="flex items-center gap-1">
              {isAdmin ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 leading-none">
                  <Lock className="w-2.5 h-2.5 mr-0.5" /> Admin
                </span>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 leading-none">
                  Shareholder
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors duration-150 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout System
        </button>
      </div>
    </aside>
  );
}
