/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Notification } from "../types.js";
import { api } from "../lib/api.js";
import { Bell, Check, Clock, Calendar, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HeaderProps {
  activeTab: string;
  notifications: Notification[];
  onRefreshNotifications: () => void;
  onRefreshAllData: () => void;
}

export function Header({ activeTab, notifications, onRefreshNotifications, onRefreshAllData }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getTitle = () => {
    switch (activeTab) {
      case "dashboard":
        return "Financial Summary Dashboard";
      case "deposits":
        return "Deposits Management Portal";
      case "withdrawals":
        return "Withdrawals Management Portal";
      case "expenses":
        return "Construction Expense Ledger";
      case "report":
        return "Financial Statements & Analytics";
      case "user-manager":
        return "Shareholder Account Manager";
      case "user-management":
        return "Shareholders Database Directory";
      case "gdrive":
        return "Project Cloud Documents";
      default:
        return "The UN River View Portal";
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      onRefreshNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReadNotification = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      onRefreshNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerRefresh = async () => {
    setRefreshing(true);
    await onRefreshAllData();
    setTimeout(() => setRefreshing(false), 800);
  };

  // Humanize relative time
  const formatTime = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b border-slate-100 bg-white px-8">
      {/* Page Title & Breadcrumbs */}
      <div>
        <h2 className="text-xl font-display font-bold text-slate-900 tracking-tight">{getTitle()}</h2>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <span>The UN River View</span>
          <span>/</span>
          <span className="text-slate-600 capitalize">{activeTab.replace("-", " ")}</span>
        </div>
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-4">
        {/* Quick Sync Button */}
        <button
          onClick={handleTriggerRefresh}
          disabled={refreshing}
          title="Force Sync Financial Database"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all border border-slate-100 disabled:opacity-40 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
        </button>

        {/* Date Display */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>July 7, 2026</span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              showNotifications
                ? "bg-blue-50 border-blue-200 text-blue-600"
                : "bg-white border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          <AnimatePresence>
            {showNotifications && (
              <>
                {/* Backdrop overlay to close */}
                <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />

                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.95 }}
                  className="absolute right-0 mt-2.5 w-80 bg-white border border-slate-150 rounded-2xl shadow-xl z-40 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Notifications</h4>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 font-medium">
                        No recent notifications.
                      </div>
                    ) : (
                      notifications.map((ntf) => (
                        <div
                          key={ntf.id}
                          onClick={() => !ntf.read && handleReadNotification(ntf.id)}
                          className={`p-4 text-left hover:bg-slate-50/50 transition-colors cursor-pointer relative ${
                            !ntf.read ? "bg-blue-50/20" : ""
                          }`}
                        >
                          {!ntf.read && (
                            <span className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-blue-500" />
                          )}
                          <p className="text-xs font-bold text-slate-800 leading-tight mb-1">{ntf.title}</p>
                          <p className="text-[11px] text-slate-500 leading-normal mb-1.5">{ntf.message}</p>
                          <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-400">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{formatTime(ntf.date)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
