/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { User, UserRole, TransactionStatus } from "../types.js";
import { api } from "../lib/api.js";
import { formatBDT } from "../lib/currency.js";
import {
  Upload,
  AlertTriangle,
  FileSpreadsheet,
  Check,
  Loader2,
  Trash2,
  ArrowRight,
  ClipboardList,
  RefreshCw,
  Info,
  CheckCircle2,
} from "lucide-react";

interface BulkImportTransactionsViewProps {
  shareholders: User[];
  onRefreshData: () => void;
  onGoToDirectory: () => void;
}

interface ParsedRow {
  tempId: string;
  date: string;
  rawShareholder: string;
  matchedUserId: string; // matched user ID
  type: "Deposit" | "Withdrawal";
  amount: number;
  chequeNumber: string;
  bankName: string;
  reference: string;
  notes: string;
  isValid: boolean;
  error?: string;
}

export function BulkImportTransactionsView({
  shareholders,
  onRefreshData,
  onGoToDirectory,
}: BulkImportTransactionsViewProps) {
  const [pasteText, setPasteText] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hasHeaders, setHasHeaders] = useState(true);
  const [autoApprove, setAutoApprove] = useState(true);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);

  // Column indexes (-1 means unmapped)
  const [colIndexes, setColIndexes] = useState({
    date: 0,
    shareholder: 1,
    type: 2,
    amount: 3,
    chequeNumber: 4,
    bankName: 5,
    reference: 6,
    notes: 7,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Parse text helper (CSV / Excel Tab Separated)
  const parseTabOrCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/);
    return lines
      .map((line) => {
        if (!line.trim()) return [];
        // Detect separator: Tab is dominant in Excel copies
        if (line.includes("\t")) {
          return line.split("\t").map((cell) => cell.replace(/^["']|["']$/g, "").trim());
        }
        // Standard CSV parsing with basic quote support
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result.map((cell) => cell.replace(/^["']|["']$/g, "").trim());
      })
      .filter((row) => row.length > 0);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPasteText(text);
      }
    };
    reader.readAsText(file);
  };

  // Run initial parsing and automatic header mapping
  const handleNextToPreview = () => {
    const rawData = parseTabOrCSV(pasteText);
    if (rawData.length === 0) {
      alert("No data found to import. Please paste text or upload a CSV file.");
      return;
    }

    // Attempt to auto-detect header indexes if user says there are headers
    let startIndex = 0;
    let detectedIndexes = { ...colIndexes };

    if (hasHeaders && rawData.length > 0) {
      const headers = rawData[0].map((h) => h.toLowerCase().trim());
      startIndex = 1;

      headers.forEach((h, idx) => {
        if (/date|time|period/i.test(h)) detectedIndexes.date = idx;
        else if (/shareholder|member|user|name|email|person|owner/i.test(h)) detectedIndexes.shareholder = idx;
        else if (/type|action|transaction|dep.*with/i.test(h)) detectedIndexes.type = idx;
        else if (/amount|value|taka|bdt|price|qty/i.test(h)) detectedIndexes.amount = idx;
        else if (/cheque|check|chq/i.test(h)) detectedIndexes.chequeNumber = idx;
        else if (/bank/i.test(h)) detectedIndexes.bankName = idx;
        else if (/ref|id|txn|txid|reference/i.test(h)) detectedIndexes.reference = idx;
        else if (/note|remark|desc|comment/i.test(h)) detectedIndexes.notes = idx;
      });

      setColIndexes(detectedIndexes);
    }

    // Format rows
    const rowsToProcess = rawData.slice(startIndex);
    const processed = rowsToProcess.map((rawRow, index) => {
      const getValue = (colIdx: number) => {
        return colIdx !== -1 && colIdx < rawRow.length ? rawRow[colIdx] : "";
      };

      const rawDate = getValue(detectedIndexes.date);
      const rawSh = getValue(detectedIndexes.shareholder);
      const rawType = getValue(detectedIndexes.type);
      const rawAmount = getValue(detectedIndexes.amount);
      const rawCheque = getValue(detectedIndexes.chequeNumber);
      const rawBank = getValue(detectedIndexes.bankName);
      const rawRef = getValue(detectedIndexes.reference);
      const rawNotes = getValue(detectedIndexes.notes);

      // Parse Date
      let date = rawDate;
      if (!date) {
        date = new Date().toISOString().split("T")[0];
      } else {
        // basic date cleansing
        try {
          const d = new Date(date);
          if (!isNaN(d.getTime())) {
            date = d.toISOString().split("T")[0];
          }
        } catch (e) {
          // fallback to raw
        }
      }

      // Match shareholder
      let matchedUserId = "";
      const cleanedSh = rawSh.toLowerCase().trim();
      const matched = shareholders.find(
        (s) =>
          s.name.toLowerCase().trim() === cleanedSh ||
          s.email.toLowerCase().trim() === cleanedSh ||
          s.mobile.toLowerCase().trim() === cleanedSh
      );
      if (matched) {
        matchedUserId = matched.id;
      }

      // Parse Type
      let type: "Deposit" | "Withdrawal" = "Deposit";
      if (/with|wth|out|expense|payment/i.test(rawType)) {
        type = "Withdrawal";
      }

      // Parse Amount
      const parsedAmt = Number(rawAmount.replace(/[^0-9.]/g, ""));
      const amount = isNaN(parsedAmt) ? 0 : parsedAmt;

      // Create unique tempId
      const tempId = `parsed-${index}-${Date.now()}`;

      // Validation
      let isValid = true;
      let error = "";
      if (!matchedUserId) {
        isValid = false;
        error = "Shareholder not mapped";
      } else if (amount <= 0) {
        isValid = false;
        error = "Invalid amount";
      }

      return {
        tempId,
        date,
        rawShareholder: rawSh,
        matchedUserId,
        type,
        amount,
        chequeNumber: rawCheque,
        bankName: rawBank,
        reference: rawRef || `BIMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        notes: rawNotes,
        isValid,
        error,
      } as ParsedRow;
    });

    setParsedRows(processed);
    setStep(2);
  };

  // Re-run validation on individual row when mapped shareholder changes
  const handleMatchedUserChange = (tempId: string, newUserId: string) => {
    setParsedRows(
      parsedRows.map((row) => {
        if (row.tempId === tempId) {
          const isValid = newUserId !== "" && row.amount > 0;
          return {
            ...row,
            matchedUserId: newUserId,
            isValid,
            error: !newUserId ? "Shareholder not mapped" : row.amount <= 0 ? "Invalid amount" : undefined,
          };
        }
        return row;
      })
    );
  };

  // Delete a parsed row from the preview list
  const handleDeleteRow = (tempId: string) => {
    setParsedRows(parsedRows.filter((r) => r.tempId !== tempId));
  };

  // Confirm and save imports to the DB
  const handleExecuteImport = async () => {
    const invalidRows = parsedRows.filter((r) => !rowIsValid(r));
    if (invalidRows.length > 0) {
      alert("Please fix all validation errors or delete invalid rows before importing.");
      return;
    }

    if (parsedRows.length === 0) {
      alert("No rows available to import.");
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      // Map rows to bulk format matching backend endpoint expectance
      const transactions = parsedRows.map((row) => ({
        userId: row.matchedUserId,
        type: row.type,
        amount: row.amount,
        date: row.date,
        bankName: row.type === "Deposit" ? row.bankName || "Imported Ledger" : undefined,
        chequeNumber: row.chequeNumber || undefined,
        reference: row.reference,
        notes: row.notes || "Excel Bulk Import",
        status: autoApprove ? TransactionStatus.APPROVED : TransactionStatus.PENDING,
      }));

      const res = await api.bulkImportTransactions(transactions);
      if (res.success) {
        setImportSuccessCount(res.count);
        setStep(3);
        onRefreshData();
      } else {
        setImportError("Import request failed. Please check payload parameters.");
      }
    } catch (e: any) {
      setImportError(e.message || "Failed to bulk import transactions. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const rowIsValid = (row: ParsedRow) => {
    return row.matchedUserId !== "" && row.amount > 0;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs animate-fade-in">
      {/* Wizard Header Progress */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-50 pb-5 mb-6 gap-4">
        <div>
          <h3 className="text-base font-display font-semibold text-slate-800">Bulk Transactions Importer</h3>
          <p className="text-xs text-slate-400">Migrate and upload shareholder transactions from Excel sheet or CSV file</p>
        </div>

        {/* Steps display */}
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
              step === 1 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            1. Raw Input
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <span
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
              step === 2 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            2. Map & Preview
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <span
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
              step === 3 ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            3. Complete
          </span>
        </div>
      </div>

      {/* STEP 1: RAW INPUT */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Guide Info */}
            <div className="lg:col-span-1 bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-500" /> Excel Formatting Guide
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Copy transactions directly from Excel. Make sure your sheet contains columns for Date, Shareholder,
                Type, and Amount.
              </p>

              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 text-[10px] font-bold text-slate-600 font-mono">
                  Standard Column Order Example:
                </div>
                <div className="p-3 text-[10px] font-mono text-slate-500 whitespace-pre leading-normal overflow-x-auto">
                  Date | Shareholder | Type | Amount | Cheque | Bank | Ref | Notes<br />
                  2026-07-01 | rahim@gmail.com | Deposit | 150000 | CHQ-1 | Dhaka Bank | TXN-01 | Initial share<br />
                  2026-07-02 | Amina Khatun | Withdrawal | 50000 | CHQ-2 | - | WTH-02 | Liquid payout
                </div>
              </div>

              <div className="text-slate-500 space-y-1.5 text-xs">
                <p className="font-semibold text-slate-700">Supported Values:</p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li><strong>Shareholder:</strong> Email, Name, or Mobile Number.</li>
                  <li><strong>Type:</strong> "Deposit" or "Withdrawal" (or "wth" / "out").</li>
                  <li><strong>Amount:</strong> Numbers only (currencys parsed).</li>
                </ul>
              </div>
            </div>

            {/* Upload Area */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Paste Tabular Data / CSV Content
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasHeaders}
                      onChange={(e) => setHasHeaders(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                    />
                    First row contains headers
                  </label>
                </div>
              </div>

              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your Excel cells here... (Select columns in Excel, copy, and paste here)"
                rows={10}
                className="w-full font-mono text-xs border border-slate-200 rounded-xl p-4 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 placeholder-slate-400 bg-slate-50/20"
              />

              {/* Drag and drop file */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                  dragActive ? "border-blue-500 bg-blue-50/10" : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Drag & Drop .CSV / excel export here</p>
                <p className="text-[10px] text-slate-400 mt-1">or click to browse local files</p>
              </div>

              {/* Auto approve setting */}
              <div className="bg-blue-50/20 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="autoApproveToggle"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="rounded border-blue-200 text-blue-600 focus:ring-blue-500/15 mt-0.5"
                />
                <div>
                  <label htmlFor="autoApproveToggle" className="block text-xs font-bold text-slate-800 cursor-pointer">
                    Directly Approve Imported Ledger Transactions (Recommended)
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                    If checked, imported transactions will immediately be logged as <strong>APPROVED</strong> and update shareholder balances instantly. Otherwise, they will be imported as <strong>PENDING</strong> and require manual approval in the Deposits/Withdrawals review queues.
                  </p>
                </div>
              </div>

              {/* Submit to Step 2 */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleNextToPreview}
                  disabled={!pasteText.trim()}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Parse & Map Columns <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PREVIEW & MAP */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-blue-600" /> Parsed Rows Preview ({parsedRows.length} entries)
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
              >
                Back to Paste
              </button>
            </div>
          </div>

          {/* Validation Alerts summary */}
          {parsedRows.some((r) => !rowIsValid(r)) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-amber-800">Unmapped Shareholders or Invalid Amounts Detected</h5>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-normal">
                  Some rows did not automatically match any active shareholder name, email, or phone. Use the dropdown mapping in the shareholder column below to map them manually, or delete the row before continuing.
                </p>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Rows</p>
              <p className="text-lg font-mono font-bold text-slate-800 mt-0.5">{parsedRows.length}</p>
            </div>
            <div className="bg-emerald-50/30 border border-emerald-100 p-4 rounded-xl text-center">
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Deposits Count</p>
              <p className="text-lg font-mono font-bold text-emerald-800 mt-0.5">
                {parsedRows.filter((r) => r.type === "Deposit").length}
              </p>
            </div>
            <div className="bg-rose-50/30 border border-rose-100 p-4 rounded-xl text-center">
              <p className="text-[9px] font-bold text-rose-600 uppercase tracking-wider">Withdrawals Count</p>
              <p className="text-lg font-mono font-bold text-rose-800 mt-0.5">
                {parsedRows.filter((r) => r.type === "Withdrawal").length}
              </p>
            </div>
            <div className="bg-blue-50/30 border border-blue-100 p-4 rounded-xl text-center">
              <p className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Total Value</p>
              <p className="text-lg font-mono font-bold text-blue-800 mt-0.5">
                {formatBDT(parsedRows.reduce((sum, r) => sum + r.amount, 0))}
              </p>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white max-h-[500px]">
            <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 sticky top-0 z-10">
                  <th className="py-3 px-4 w-[110px]">Date</th>
                  <th className="py-3 px-3 w-[160px]">Raw Text Sh.</th>
                  <th className="py-3 px-3 w-[240px]">Mapped Shareholder (Required)</th>
                  <th className="py-3 px-3 w-[110px]">Type</th>
                  <th className="py-3 px-3 w-[120px]">Amount</th>
                  <th className="py-3 px-3 w-[130px]">Cheque Number</th>
                  <th className="py-3 px-3 w-[150px]">Reference ID</th>
                  <th className="py-3 px-3 w-[100px] text-center">Status</th>
                  <th className="py-3 px-4 w-[60px] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {parsedRows.map((row) => {
                  const isValid = rowIsValid(row);
                  return (
                    <tr
                      key={row.tempId}
                      className={`hover:bg-slate-50/40 transition-colors ${
                        !isValid ? "bg-amber-50/15" : ""
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => {
                            setParsedRows(
                              parsedRows.map((r) =>
                                r.tempId === row.tempId ? { ...r, date: e.target.value } : r
                              )
                            );
                          }}
                          className="w-full border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden font-mono bg-transparent py-0.5 text-xs"
                        />
                      </td>

                      {/* Raw text shareholder */}
                      <td className="py-3.5 px-3 truncate text-slate-600 font-medium" title={row.rawShareholder}>
                        {row.rawShareholder || <span className="text-slate-300 italic">None</span>}
                      </td>

                      {/* Matched shareholder selector */}
                      <td className="py-3.5 px-3">
                        <select
                          value={row.matchedUserId}
                          onChange={(e) => handleMatchedUserChange(row.tempId, e.target.value)}
                          className={`w-full text-xs rounded-lg py-1 px-1.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white border ${
                            !row.matchedUserId ? "border-amber-400 ring-2 ring-amber-500/10 font-semibold" : "border-slate-200"
                          }`}
                        >
                          <option value="">-- Choose Shareholder --</option>
                          {shareholders
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.email})
                              </option>
                            ))}
                        </select>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-3">
                        <select
                          value={row.type}
                          onChange={(e) => {
                            setParsedRows(
                              parsedRows.map((r) =>
                                r.tempId === row.tempId
                                  ? { ...r, type: e.target.value as "Deposit" | "Withdrawal" }
                                  : r
                              )
                            );
                          }}
                          className="text-xs rounded-lg py-1 px-1.5 bg-white border border-slate-200 focus:outline-hidden font-semibold"
                        >
                          <option value="Deposit">Deposit</option>
                          <option value="Withdrawal">Withdrawal</option>
                        </select>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-3 font-mono">
                        <input
                          type="number"
                          value={row.amount || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setParsedRows(
                              parsedRows.map((r) => {
                                if (r.tempId === row.tempId) {
                                  const valid = row.matchedUserId !== "" && val > 0;
                                  return {
                                    ...r,
                                    amount: val,
                                    isValid: valid,
                                    error: val <= 0 ? "Invalid amount" : !row.matchedUserId ? "Shareholder not mapped" : undefined,
                                  };
                                }
                                return r;
                              })
                            );
                          }}
                          className="w-full font-mono text-xs font-bold text-slate-800 border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden bg-transparent"
                        />
                      </td>

                      {/* Cheque number */}
                      <td className="py-3.5 px-3">
                        <input
                          type="text"
                          value={row.chequeNumber}
                          placeholder="None"
                          onChange={(e) => {
                            setParsedRows(
                              parsedRows.map((r) =>
                                r.tempId === row.tempId ? { ...r, chequeNumber: e.target.value } : r
                              )
                            );
                          }}
                          className="w-full text-xs border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden bg-transparent font-mono"
                        />
                      </td>

                      {/* Reference */}
                      <td className="py-3.5 px-3 font-mono text-[10px]">
                        <input
                          type="text"
                          value={row.reference}
                          placeholder="Auto-generated"
                          onChange={(e) => {
                            setParsedRows(
                              parsedRows.map((r) =>
                                r.tempId === row.tempId ? { ...r, reference: e.target.value } : r
                              )
                            );
                          }}
                          className="w-full text-xs border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden bg-transparent font-mono"
                        />
                      </td>

                      {/* Validation Status */}
                      <td className="py-3.5 px-3 text-center">
                        {isValid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700">
                            <Check className="w-2.5 h-2.5" /> Ready
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700"
                            title={row.error}
                          >
                            <AlertTriangle className="w-2.5 h-2.5" /> {row.error || "Error"}
                          </span>
                        )}
                      </td>

                      {/* Delete */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.tempId)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer hover:bg-slate-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {importError && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {importError}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => {
                if (confirm("Are you sure you want to discard this import and go back?")) {
                  setStep(1);
                  setParsedRows([]);
                }
              }}
              className="px-5 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
            >
              Cancel & Start Over
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={importing || parsedRows.some((r) => !rowIsValid(r)) || parsedRows.length === 0}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Importing Transactions...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Import {parsedRows.length} Transactions
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: COMPLETE */}
      {step === 3 && (
        <div className="py-12 text-center max-w-md mx-auto space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h4 className="text-xl font-display font-bold text-slate-800">Transactions Imported Successfully</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Successfully migrated and injected <strong>{importSuccessCount}</strong> transaction records directly into the ledger accounts. All shareholder summaries and balance sheets have been recalculated.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col gap-2.5 text-xs text-slate-600 font-medium">
            <div className="flex justify-between">
              <span>Status logged:</span>
              <span className="font-bold text-slate-800">{autoApprove ? "Directly APPROVED" : "PENDING Review"}</span>
            </div>
            <div className="flex justify-between">
              <span>Activity logged:</span>
              <span className="italic text-slate-500">"Bulk Transactions Imported"</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => {
                setPasteText("");
                setParsedRows([]);
                setImportSuccessCount(null);
                setStep(1);
              }}
              className="px-5 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
            >
              Import More Data
            </button>
            <button
              onClick={onGoToDirectory}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-850 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Go to Shareholders Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
