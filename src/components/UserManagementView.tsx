/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { User, UserStatus, UserRole } from "../types.js";
import { api } from "../lib/api.js";
import {
  Search,
  Eye,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  X,
  CreditCard,
  TrendingUp,
  FileText,
  Badge,
  Users,
  UserPlus,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatBDT } from "../lib/currency.js";
import { UserManagerView } from "./UserManagerView.js";
import { BulkImportTransactionsView } from "./BulkImportTransactionsView.js";

interface UserManagementViewProps {
  shareholders: User[];
  transactions: any[];
  onRefreshData: () => void;
}

export function UserManagementView({
  shareholders,
  transactions,
  onRefreshData,
}: UserManagementViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"directory" | "controls" | "bulk-import">("directory");

  // Deletion Confirmation State
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setDeletingUser(true);
    setDeleteError(null);
    try {
      const res = await api.deleteUser(deleteConfirmUser.id);
      if (res.success) {
        setDeleteConfirmUser(null);
        onRefreshData();
      } else {
        setDeleteError(res.message || "Failed to delete user account.");
      }
    } catch (err: any) {
      setDeleteError(err.message || "An error occurred while deleting the user.");
    } finally {
      setDeletingUser(false);
    }
  };

  // Format currency
  const formatCurrency = (val: number) => {
    return formatBDT(val);
  };

  // Filter List
  const filteredUsers = shareholders.filter((sh) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      sh.name.toLowerCase().includes(q) ||
      sh.email.toLowerCase().includes(q) ||
      sh.mobile.toLowerCase().includes(q)
    );
  });

  // Fetch isolated shareholder transactions helper
  const getShareholderTransactions = (userName: string) => {
    return transactions.filter((tx) => tx.user === userName);
  };

  const getStatusBadge = (status: UserStatus) => {
    if (status === UserStatus.ACTIVE) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
        Disabled
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Sub-tabs for User Management */}
      <div className="flex border-b border-slate-200 gap-6 mb-6 print:hidden">
        <button
          onClick={() => setActiveSubTab("directory")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "directory"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Users className="w-4 h-4" />
          Shareholders Directory
        </button>
        <button
          onClick={() => setActiveSubTab("controls")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "controls"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Account Controls & Registration
        </button>
        <button
          onClick={() => setActiveSubTab("bulk-import")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "bulk-import"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Bulk Import (Excel / CSV)
        </button>
      </div>

      {activeSubTab === "controls" ? (
        <UserManagerView shareholders={shareholders} onRefreshData={onRefreshData} />
      ) : activeSubTab === "bulk-import" ? (
        <BulkImportTransactionsView
          shareholders={shareholders}
          onRefreshData={onRefreshData}
          onGoToDirectory={() => setActiveSubTab("directory")}
        />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <div className="border-b border-slate-50 pb-4 mb-5">
          <h3 className="text-base font-display font-semibold text-slate-800">Shareholders Directory</h3>
          <p className="text-xs text-slate-400">Database overview of investment commitments, payment states, and due metrics</p>
        </div>

        {/* Search Input */}
        <div className="relative mb-5">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search shareholders by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-150 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-sans"
          />
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pt-1 pl-2">Shareholder</th>
                <th className="pb-3 pt-1">Contact Info</th>
                <th className="pb-3 pt-1 text-right">Committed Capital</th>
                <th className="pb-3 pt-1 text-right">Approved Deposited</th>
                <th className="pb-3 pt-1 text-right">Outstanding Due</th>
                <th className="pb-3 pt-1 text-center">Status</th>
                <th className="pb-3 pt-1 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs text-slate-600">
              {filteredUsers.map((sh) => {
                const totalEquity = sh.totalShareValue;
                return (
                  <tr key={sh.id} className="hover:bg-slate-50/30 transition-colors">
                    {/* Shareholder */}
                    <td className="py-3.5 pl-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={sh.photo || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80`}
                          alt={sh.name}
                          className="w-8 h-8 rounded-full border border-slate-100 object-cover bg-slate-50"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="font-semibold text-slate-800 leading-none">{sh.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase font-mono">ID: {sh.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Contact Info */}
                    <td className="py-3.5">
                      <div className="space-y-0.5">
                        <p className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                          <Mail className="w-3 h-3 text-slate-400" /> {sh.email}
                        </p>
                        <p className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" /> {sh.mobile}
                        </p>
                      </div>
                    </td>

                    {/* Total Equity Value (Direct Commitment) */}
                    <td className="py-3.5 text-right font-mono font-bold text-slate-800">
                      {formatCurrency(totalEquity)}
                    </td>

                    {/* Approved Deposited */}
                    <td className="py-3.5 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(sh.depositAmount)}
                    </td>

                    {/* Outstanding Due */}
                    <td className="py-3.5 text-right font-mono font-bold text-rose-700">
                      {formatCurrency(sh.dueAmount)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 text-center">
                      {getStatusBadge(sh.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedProfileUser(sh)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-blue-600 bg-blue-50/30 hover:bg-blue-100 border border-blue-100/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Profile
                        </button>
                        <button
                          onClick={() => {
                            setDeleteConfirmUser(sh);
                            setDeleteError(null);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent transition-colors cursor-pointer inline-flex items-center"
                          title="Delete Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    No shareholders matched search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pop-up detailed Profile Modal */}
      <AnimatePresence>
        {selectedProfileUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setSelectedProfileUser(null)}
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl border border-slate-150 shadow-2xl p-6 w-full max-w-2xl relative z-10 flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <h3 className="text-base font-display font-semibold text-slate-800">
                  Shareholder Portfolio Statement
                </h3>
                <button
                  onClick={() => setSelectedProfileUser(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile details */}
              <div className="overflow-y-auto flex-1 py-4 space-y-6">
                <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                  <img
                    src={selectedProfileUser.photo || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&fit=crop&q=80`}
                    alt={selectedProfileUser.name}
                    className="w-16 h-16 rounded-full border border-slate-200 object-cover bg-slate-100"
                    referrerPolicy="no-referrer"
                  />
                  <div className="space-y-1 text-center sm:text-left">
                    <h4 className="text-base font-bold text-slate-800 leading-none">{selectedProfileUser.name}</h4>
                    <p className="text-xs text-slate-400 font-medium font-mono uppercase">Account Ref ID: {selectedProfileUser.id}</p>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedProfileUser.email}</span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedProfileUser.mobile}</span>
                    </div>
                  </div>
                </div>

                {/* 3 Financial metric pills */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 border border-slate-100 bg-blue-50/10 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Commitments</p>
                    <p className="text-lg font-mono font-bold text-slate-800 mt-1">
                      {formatCurrency(selectedProfileUser.totalShareValue)}
                    </p>
                    <p className="text-[10px] text-blue-600 font-semibold mt-1">
                      Direct capital commitment
                    </p>
                  </div>

                  <div className="p-4 border border-slate-100 bg-emerald-50/10 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approved Paid-in Capital</p>
                    <p className="text-lg font-mono font-bold text-emerald-800 mt-1">
                      {formatCurrency(selectedProfileUser.depositAmount)}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                      ({Math.round((selectedProfileUser.depositAmount / (selectedProfileUser.totalShareValue || 1)) * 100)}% Funded)
                    </p>
                  </div>

                  <div className="p-4 border border-slate-100 bg-rose-50/10 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding Net Due</p>
                    <p className="text-lg font-mono font-bold text-rose-800 mt-1">
                      {formatCurrency(selectedProfileUser.dueAmount)}
                    </p>
                    <p className="text-[10px] text-rose-600 font-medium mt-1">
                      Outstanding balance
                    </p>
                  </div>
                </div>

                {/* Micro Personal ledger Statement list */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-50 pb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" /> Account Transaction History
                  </h5>

                  <div className="overflow-x-auto max-h-[220px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-[10px] font-bold text-slate-400 border-b border-slate-100">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Type</th>
                          <th className="pb-2">Reference</th>
                          <th className="pb-2 text-center">Status</th>
                          <th className="pb-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-600">
                        {getShareholderTransactions(selectedProfileUser.name).map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-2.5 font-mono text-[10px] text-slate-500">{tx.date}</td>
                            <td className="py-2.5">
                              <span
                                className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                                  tx.type === "Deposit"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700"
                                }`}
                              >
                                {tx.type}
                              </span>
                            </td>
                            <td className="py-2.5 font-mono text-[10px] text-slate-400">{tx.reference}</td>
                            <td className="py-2.5 text-center">
                              <span
                                className={`text-[9px] font-bold ${
                                  tx.status === "APPROVED"
                                    ? "text-emerald-700"
                                    : tx.status === "DECLINED"
                                    ? "text-rose-700"
                                    : "text-amber-700"
                                }`}
                              >
                                {tx.status}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-mono font-semibold text-slate-800">
                              {formatCurrency(tx.amount)}
                            </td>
                          </tr>
                        ))}
                        {getShareholderTransactions(selectedProfileUser.name).length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 text-xs italic">
                              No transaction ledger records registered.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-end">
                <button
                  onClick={() => setSelectedProfileUser(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close Statement
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete User Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setDeleteConfirmUser(null)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl border border-slate-150 shadow-2xl p-6 w-full max-w-md relative z-10"
            >
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <div className="p-2.5 bg-rose-50 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="text-base font-display font-semibold text-slate-800">
                  Delete Shareholder Account?
                </h4>
              </div>

              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Are you sure you want to permanently delete the account of <strong>{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email})?
              </p>
              
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[11px] text-amber-800 leading-relaxed mb-4">
                <strong>CRITICAL WARNING:</strong> Deleting this shareholder account will also permanently wipe all of their associated deposits, withdrawals, notifications, and balance tracking. This action is <strong>reversible</strong>.
              </div>

              {deleteError && (
                <p className="text-[11px] font-bold text-rose-600 mb-3 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {deleteError}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteUser}
                  disabled={deletingUser}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {deletingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Confirm Permanent Delete
                </button>
                <button
                  onClick={() => setDeleteConfirmUser(null)}
                  disabled={deletingUser}
                  className="flex-1 py-2.5 bg-slate-55 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
}
