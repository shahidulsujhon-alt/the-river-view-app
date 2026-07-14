/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { User, Deposit, Withdrawal, Expense, TransactionStatus, UserRole } from "../types.js";
import {
  Filter,
  Download,
  Printer,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Eye,
} from "lucide-react";
import { formatBDT } from "../lib/currency.js";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportsViewProps {
  user: User;
  shareholders: User[];
  transactions: any[];
  expenses: any[];
  summary: {
    totalShareValue: number;
    totalDeposit: number;
    totalExpense: number;
    currentBalance: number;
    totalDue: number;
  };
  onViewDocument: (url: string, name: string) => void;
}

export function ReportsView({
  user,
  shareholders,
  transactions,
  expenses,
  summary,
  onViewDocument,
}: ReportsViewProps) {
  const isAdmin = user.role === UserRole.ADMIN;

  // Filter States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUser, setSelectedUser] = useState(isAdmin ? "ALL" : user.id);
  const [selectedType, setSelectedType] = useState("ALL"); // ALL, Deposit, Withdrawal, Expense
  const [selectedStatus, setSelectedStatus] = useState("ALL"); // ALL, PENDING, APPROVED, DECLINED

  // Consolidate and format all data rows for report
  const reportRows = (() => {
    const rows: any[] = [];

    // Map deposits
    transactions
      .filter((tx) => tx.type === "Deposit")
      .forEach((tx) => {
        rows.push({
          id: tx.id,
          date: tx.date,
          user: tx.user,
          userId: tx.userId || shareholders.find((s) => s.name === tx.user)?.id || "",
          type: "Deposit",
          category: "Member Deposit",
          details: `Bank: ${tx.bankName} | Cheque: ${tx.chequeNumber}`,
          reference: tx.reference,
          amount: tx.amount,
          status: tx.status,
          approvedBy: tx.approvedBy,
          documentUrl: tx.documentUrl,
          fileName: tx.fileName,
        });
      });

    // Map withdrawals
    transactions
      .filter((tx) => tx.type === "Withdrawal")
      .forEach((tx) => {
        rows.push({
          id: tx.id,
          date: tx.date,
          user: tx.user,
          userId: tx.userId || shareholders.find((s) => s.name === tx.user)?.id || "",
          type: "Withdrawal",
          category: "Member Withdrawal",
          details: `Cheque: ${tx.chequeNumber}`,
          reference: tx.reference,
          amount: tx.amount,
          status: tx.status,
          approvedBy: tx.approvedBy,
          documentUrl: tx.documentUrl,
          fileName: tx.fileName,
        });
      });

    // Map expenses (expenses are not tied to a single user, unless filtering "Expense")
    expenses.forEach((exp) => {
      rows.push({
        id: exp.id,
        date: exp.date,
        user: "UN River View (Project)",
        userId: "PROJECT",
        type: "Expense",
        category: exp.category,
        details: `Vendor: ${exp.vendor} | Note: ${exp.description}`,
        reference: exp.id,
        amount: exp.amount,
        status: "APPROVED", // Expenses are automatically approved in this context
        approvedBy: exp.createdBy,
      });
    });

    return rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  })();

  // Filter processing
  const filteredRows = reportRows.filter((row) => {
    // 1. Date filter
    if (startDate && row.date < startDate) return false;
    if (endDate && row.date > endDate) return false;

    // 2. User filter
    if (selectedUser !== "ALL") {
      // If row is a general project expense, hide it if we are filtering for a specific user
      if (row.type === "Expense") return false;
      if (row.userId !== selectedUser) return false;
    }

    // 3. Type filter
    if (selectedType !== "ALL" && row.type !== selectedType) return false;

    // 4. Status filter
    if (selectedStatus !== "ALL" && row.status !== selectedStatus) return false;

    return true;
  });

  // Dynamic Summaries based on filtered items
  const rDeposits = filteredRows
    .filter((r) => r.type === "Deposit" && r.status === "APPROVED")
    .reduce((sum, r) => sum + r.amount, 0);

  const rWithdrawals = filteredRows
    .filter((r) => r.type === "Withdrawal" && r.status === "APPROVED")
    .reduce((sum, r) => sum + r.amount, 0);

  const rExpenses = filteredRows
    .filter((r) => r.type === "Expense")
    .reduce((sum, r) => sum + r.amount, 0);

  const rBalance = rDeposits - rWithdrawals - rExpenses;

  // If a specific shareholder is selected, show their metrics
  const shFilter = selectedUser !== "ALL" ? shareholders.find((s) => s.id === selectedUser) : null;
  const currentShareValue = shFilter ? shFilter.shares : summary.totalShareValue;
  const currentDueAmount = shFilter ? shFilter.dueAmount : summary.totalDue;

  // EXPORT FUNCTIONS

  // Convert to CSV string helper
  const convertToCSV = (data: any[]) => {
    const headers = ["Date", "Type", "Category", "Details", "Reference", "User", "Status", "Amount (BDT)"];
    const csvRows = [headers.join(",")];

    data.forEach((row) => {
      const values = [
        row.date,
        row.type,
        row.category,
        `"${row.details.replace(/"/g, '""')}"`,
        row.reference,
        row.user,
        row.status,
        row.amount,
      ];
      csvRows.push(values.join(","));
    });

    return csvRows.join("\n");
  };

  const handleExportCSV = () => {
    const csvContent = convertToCSV(filteredRows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `un_river_view_financial_report_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    // Generate simple tab-separated content mimicking excel
    const csvContent = convertToCSV(filteredRows);
    const blob = new Blob([csvContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `un_river_view_ledger_export_${Date.now()}.xls`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Page styling
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(18);
      doc.text("The UN River View", 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("Helvetica", "normal");
      doc.text("CONSOLIDATED FINANCIAL STATEMENT & LEDGER", 14, 26);
      doc.text(`Generated on: ${new Date().toLocaleDateString()} | Currency: BDT (৳)`, 14, 32);
      
      // Draw a line
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 36, 196, 36);
      
      // Metrics Overview
      doc.setFont("Helvetica", "bold");
      doc.text("Summary Metrics:", 14, 44);
      doc.setFont("Helvetica", "normal");
      doc.text(`Total Approved Deposits: ৳${rDeposits.toLocaleString("en-BD")}`, 14, 50);
      doc.text(`Total Approved Withdrawals: ৳${rWithdrawals.toLocaleString("en-BD")}`, 14, 56);
      doc.text(`Total Construction Expenses: ৳${rExpenses.toLocaleString("en-BD")}`, 110, 50);
      doc.text(`Current Net Balance: ৳${rBalance.toLocaleString("en-BD")}`, 110, 56);
      
      doc.line(14, 62, 196, 62);
      
      // Add table
      autoTable(doc, {
        startY: 68,
        head: [["Date", "Type", "Category", "Details", "Reference", "User / Entity", "Status", "Amount"]],
        body: filteredRows.map((row) => [
          row.date,
          row.type,
          row.category,
          row.details,
          row.reference,
          row.user,
          row.status,
          "৳" + row.amount.toLocaleString("en-BD"),
        ]),
        styles: { fontSize: 8, font: "Helvetica" },
        headStyles: { fillColor: [15, 23, 42] }, // dark slate color to match design
      });
      
      doc.save(`un_river_view_financial_report_${Date.now()}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in print:p-0 print:space-y-4">
      {/* Filters Form - Hide during printing */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs print:hidden">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-3">
          <Filter className="w-4 h-4 text-blue-600" />
          <h3 className="text-base font-display font-semibold text-slate-800">Advanced Ledger Filters</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
            />
          </div>

          {isAdmin ? (
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Shareholder Account
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="block w-full py-2 px-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
              >
                <option value="ALL">All Shareholders</option>
                {shareholders
                  .map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Shareholder Account
              </label>
              <input
                type="text"
                disabled
                value={user.name}
                className="block w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-xl text-xs focus:outline-hidden"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Transaction Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="block w-full py-2 px-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-white focus:outline-hidden"
            >
              <option value="ALL">All Types</option>
              <option value="Deposit">Deposits Only</option>
              <option value="Withdrawal">Withdrawals Only</option>
              <option value="Expense">Expenses Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Approval Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full py-2 px-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-white focus:outline-hidden"
            >
              <option value="ALL">All Status</option>
              <option value="APPROVED">Approved Only</option>
              <option value="PENDING">Pending Only</option>
              <option value="DECLINED">Declined Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 print:grid-cols-3">
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Deposits</p>
          <p className="text-sm font-mono font-bold text-slate-900 mt-1">{formatBDT(rDeposits)}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Withdrawals</p>
          <p className="text-sm font-mono font-bold text-slate-900 mt-1">{formatBDT(rWithdrawals)}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Expenses</p>
          <p className="text-sm font-mono font-bold text-slate-900 mt-1">{formatBDT(rExpenses)}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Net Balance</p>
          <p className={`text-sm font-mono font-bold mt-1 ${rBalance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {formatBDT(rBalance)}
          </p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Equity Value</p>
          <p className="text-sm font-mono font-bold text-slate-900 mt-1">{formatBDT(currentShareValue)}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Due Amount</p>
          <p className="text-sm font-mono font-bold text-rose-700 mt-1">{formatBDT(currentDueAmount)}</p>
        </div>
      </div>

      {/* Structured Ledger Table & Actions */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs print:border-none print:shadow-none print:p-0">
        {/* Header toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6 print:mb-4">
          <div>
            <h3 className="text-base font-display font-semibold text-slate-800">
              {shFilter ? `${shFilter.name}'s Account Statement` : "UN River View Consolidated Ledger"}
            </h3>
            <p className="text-xs text-slate-400 print:hidden">
              Displaying filtered transactions history statement
            </p>
            {/* Display metadata when printing */}
            <p className="hidden print:block text-[10px] text-slate-500 font-mono mt-1">
              Statement Generated on July 7, 2026 | Project: The UN River View
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl transition-all cursor-pointer bg-rose-50/10 border-rose-100 text-rose-750 hover:bg-rose-50/25"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" /> PDF
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-850 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print Statement
            </button>
          </div>
        </div>

        {/* Print Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pt-1">Date</th>
                <th className="pb-3 pt-1">Type</th>
                <th className="pb-3 pt-1">Category</th>
                <th className="pb-3 pt-1">Transaction Details</th>
                <th className="pb-3 pt-1">Reference ID</th>
                <th className="pb-3 pt-1">Entity / Member</th>
                <th className="pb-3 pt-1 text-center">Status</th>
                <th className="pb-3 pt-1 text-center">Doc</th>
                <th className="pb-3 pt-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                  <td className="py-3 font-mono text-[10px] font-semibold text-slate-500">{row.date}</td>
                  <td className="py-3">
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-semibold ${
                        row.type === "Deposit"
                          ? "bg-emerald-55 bg-opacity-20 text-emerald-800"
                          : row.type === "Withdrawal"
                          ? "bg-rose-55 bg-opacity-20 text-rose-800"
                          : "bg-amber-55 bg-opacity-20 text-amber-800"
                      }`}
                    >
                      {row.type}
                    </span>
                  </td>
                  <td className="py-3 font-medium text-slate-700">{row.category}</td>
                  <td className="py-3 max-w-[200px] truncate" title={row.details}>
                    {row.details}
                  </td>
                  <td className="py-3 font-mono text-[10px] font-semibold text-slate-400">{row.reference}</td>
                  <td className="py-3 font-semibold text-slate-800">{row.user}</td>
                  <td className="py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        row.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700"
                          : row.status === "DECLINED"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    {row.documentUrl ? (
                      <button
                        onClick={() => onViewDocument(row.documentUrl, row.fileName || "Supporting Document")}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors cursor-pointer"
                        title={row.fileName || "View Document"}
                      >
                        <Eye className="w-3 h-3" /> View
                      </button>
                    ) : (
                      <span className="text-slate-300 font-mono text-[10px]">-</span>
                    )}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-slate-900">
                    {formatBDT(row.amount)}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    No matching records found for active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
