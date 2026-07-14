/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { FinancialSummary, ActivityLog } from "../types.js";
import { MonthlyCashFlowChart, FinancialOverviewChart } from "./Charts.js";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Scale,
  Coins,
  AlertCircle,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Download,
  FileText,
} from "lucide-react";
import { motion } from "motion/react";
import { formatBDT } from "../lib/currency.js";
import { User, UserRole } from "../types.js";
import { generateFinancialReportPDF } from "../lib/pdfReport.js";
import { generateShareholderStatementXLS } from "../lib/excelReport.js";

interface DashboardViewProps {
  user: User;
  summary: FinancialSummary;
  transactions: any[];
  activityLogs: ActivityLog[];
  expenses: any[];
  onViewDocument: (url: string, name: string) => void;
}

export function DashboardView({
  user,
  summary,
  transactions,
  activityLogs,
  expenses,
  onViewDocument,
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const downloadStatement = () => {
    generateShareholderStatementXLS(user, summary, transactions, expenses);
  };

  // Format currency
  const formatCurrency = (val: number) => {
    return formatBDT(val, 0);
  };

  const formatFractionCurrency = (val: number) => {
    return formatBDT(val, 2);
  };

  // 6 Financial Summary Cards Configuration
  const cards = [
    {
      title: "Total Share Value",
      amount: formatCurrency(summary.totalShareValue),
      icon: Wallet,
      color: "border-l-4 border-l-blue-600 bg-blue-50/20 text-blue-600",
      description: "Aggregated value of all shareholder positions",
    },
    {
      title: "Total Deposit",
      amount: formatCurrency(summary.totalDeposit),
      icon: ArrowUpRight,
      color: "border-l-4 border-l-emerald-600 bg-emerald-50/20 text-emerald-600",
      description: "Sum of all approved stakeholder payments",
    },
    {
      title: "Total Expense",
      amount: formatCurrency(summary.totalExpense),
      icon: Receipt,
      color: "border-l-4 border-l-amber-600 bg-amber-50/20 text-amber-600",
      description: "Accumulated bills, labor, and materials costs",
    },
    {
      title: "Current Balance",
      amount: formatCurrency(summary.currentBalance),
      icon: Coins,
      color: "border-l-4 border-l-teal-600 bg-teal-50/20 text-teal-600",
      description: "Remaining cash pool ready for allocation",
    },
    {
      title: "Expense per Share",
      amount: formatFractionCurrency(summary.expensePerShare),
      icon: Scale,
      color: "border-l-4 border-l-indigo-600 bg-indigo-50/20 text-indigo-600",
      description: "Cost weight divided by total share distribution",
    },
    {
      title: "Total Due",
      amount: formatCurrency(summary.totalDue),
      icon: AlertCircle,
      color: "border-l-4 border-l-rose-600 bg-rose-50/20 text-rose-600",
      description: "Remaining outstanding due from shareholders",
    },
  ];

  // Filters Transactions
  const filteredTransactions = transactions.filter((tx) => {
    // Search query matches user, ID, date, status, amount
    const query = searchQuery.toLowerCase().trim();
    const matchQuery =
      tx.user.toLowerCase().includes(query) ||
      tx.id.toLowerCase().includes(query) ||
      tx.date.toLowerCase().includes(query) ||
      tx.status.toLowerCase().includes(query) ||
      tx.amount.toString().includes(query) ||
      tx.reference.toLowerCase().includes(query);

    const matchStatus = statusFilter === "ALL" || tx.status === statusFilter;
    const matchType = typeFilter === "ALL" || tx.type === typeFilter;

    return matchQuery && matchStatus && matchType;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case "DECLINED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
            <XCircle className="w-3 h-3" /> Declined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  // Clean relative date logger
  const formatLogDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Personalized Welcome & Statement Download Card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl border border-slate-850 p-6 shadow-xl text-white flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={user.photo || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80"}
              alt={user.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700 shadow-md"
              referrerPolicy="no-referrer"
            />
            <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
              user.status === "ACTIVE" ? "bg-emerald-500" : "bg-rose-500"
            }`} />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold leading-tight">
              Welcome back, {user.name}!
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {user.role === UserRole.ADMIN ? "Administrator Portal" : `Shareholder Account • ${user.shares} share(s)`}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={downloadStatement}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 cursor-pointer flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Statement (.XLS)
          </button>
          
          <button
            onClick={() => generateFinancialReportPDF(user, summary, transactions, expenses)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg cursor-pointer flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Download Report (.PDF)
          </button>
          
          {user.role === UserRole.USER && (
            <div className="px-3 py-1.5 bg-slate-800 border border-slate-700/50 rounded-xl text-center">
              <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">My Balance Due</span>
              <span className="block text-xs font-mono font-bold text-rose-400">
                {formatCurrency(user.dueAmount || 0)}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* 6 Financial Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md cursor-default h-32"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`p-2 rounded-xl ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <h4 className="text-2xl font-display font-bold text-slate-900 leading-tight">
                  {card.amount}
                </h4>
                <p className="text-[10px] text-slate-400 font-medium truncate mt-1">
                  {card.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MonthlyCashFlowChart transactions={transactions} expenses={expenses} />
        </div>
        <div>
          <FinancialOverviewChart summary={summary} />
        </div>
      </div>

      {/* Double Panel Grid: Recent Transactions and Activity Logs */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Transactions (Span 2) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-display font-semibold text-slate-800">Recent Transactions</h3>
              <p className="text-xs text-slate-400">Deposits and withdrawals requests submitted by shareholders</p>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white focus:ring-1 focus:ring-blue-500/20 focus:outline-hidden"
              >
                <option value="ALL">All Types</option>
                <option value="Deposit">Deposits</option>
                <option value="Withdrawal">Withdrawals</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white focus:ring-1 focus:ring-blue-500/20 focus:outline-hidden"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="DECLINED">Declined</option>
              </select>
            </div>
          </div>

          {/* Search Inputs */}
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search user, reference, bank, cheque or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-150 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-sans"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pt-1">Date</th>
                  <th className="pb-3 pt-1">Shareholder</th>
                  <th className="pb-3 pt-1">Type</th>
                  <th className="pb-3 pt-1 text-right">Amount</th>
                  <th className="pb-3 pt-1 text-center">Status</th>
                  <th className="pb-3 pt-1">Approved By</th>
                  <th className="pb-3 pt-1">Supporting Doc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs text-slate-600">
                {filteredTransactions.slice(0, 10).map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-3 font-mono text-[10px] font-medium text-slate-500">{tx.date}</td>
                    <td className="py-3">
                      <p className="font-semibold text-slate-800 leading-none">{tx.user}</p>
                      <p className="text-[9px] font-semibold text-slate-400 mt-1">Ref: {tx.reference}</p>
                    </td>
                    <td className="py-3 font-medium">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                          tx.type === "Deposit"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-slate-800">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="py-3 text-center">{getStatusBadge(tx.status)}</td>
                    <td className="py-3 text-slate-500 font-medium">{tx.approvedBy}</td>
                    <td className="py-3">
                      {tx.documentUrl ? (
                        <button
                          onClick={() => onViewDocument(tx.documentUrl, tx.fileName || "supporting_document.pdf")}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          View <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[10px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      No transactions match current query or filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admin Activity Log */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col h-[480px]">
          <div>
            <h3 className="text-base font-display font-semibold text-slate-800">Admin Activity Log</h3>
            <p className="text-xs text-slate-400">Audit trail of recent administrator modifications</p>
          </div>

          <div className="flex-1 overflow-y-auto mt-6 pr-1 space-y-4">
            {activityLogs.map((log) => (
              <div key={log.id} className="border-l-2 border-slate-100 pl-4 py-0.5 hover:border-blue-500 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-800">{log.adminName}</span>
                  <span className="text-[9px] font-semibold text-slate-400 font-mono">
                    {formatLogDate(log.date)}
                  </span>
                </div>
                <p className="text-xs font-bold text-blue-700 leading-snug">{log.action}</p>
                {log.remarks && (
                  <p className="text-[11px] text-slate-500 leading-normal mt-0.5">{log.remarks}</p>
                )}
              </div>
            ))}
            {activityLogs.length === 0 && (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                No recent activity logs recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
