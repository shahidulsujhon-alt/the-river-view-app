/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { User, Expense, ExpenseCategory, UserRole } from "../types.js";
import { api } from "../lib/api.js";
import { formatBDT } from "../lib/currency.js";
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  FileText,
  DollarSign,
  Briefcase,
  AlertTriangle,
  Upload,
  FileCheck,
  Loader2,
  Eye,
  Tag,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ExpensesViewProps {
  user: User;
  expenses: Expense[];
  onRefreshAllData: () => void;
  onViewDocument: (url: string, name: string) => void;
}

export function ExpensesView({
  user,
  expenses,
  onRefreshAllData,
  onViewDocument,
}: ExpensesViewProps) {
  const isAdmin = user.role === UserRole.ADMIN;

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Modal Control
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form Fields
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState<ExpenseCategory>("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");

  // Upload States
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process States
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Pre-defined categories
  const categories: ExpenseCategory[] = [
    "Construction Materials",
    "Labor",
    "Utilities",
    "Legal",
    "Government Fees",
    "Equipment",
    "Miscellaneous",
  ];

  // Map category to color
  const getCategoryColor = (cat: ExpenseCategory) => {
    switch (cat) {
      case "Construction Materials":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "Labor":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "Utilities":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "Legal":
        return "bg-purple-50 text-purple-700 border-purple-100";
      case "Government Fees":
        return "bg-rose-50 text-rose-700 border-rose-100";
      case "Equipment":
        return "bg-teal-50 text-teal-700 border-teal-100";
      default:
        return "bg-slate-50 text-slate-750 border-slate-100";
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;

    // Validate size (10 MB = 10 * 1024 * 1024 bytes)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Receipt file exceeds 10 MB limit.");
      return;
    }

    // Validate type
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["jpg", "jpeg", "png", "pdf"].includes(ext)) {
      setUploadError("Only JPG, PNG, and PDF receipt formats are supported.");
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
        setUploadError("Failed to read receipt file.");
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      setUploadError(e.message || "Upload error.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
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

  const openAddModal = () => {
    setEditingExpense(null);
    setDate(new Date().toISOString().split("T")[0]);
    setCategory("");
    setDescription("");
    setAmount("");
    setVendor("");
    setNotes("");
    setUploadedFile(null);
    setUploadError(null);
    setShowModal(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setDate(exp.date);
    setCategory(exp.category);
    setDescription(exp.description);
    setAmount(exp.amount.toString());
    setVendor(exp.vendor);
    setNotes(exp.notes || "");
    if (exp.receiptUrl && exp.fileName) {
      setUploadedFile({ url: exp.receiptUrl, name: exp.fileName });
    } else {
      setUploadedFile(null);
    }
    setUploadError(null);
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !description || !amount || !vendor) {
      alert("Please fill in all mandatory fields.");
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        date,
        category,
        description,
        amount: Number(amount),
        vendor,
        notes: notes || undefined,
        receiptUrl: uploadedFile?.url || undefined,
        fileName: uploadedFile?.name || undefined,
      };

      if (editingExpense) {
        await api.editExpense(editingExpense.id, payload);
      } else {
        await api.addExpense(payload);
      }

      setShowModal(false);
      onRefreshAllData();
    } catch (err: any) {
      alert(err.message || "Failed to process expense.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this construction expense record? This action will automatically recalculate the balances and cannot be undone.")) return;

    try {
      await api.deleteExpense(id);
      onRefreshAllData();
    } catch (e: any) {
      alert(e.message || "Failed to delete expense.");
    }
  };

  // Filter list
  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch =
      exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === "ALL" || exp.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Aggregates
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const averageCost = filteredExpenses.length > 0 ? totalAmount / filteredExpenses.length : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Expenses</p>
            <h4 className="text-xl font-display font-bold text-slate-900 mt-0.5">
              {formatBDT(totalAmount)}
            </h4>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transactions Count</p>
            <h4 className="text-xl font-display font-bold text-slate-900 mt-0.5">
              {filteredExpenses.length} record(s)
            </h4>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Ledger Cost</p>
            <h4 className="text-xl font-display font-bold text-slate-900 mt-0.5">
              {formatBDT(Math.round(averageCost))}
            </h4>
          </div>
        </div>
      </div>

      {/* Main Database Table & Actions */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-50 pb-5 mb-5">
          <div>
            <h3 className="text-base font-display font-semibold text-slate-800">Construction Expense Ledger</h3>
            <p className="text-xs text-slate-400">Database of materials, crane rental, utilities, permits, and labor bills</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white focus:ring-1 focus:ring-blue-500/20 focus:outline-hidden"
            >
              <option value="ALL">All Categories</option>
              {Array.from(new Set(expenses.map((e) => e.category).filter(Boolean))).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Add Expense Button */}
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-xl shadow-sm transition-colors cursor-pointer ml-auto"
            >
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative mb-5">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search expense description, vendor, reference, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-150 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-sans"
          />
        </div>

        {/* Grid Ledger Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExpenses.map((exp) => (
            <div
              key={exp.id}
              className="p-4 border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="min-w-0">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${getCategoryColor(exp.category)}`}>
                      {exp.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 truncate mt-1.5">{exp.description}</h4>
                    <p className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">Paid To: {exp.vendor}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-bold text-slate-900">{formatBDT(exp.amount)}</p>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">{exp.date}</p>
                  </div>
                </div>

                {exp.notes && (
                  <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50/50 p-2 rounded-lg mt-2 italic">
                    "{exp.notes}"
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-4">
                <div className="flex items-center gap-1">
                  {exp.receiptUrl ? (
                    <button
                      onClick={() => onViewDocument(exp.receiptUrl!, exp.fileName || "receipt_attachment.pdf")}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-blue-600 bg-blue-50/40 rounded-lg hover:underline cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Receipt File
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[10px] italic">No attached receipt</span>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(exp)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors cursor-pointer"
                      title="Edit Expense"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-50 transition-colors cursor-pointer"
                      title="Delete Expense"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredExpenses.length === 0 && (
            <div className="col-span-2 py-12 text-center text-slate-400 font-medium">
              No expense entries matched the search filters.
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Expense Slide Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setShowModal(false)}
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl border border-slate-150 shadow-2xl p-6 w-full max-w-lg relative z-10"
            >
              <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
                <h3 className="text-base font-display font-semibold text-slate-800">
                  {editingExpense ? "Edit Expense Details" : "Record Construction Expense"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Expense Type / Category *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Labor, Materials, Permit"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Expense Date
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

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Short Description / Item
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cement bags procurement"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Amount (৳)
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 5000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Vendor / Payee
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Heavy Rentals Co."
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Internal Notes / Audit Comments
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Provide additional details or verify engineer stamps..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 resize-none font-sans"
                  />
                </div>

                {/* Upload Section */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Attach Receipt File (JPG, PNG, PDF Max 10MB)
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
                      onChange={(e) => e.target.files && processFile(e.target.files[0])}
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
                        <span className="text-[10px] text-slate-400">Click to replace receipt</span>
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

                <div className="flex gap-2.5 pt-4">
                  <button
                    type="submit"
                    disabled={processing}
                    className="flex-1 inline-flex justify-center items-center gap-1.5 py-2 px-4 border border-transparent rounded-xl shadow-xs text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {editingExpense ? "Save Ledger Modification" : "Record Expense"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2 bg-slate-55 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
