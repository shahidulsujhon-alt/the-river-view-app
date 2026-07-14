/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { User, Deposit, TransactionStatus, UserRole } from "../types.js";
import { api } from "../lib/api.js";
import { formatBDT } from "../lib/currency.js";
import {
  Plus,
  Trash2,
  Edit2,
  FileText,
  Upload,
  AlertTriangle,
  Check,
  X,
  FileCheck,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DepositsViewProps {
  user: User;
  deposits: Deposit[];
  shareholders: User[];
  onRefreshData: () => void;
  onViewDocument: (url: string, name: string) => void;
}

interface TempDepositEntry {
  tempId: string;
  amount: number;
  date: string;
  bankName: string;
  chequeNumber: string;
  reference: string;
  notes: string;
  documentUrl?: string;
  fileName?: string;
  userId?: string; // used if admin submitting on behalf of someone
}

export function DepositsView({
  user,
  deposits,
  shareholders,
  onRefreshData,
  onViewDocument,
}: DepositsViewProps) {
  const isAdmin = user.role === UserRole.ADMIN;

  // State for queuing multiple entries
  const [queuedEntries, setQueuedEntries] = useState<TempDepositEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Inputs
  const [targetUserId, setTargetUserId] = useState(isAdmin ? "" : user.id);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [bankName, setBankName] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submit/Process State
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineRemarks, setDeclineRemarks] = useState("");
  const [remarksError, setRemarksError] = useState<string | null>(null);
  
  // Transaction Deletion State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingTx, setDeletingTx] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Drag and drop state
  const [dragActive, setDragActive] = useState(false);

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;

    // Validate size (10 MB = 10 * 1024 * 1024 bytes)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File exceeds 10 MB limit.");
      return;
    }

    // Validate type
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["jpg", "jpeg", "png", "pdf"].includes(ext)) {
      setUploadError("Unsupported file type. Only JPG, PNG, and PDF are allowed.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await api.uploadFile(file.name, file.type, base64);
        setUploadedFile({ url: res.url, name: res.fileName });
      };
      reader.onerror = () => {
        setUploadError("Failed to read local file.");
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      setUploadError(e.message || "Failed to upload file to server.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Add/Edit Queue Entry
  const handleQueuePlus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }
    if (!date) {
      alert("Please select a deposit date.");
      return;
    }

    if (editingId) {
      // Edit existing queued entry
      setQueuedEntries(
        queuedEntries.map((item) =>
          item.tempId === editingId
            ? {
                ...item,
                amount: Number(amount),
                date,
                bankName,
                chequeNumber,
                reference: reference || `REF-${Date.now()}`,
                notes,
                documentUrl: uploadedFile?.url || item.documentUrl,
                fileName: uploadedFile?.name || item.fileName,
                userId: isAdmin ? targetUserId : user.id,
              }
            : item
        )
      );
      setEditingId(null);
    } else {
      // Add new entry
      const newEntry: TempDepositEntry = {
        tempId: `temp-${Date.now()}`,
        amount: Number(amount),
        date,
        bankName,
        chequeNumber,
        reference: reference || `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        notes,
        documentUrl: uploadedFile?.url,
        fileName: uploadedFile?.name,
        userId: isAdmin ? targetUserId : user.id,
      };
      setQueuedEntries([...queuedEntries, newEntry]);
    }

    // Reset Form Input except target shareholder for convenience
    setAmount("");
    setBankName("");
    setChequeNumber("");
    setReference("");
    setNotes("");
    setUploadedFile(null);
  };

  // Populate form to edit queued entry
  const handleEditQueued = (entry: TempDepositEntry) => {
    setEditingId(entry.tempId);
    setAmount(entry.amount.toString());
    setDate(entry.date);
    setBankName(entry.bankName);
    setChequeNumber(entry.chequeNumber);
    setReference(entry.reference);
    setNotes(entry.notes);
    if (entry.documentUrl && entry.fileName) {
      setUploadedFile({ url: entry.documentUrl, name: entry.fileName });
    } else {
      setUploadedFile(null);
    }
    if (isAdmin && entry.userId) {
      setTargetUserId(entry.userId);
    }
  };

  const handleRemoveQueued = (tempId: string) => {
    setQueuedEntries(queuedEntries.filter((item) => item.tempId !== tempId));
    if (editingId === tempId) {
      setEditingId(null);
      setAmount("");
      setUploadedFile(null);
    }
  };

  // Submit batch queued entries to the server
  const handleSubmitBatch = async () => {
    if (queuedEntries.length === 0) return;

    setSubmittingBatch(true);
    try {
      await api.submitDeposits(
        queuedEntries.map((e) => ({
          userId: e.userId || user.id,
          amount: e.amount,
          date: e.date,
          bankName: e.bankName || undefined,
          chequeNumber: e.chequeNumber || undefined,
          reference: e.reference,
          notes: e.notes || undefined,
          documentUrl: e.documentUrl,
          fileName: e.fileName,
        }))
      );
      setQueuedEntries([]);
      onRefreshData();
      alert("Successfully submitted deposits requests for review.");
    } catch (e: any) {
      alert(e.message || "Failed to submit deposits batch.");
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Admin Actions
  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await api.approveDeposit(id);
      onRefreshData();
    } catch (e: any) {
      alert(e.message || "Failed to approve deposit.");
    } finally {
      setProcessingId(null);
    }
  };

  const openDeclineModal = (id: string) => {
    setDeclineId(id);
    setDeclineRemarks("");
    setRemarksError(null);
  };

  const handleDecline = async () => {
    if (!declineRemarks || declineRemarks.trim() === "") {
      setRemarksError("Decline comments are strictly mandatory.");
      return;
    }

    setProcessingId(declineId);
    const id = declineId!;
    setDeclineId(null);

    try {
      await api.declineDeposit(id, declineRemarks);
      onRefreshData();
    } catch (e: any) {
      alert(e.message || "Failed to decline deposit.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    setDeleteConfirmId(id);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setDeletingTx(true);
    setDeleteError(null);
    try {
      const res = await api.deleteDeposit(deleteConfirmId);
      if (res.success) {
        onRefreshData();
        setDeleteConfirmId(null);
      } else {
        setDeleteError(res.message || "Failed to delete deposit transaction.");
      }
    } catch (err: any) {
      setDeleteError(err.message || "An unexpected error occurred while deleting.");
    } finally {
      setDeletingTx(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Upper Grid: Entry Form and Queued Items */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Input Form Column (Span 5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
          <h3 className="text-base font-display font-semibold text-slate-800 mb-4">
            {editingId ? "Edit Queued Deposit Entry" : "Queue New Deposit Entry"}
          </h3>

          <form onSubmit={handleQueuePlus} className="space-y-4">
            {/* Shareholder dropdown for admins */}
            {isAdmin && (
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Deposit Shareholder
                </label>
                <select
                  required
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="block w-full py-2 px-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                >
                  <option value="">-- Select Shareholder --</option>
                  {shareholders
                    .map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        {sh.name} ({sh.email})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Deposit Amount (৳)
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 15000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Deposit Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Bank Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dhaka Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Cheque Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. CHQ-2091"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Transaction Reference ID
              </label>
              <input
                type="text"
                placeholder="Auto-generated if left blank"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Notes / Purpose
              </label>
              <textarea
                rows={2}
                placeholder="Describe deposit payment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 resize-none font-sans"
              />
            </div>

            {/* Drag & Drop File Upload */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Supporting Document (JPG, PNG, PDF Max 10MB)
              </label>

              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[90px] ${
                  dragActive
                    ? "border-blue-500 bg-blue-50/20"
                    : uploadedFile
                    ? "border-emerald-300 bg-emerald-50/10"
                    : "border-slate-200 hover:bg-slate-50/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                />

                {uploading ? (
                  <div className="flex flex-col items-center gap-1.5 text-xs text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span>Uploading receipt...</span>
                  </div>
                ) : uploadedFile ? (
                  <div className="flex flex-col items-center gap-1 text-xs text-emerald-700 font-medium">
                    <FileCheck className="w-5 h-5 text-emerald-600" />
                    <span className="truncate max-w-[200px]">{uploadedFile.name}</span>
                    <span className="text-[10px] text-slate-400">Click to change file</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-xs text-slate-500">
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span>Drag file here or <span className="text-blue-600 font-semibold">Browse</span></span>
                    <span className="text-[9px] text-slate-400">JPG, PNG, PDF up to 10MB</span>
                  </div>
                )}
              </div>

              {uploadError && (
                <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {uploadError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {editingId ? "Save Deposit Details" : "Add to Batch List"}
            </button>
          </form>
        </div>

        {/* Batch Queue View Column (Span 7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col h-[480px]">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <div>
              <h3 className="text-base font-display font-semibold text-slate-800">Queued Deposits ({queuedEntries.length})</h3>
              <p className="text-xs text-slate-400">Batch multiple payments together before final database submission</p>
            </div>
            {queuedEntries.length > 0 && (
              <button
                onClick={handleSubmitBatch}
                disabled={submittingBatch}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white rounded-xl shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submittingBatch ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
                Submit Batch
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {queuedEntries.map((item, idx) => (
              <div
                key={item.tempId}
                className="p-4 bg-slate-50/70 border border-slate-100 rounded-xl flex items-start justify-between gap-4 group hover:border-slate-200 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {formatBDT(item.amount)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">•</span>
                    <span className="text-[10px] font-bold text-slate-500 font-mono">{item.date}</span>
                    {item.userId && isAdmin && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 leading-none">
                        On Behalf Of: {shareholders.find((s) => s.id === item.userId)?.name || "Unknown"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate font-semibold">
                    Bank: {item.bankName || "-"} | Cheque: {item.chequeNumber || "-"}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium truncate">Ref: {item.reference}</p>
                  {item.notes && <p className="text-[11px] text-slate-500 line-clamp-1 italic">"{item.notes}"</p>}
                  {item.documentUrl && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{item.fileName}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditQueued(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-white transition-all border border-transparent hover:border-blue-100 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRemoveQueued(item.tempId)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition-all border border-transparent hover:border-rose-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {queuedEntries.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <FileText className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-xs font-semibold">Your deposits queue is empty</p>
                <p className="text-[11px] max-w-xs mt-1 text-slate-400 leading-relaxed">
                  Fill in the details on the left, click "+" to add them here, then submit everything as a single batch.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Approvals Section */}
      {isAdmin && deposits.some((d) => d.status === TransactionStatus.PENDING) && (
        <div className="bg-amber-50/20 border border-amber-100 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Check className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-display font-semibold text-slate-800">
              Review Pending Deposits Requests
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {deposits
              .filter((d) => d.status === TransactionStatus.PENDING)
              .map((dep) => (
                <div key={dep.id} className="bg-white border border-slate-150 p-4 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{dep.userName}</h4>
                        <p className="text-[10px] text-slate-400 font-mono font-medium">{dep.date}</p>
                      </div>
                      <span className="text-sm font-mono font-bold text-slate-900">
                        {formatBDT(dep.amount)}
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px] text-slate-500 mb-4 border-t border-slate-50 pt-2">
                      <p><strong>Bank Name:</strong> {dep.bankName || "-"}</p>
                      <p><strong>Cheque Number:</strong> {dep.chequeNumber || "-"}</p>
                      <p><strong>Reference:</strong> {dep.reference}</p>
                      {dep.notes && <p className="italic">"{dep.notes}"</p>}
                      {dep.documentUrl && (
                        <button
                          onClick={() => onViewDocument(dep.documentUrl!, dep.fileName || "deposit_proof.pdf")}
                          className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Supporting Document
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-slate-50 pt-3 mt-auto">
                    <button
                      onClick={() => handleApprove(dep.id)}
                      disabled={processingId === dep.id}
                      className="flex-1 inline-flex justify-center items-center gap-1.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      {processingId === dep.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => openDeclineModal(dep.id)}
                      disabled={processingId === dep.id}
                      className="flex-1 inline-flex justify-center items-center gap-1.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Decline
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* History Ledger Section */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <div>
          <h3 className="text-base font-display font-semibold text-slate-800">Submitted Deposits Ledger</h3>
          <p className="text-xs text-slate-400">All recorded deposit requests and review outcomes</p>
        </div>

        <div className="overflow-x-auto mt-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3">Date</th>
                {isAdmin && <th className="pb-3">Shareholder</th>}
                <th className="pb-3 text-right">Amount</th>
                <th className="pb-3">Cheque Number</th>
                <th className="pb-3">Reference ID</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Supporting Doc</th>
                <th className="pb-3">Admin Comments / Remarks</th>
                {isAdmin && <th className="pb-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs text-slate-600">
              {deposits.map((dep) => (
                <tr key={dep.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="py-3.5 font-mono text-[10px] font-medium text-slate-500">{dep.date}</td>
                  {isAdmin && (
                    <td className="py-3.5">
                      <p className="font-semibold text-slate-800 leading-none">{dep.userName}</p>
                    </td>
                  )}
                  <td className="py-3.5 text-right font-mono font-bold text-slate-800">{formatBDT(dep.amount)}</td>
                  <td className="py-3.5 font-mono text-[11px] text-slate-500">{dep.chequeNumber || "-"}</td>
                  <td className="py-3.5 font-mono text-[11px] text-slate-500">{dep.reference}</td>
                  <td className="py-3.5">
                    {dep.status === TransactionStatus.APPROVED ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                      </span>
                    ) : dep.status === TransactionStatus.DECLINED ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700">
                        <XCircle className="w-2.5 h-2.5" /> Declined
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700">
                        <Clock className="w-2.5 h-2.5" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="py-3.5">
                    {dep.documentUrl ? (
                      <button
                        onClick={() => onViewDocument(dep.documentUrl!, dep.fileName || "receipt.pdf")}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        View <Eye className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[10px]">-</span>
                    )}
                  </td>
                  <td className="py-3.5 text-slate-500 font-medium">
                    {dep.remarks ? (
                      <span className="italic">"{dep.remarks}"</span>
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">-</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="py-3.5 text-center">
                      <button
                        onClick={() => handleDeleteTransaction(dep.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer inline-flex items-center"
                        title="Delete Transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {deposits.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 7} className="py-12 text-center text-slate-400 font-medium">
                    No submitted deposits found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decline Comment Modal */}
      <AnimatePresence>
        {declineId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setDeclineId(null)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl border border-slate-150 shadow-2xl p-6 w-full max-w-md relative z-10"
            >
              <h4 className="text-base font-display font-semibold text-slate-800 mb-2">
                Mandatory Decline Comment Required
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                You must provide a mandatory review explanation for declining this deposit request. The comment will be visible to the shareholder immediately.
              </p>

              {remarksError && (
                <p className="text-[10px] font-bold text-rose-600 mb-3 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {remarksError}
                </p>
              )}

              <textarea
                required
                rows={4}
                value={declineRemarks}
                onChange={(e) => {
                  setDeclineRemarks(e.target.value);
                  setRemarksError(null);
                }}
                placeholder="e.g. Cheque signature mismatch / Incorrect transaction reference... please resubmit."
                className="w-full border border-slate-200 rounded-xl p-3 text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 resize-none font-sans mb-4"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDecline}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Confirm Decline
                </button>
                <button
                  onClick={() => setDeclineId(null)}
                  className="flex-1 py-2 bg-slate-55 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Transaction Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setDeleteConfirmId(null)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl border border-slate-150 shadow-2xl p-6 w-full max-w-sm relative z-10"
            >
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <div className="p-2.5 bg-rose-50 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="text-base font-display font-semibold text-slate-800">
                  Delete Deposit Record?
                </h4>
              </div>

              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Are you sure you want to permanently delete this deposit transaction? This action is irreversible and will immediately recalculate the shareholder's paid deposit and due balances.
              </p>

              {deleteError && (
                <p className="text-[10px] font-bold text-rose-600 mb-3 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {deleteError}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={confirmDelete}
                  disabled={deletingTx}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  {deletingTx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Confirm Delete
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={deletingTx}
                  className="flex-1 py-2 bg-slate-55 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
