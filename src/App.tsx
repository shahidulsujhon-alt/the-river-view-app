/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  User,
  UserRole,
  FinancialSummary,
  ActivityLog,
  Expense,
  Notification,
  Deposit,
  Withdrawal,
} from "./types.js";
import { api } from "./lib/api.js";
import { Login } from "./components/Login.js";
import { Sidebar } from "./components/Sidebar.js";
import { Header } from "./components/Header.js";
import { DashboardView } from "./components/DashboardView.js";
import { DepositsView } from "./components/DepositsView.js";
import { WithdrawalsView } from "./components/WithdrawalsView.js";
import { ExpensesView } from "./components/ExpensesView.js";
import { ReportsView } from "./components/ReportsView.js";
import { UserManagementView } from "./components/UserManagementView.js";
import { SettingsView } from "./components/SettingsView.js";
import { GDriveView } from "./components/GDriveView.js";
import { Loader2, Download, ExternalLink, X, FileText, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Core App States
  const [summary, setSummary] = useState<FinancialSummary>({
    totalShareValue: 0,
    totalDeposit: 0,
    totalExpense: 0,
    currentBalance: 0,
    expensePerShare: 0,
    totalDue: 0,
  });
  const [shareholders, setShareholders] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Global Document Viewer Lightbox state
  const [viewingDoc, setViewingDoc] = useState<{ url: string; name: string } | null>(null);

  // Check auth session on boot
  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUserRes = await api.getMe();
        if (currentUserRes && currentUserRes.user) {
          setUser(currentUserRes.user);
        }
      } catch (err) {
        console.warn("No active session or session expired.");
      } finally {
        setAuthChecking(false);
      }
    };
    initAuth();
  }, []);

  // Fetch all application data
  const loadAllData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      // 1. Fetch financial summary cards
      const summaryRes = await api.getSummary();
      setSummary(summaryRes);

      // 2. Fetch notifications
      const notificationsRes = await api.getNotifications();
      setNotifications(notificationsRes);

      // 3. Fetch expenses
      const expensesRes = await api.getExpenses();
      setExpenses(expensesRes);

      // 4. Fetch transactions (personal if general user, all if Admin)
      const transactionsRes = await api.getTransactions();
      setTransactions(transactionsRes);

      // 5. If Admin, load shareholders and activity log
      if (user.role === UserRole.ADMIN) {
        const shareholdersRes = await api.getUsers();
        setShareholders(shareholdersRes);

        const logsRes = await api.getActivityLogs();
        setActivityLogs(logsRes);
      }
    } catch (err: any) {
      console.error("Failed to fetch dashboard parameters:", err);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  // Load data upon authentication or login
  useEffect(() => {
    if (user) {
      loadAllData();
      // Set interval to poll/refresh every 15 seconds silently
      const interval = setInterval(loadAllData, 15000);
      return () => clearInterval(interval);
    }
  }, [user, loadAllData]);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setActiveTab("dashboard");
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    localStorage.removeItem("session_token");
  };

  // Safe document triggers
  const handleViewDocument = (url: string, name: string) => {
    setViewingDoc({ url, name });
  };

  // Quick separate notification triggers to pull unread counters
  const handleRefreshNotifications = async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res);
    } catch (e) {
      console.error("Failed to sync notifications:", e);
    }
  };

  // Dynamic Routing views
  const renderActiveView = () => {
    if (!user) return null;

    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardView
            user={user}
            summary={summary}
            transactions={transactions}
            activityLogs={activityLogs}
            expenses={expenses}
            onViewDocument={handleViewDocument}
          />
        );
      case "deposits":
        const userDeposits = transactions.filter((t) => t.type === "Deposit");
        return (
          <DepositsView
            user={user}
            deposits={userDeposits}
            shareholders={shareholders}
            onRefreshData={loadAllData}
            onViewDocument={handleViewDocument}
          />
        );
      case "withdrawals":
        const userWithdrawals = transactions.filter((t) => t.type === "Withdrawal");
        return (
          <WithdrawalsView
            user={user}
            withdrawals={userWithdrawals}
            shareholders={shareholders}
            onRefreshData={loadAllData}
            onViewDocument={handleViewDocument}
          />
        );
      case "expenses":
        return (
          <ExpensesView
            user={user}
            expenses={expenses}
            onRefreshAllData={loadAllData}
            onViewDocument={handleViewDocument}
          />
        );
      case "report":
        return (
          <ReportsView
            user={user}
            shareholders={shareholders}
            transactions={transactions}
            expenses={expenses}
            summary={summary}
            onViewDocument={handleViewDocument}
          />
        );
      case "user-management":
        if (user.role !== UserRole.ADMIN) return <div className="text-sm text-slate-500">Access denied.</div>;
        return (
          <UserManagementView
            shareholders={shareholders}
            transactions={transactions}
            onRefreshData={loadAllData}
          />
        );
      case "gdrive":
        return <GDriveView user={user} />;
      case "settings":
        if (user.role !== UserRole.ADMIN) return <div className="text-sm text-slate-500">Access denied.</div>;
        return (
          <SettingsView
            user={user}
            shareholders={shareholders}
            onRefreshAllData={loadAllData}
            onUpdateCurrentUser={setUser}
          />
        );
      default:
        return (
          <div className="py-12 text-center text-slate-400 font-medium text-xs">
            Module view is under active maintenance.
          </div>
        );
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Authenticating Secure Portal...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex text-slate-700 font-sans print:bg-white">
      {/* Sidebar Navigation Panel - Hide during printing */}
      <div className="print:hidden">
        <Sidebar
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={handleLogout}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pl-64 flex flex-col min-w-0 print:pl-0">
        {/* Header toolbar - Hide during printing */}
        <div className="print:hidden">
          <Header
            activeTab={activeTab}
            notifications={notifications}
            onRefreshNotifications={handleRefreshNotifications}
            onRefreshAllData={loadAllData}
          />
        </div>

        {/* Content View Canvas */}
        <main className="flex-grow p-8 print:p-0">
          {dataLoading && (
            <div className="fixed top-20 right-8 z-40 bg-white/90 backdrop-blur-xs border border-slate-100 rounded-xl px-3.5 py-2 shadow-lg text-[10px] font-bold text-slate-500 flex items-center gap-2 print:hidden">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Syncing ledger...</span>
            </div>
          )}
          {renderActiveView()}
        </main>
      </div>

      {/* Pop-up Global Document Preview Modal */}
      <AnimatePresence>
        {viewingDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setViewingDoc(null)}
            />

            {/* Preview Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl border border-slate-150 shadow-2xl p-6 w-full max-w-lg relative z-10 flex flex-col h-[70vh]"
            >
              <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Viewing Support Document
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono truncate max-w-[350px] mt-0.5">
                    {viewingDoc.name}
                  </p>
                </div>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Dynamic doc display: Iframe or Graphic Icon Placeholder */}
              <div className="flex-grow bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden relative p-4">
                {viewingDoc.url.startsWith("data:application/pdf") || viewingDoc.name.endsWith(".pdf") ? (
                  <div className="text-center p-6 space-y-3">
                    <FileText className="w-16 h-16 text-blue-600 mx-auto bg-blue-50 p-3 rounded-full" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Portable Document (PDF)</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                        Browser constraints may prevent inline PDF viewing in sandboxed frames. You can securely download this file below.
                      </p>
                    </div>
                  </div>
                ) : (
                  <img
                    src={viewingDoc.url}
                    alt={viewingDoc.name}
                    className="max-h-full max-w-full object-contain rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              {/* Action bar */}
              <div className="border-t border-slate-50 pt-4 mt-4 flex items-center gap-2">
                <a
                  href={viewingDoc.url}
                  download={viewingDoc.name}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer text-center"
                >
                  <Download className="w-3.5 h-3.5" /> Download File Attachment
                </a>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="px-4 py-2 bg-slate-55 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
