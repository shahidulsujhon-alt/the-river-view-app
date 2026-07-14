/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ExcelJS from "exceljs";
import { User, FinancialSummary } from "../types.js";

/**
 * Generates and downloads an ultra-premium, natively-formatted Excel (.xlsx) spreadsheet
 * utilizing ExcelJS. This creates an authentic spreadsheet with exact borders, color-coded headings,
 * column widths, native numeric formatting, and zero "format mismatch" security warnings.
 */
export async function generateShareholderStatementXLS(
  user: User,
  summary: FinancialSummary,
  transactions: any[],
  expenses: any[]
): Promise<void> {
  // Filter transactions belonging to current user
  const userTx = transactions.filter((t) => t.user === user.name);

  // Initialize a new standard workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Portfolio Ledger");

  // Enable gridlines display explicitly
  worksheet.views = [{ showGridLines: true }];

  // 1. Establish explicit Column Widths (Columns A to G)
  worksheet.getColumn(1).width = 16;  // A: Date / ID / Label 1
  worksheet.getColumn(2).width = 15;  // B: Category / Value 1
  worksheet.getColumn(3).width = 18;  // C: Description (Left) / Spacer / Value 2 (Left)
  worksheet.getColumn(4).width = 18;  // D: Label 3
  worksheet.getColumn(5).width = 16;  // E: Status / Value 3
  worksheet.getColumn(6).width = 18;  // F: Reference / Vendor
  worksheet.getColumn(7).width = 30;  // G: Notes / Remarks

  // Helper styles
  const borderThin = {
    top: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    left: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    right: { style: "thin" as const, color: { argb: "FFCBD5E1" } }
  };

  const applyBorder = (cell: ExcelJS.Cell) => {
    cell.border = borderThin;
  };

  const applyLabelStyle = (cell: ExcelJS.Cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8FAFC" } // Warm off-white
    };
    cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF475569" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = borderThin;
  };

  const applyValueStyle = (
    cell: ExcelJS.Cell,
    options: {
      align?: "left" | "right" | "center";
      bold?: boolean;
      color?: string;
      numFmt?: string;
    } = {}
  ) => {
    cell.font = {
      name: "Segoe UI",
      size: 9.5,
      bold: options.bold || false,
      color: { argb: options.color || "FF1E293B" }
    };
    cell.alignment = { vertical: "middle", horizontal: options.align || "left" };
    if (options.numFmt) {
      cell.numFmt = options.numFmt;
    }
    cell.border = borderThin;
  };

  const applySectionTitle = (rowNumber: number, title: string) => {
    worksheet.mergeCells(`A${rowNumber}:G${rowNumber}`);
    const cell = worksheet.getCell(`A${rowNumber}`);
    cell.value = title;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" } // Slate 100
    };
    cell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    
    // Apply borders across all merged cells in the row
    for (let col = 1; col <= 7; col++) {
      worksheet.getRow(rowNumber).getCell(col).border = borderThin;
    }
    worksheet.getRow(rowNumber).height = 26;
  };

  const applyTableHeaderStyle = (cell: ExcelJS.Cell, align: "left" | "right" | "center" = "left") => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" } // Slate 800
    };
    cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: align };
    cell.border = {
      top: { style: "thin" as const, color: { argb: "FF334155" } },
      left: { style: "thin" as const, color: { argb: "FF334155" } },
      bottom: { style: "medium" as const, color: { argb: "FF0F172A" } },
      right: { style: "thin" as const, color: { argb: "FF334155" } }
    };
  };

  // --- 1. HEADER BANNER (NO BORDER) ---
  worksheet.mergeCells("A1:G2");
  const headerCell = worksheet.getCell("A1");
  headerCell.value = "UN RIVER VIEW\nOFFICIAL SHAREHOLDER FINANCIAL STATEMENT & PORTFOLIO LEDGER";
  headerCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" } // Dark Slate 900
  };
  headerCell.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  headerCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };

  worksheet.getRow(1).height = 24;
  worksheet.getRow(2).height = 24;

  // Metadata block overlay in A3:G3
  worksheet.mergeCells("A3:C3");
  const metaLeft = worksheet.getCell("A3");
  metaLeft.value = `Shareholder Portfolio Statement • Restricted Access`;
  metaLeft.font = { name: "Segoe UI", size: 8, italic: true, color: { argb: "FF64748B" } };
  metaLeft.alignment = { vertical: "middle", horizontal: "left" };

  worksheet.mergeCells("D3:G3");
  const metaRight = worksheet.getCell("D3");
  metaRight.value = `Statement Generated On: ${new Date().toLocaleDateString()}`;
  metaRight.font = { name: "Segoe UI", size: 8, bold: true, color: { argb: "FF475569" } };
  metaRight.alignment = { vertical: "middle", horizontal: "right" };
  worksheet.getRow(3).height = 18;

  // Add thin spacing row
  worksheet.getRow(4).height = 8;

  // --- 2. SHAREHOLDER INFORMATION ---
  applySectionTitle(5, "I. SHAREHOLDER PROFILE DETAILS");

  const row6 = worksheet.getRow(6);
  row6.height = 20;
  applyLabelStyle(row6.getCell(1)); row6.getCell(1).value = "Shareholder Name";
  worksheet.mergeCells("B6:C6");
  applyValueStyle(row6.getCell(2), { bold: true }); row6.getCell(2).value = user.name;
  applyBorder(row6.getCell(3));
  applyLabelStyle(row6.getCell(4)); row6.getCell(4).value = "Allocated Shares";
  worksheet.mergeCells("E6:F6");
  applyValueStyle(row6.getCell(5), { bold: true, color: "FF2563EB" }); row6.getCell(5).value = `${user.shares} share(s)`;
  applyBorder(row6.getCell(6));
  applyValueStyle(row6.getCell(7)); row6.getCell(7).value = "";

  const row7 = worksheet.getRow(7);
  row7.height = 20;
  applyLabelStyle(row7.getCell(1)); row7.getCell(1).value = "Registered Email";
  worksheet.mergeCells("B7:C7");
  applyValueStyle(row7.getCell(2)); row7.getCell(2).value = user.email;
  applyBorder(row7.getCell(3));
  applyLabelStyle(row7.getCell(4)); row7.getCell(4).value = "Share Value Tier";
  worksheet.mergeCells("E7:F7");
  applyValueStyle(row7.getCell(5)); row7.getCell(5).value = "BDT 50,000 / share";
  applyBorder(row7.getCell(6));
  applyValueStyle(row7.getCell(7)); row7.getCell(7).value = "";

  const row8 = worksheet.getRow(8);
  row8.height = 20;
  applyLabelStyle(row8.getCell(1)); row8.getCell(1).value = "Registered Mobile";
  worksheet.mergeCells("B8:C8");
  applyValueStyle(row8.getCell(2)); row8.getCell(2).value = user.mobile || "-";
  applyBorder(row8.getCell(3));
  applyLabelStyle(row8.getCell(4)); row8.getCell(4).value = "Total Commitment";
  worksheet.mergeCells("E8:F8");
  applyValueStyle(row8.getCell(5), { bold: true, align: "right", numFmt: "৳#,##0" });
  row8.getCell(5).value = Number(user.shares);
  applyBorder(row8.getCell(6));
  applyValueStyle(row8.getCell(7)); row8.getCell(7).value = "";

  worksheet.getRow(9).height = 8;

  // --- 3. BALANCE & COMMITMENT SUMMARY ---
  applySectionTitle(10, "II. PERSONAL BALANCE & COMMITMENT SUMMARY");

  const row11 = worksheet.getRow(11);
  row11.height = 20;
  applyLabelStyle(row11.getCell(1)); row11.getCell(1).value = "Total Commitment";
  applyValueStyle(row11.getCell(2), { bold: true, align: "right", numFmt: "৳#,##0" });
  row11.getCell(2).value = Number(user.shares);
  applyLabelStyle(row11.getCell(3)); row11.getCell(3).value = "Outstanding Due";
  applyValueStyle(row11.getCell(4), { bold: true, align: "right", color: "FFDC2626", numFmt: "৳#,##0" });
  row11.getCell(4).value = Number(user.dueAmount || 0);
  applyLabelStyle(row11.getCell(5)); row11.getCell(5).value = "Deposits Made";
  applyValueStyle(row11.getCell(6), { bold: true, align: "right", color: "FF16A34A", numFmt: "৳#,##0" });
  row11.getCell(6).value = Number(user.depositAmount || 0);
  applyValueStyle(row11.getCell(7)); row11.getCell(7).value = "";

  const row12 = worksheet.getRow(12);
  row12.height = 20;
  applyLabelStyle(row12.getCell(1)); row12.getCell(1).value = "My Share Ratio %";
  applyValueStyle(row12.getCell(2), { bold: true, align: "right", color: "FF2563EB", numFmt: "0.00%" });
  const ratioVal = summary.totalShareValue > 0 ? (user.shares) / summary.totalShareValue : 0;
  row12.getCell(2).value = ratioVal;
  worksheet.mergeCells("C12:G12");
  for (let c = 3; c <= 7; c++) {
    applyValueStyle(row12.getCell(c));
    if (c === 3) row12.getCell(c).value = "Ratios are calculated against the combined shareholder asset values of BDT " + summary.totalShareValue.toLocaleString();
  }

  worksheet.getRow(13).height = 8;

  // --- 4. PROJECT GLOBAL FINANCIAL STANDING ---
  applySectionTitle(14, "III. PROJECT GENERAL FINANCIAL STANDING");

  const row15 = worksheet.getRow(15);
  row15.height = 20;
  applyLabelStyle(row15.getCell(1)); row15.getCell(1).value = "Project Valuation";
  applyValueStyle(row15.getCell(2), { align: "right", numFmt: "৳#,##0" });
  row15.getCell(2).value = Number(summary.totalShareValue);
  applyLabelStyle(row15.getCell(3)); row15.getCell(3).value = "Realized Deposits";
  applyValueStyle(row15.getCell(4), { align: "right", numFmt: "৳#,##0" });
  row15.getCell(4).value = Number(summary.totalDeposit);
  applyLabelStyle(row15.getCell(5)); row15.getCell(5).value = "Project Expenses";
  applyValueStyle(row15.getCell(6), { align: "right", color: "FFB91C1C", numFmt: "৳#,##0" });
  row15.getCell(6).value = Number(summary.totalExpense);
  applyValueStyle(row15.getCell(7)); row15.getCell(7).value = "";

  const row16 = worksheet.getRow(16);
  row16.height = 20;
  applyLabelStyle(row16.getCell(1)); row16.getCell(1).value = "Available Vault Bal";
  applyValueStyle(row16.getCell(2), { bold: true, align: "right", color: "FF15803D", numFmt: "৳#,##0" });
  row16.getCell(2).value = Number(summary.currentBalance);
  applyLabelStyle(row16.getCell(3)); row16.getCell(3).value = "Accumulated Due";
  applyValueStyle(row16.getCell(4), { align: "right", numFmt: "৳#,##0" });
  row16.getCell(4).value = Number(summary.totalDue);
  applyLabelStyle(row16.getCell(5)); row16.getCell(5).value = "Expense per Share";
  applyValueStyle(row16.getCell(6), { align: "right", numFmt: "৳#,##0.00" });
  row16.getCell(6).value = Number(summary.expensePerShare);
  applyValueStyle(row16.getCell(7)); row16.getCell(7).value = "";

  worksheet.getRow(17).height = 8;

  // --- 5. PERSONAL TRANSACTION LEDGER HISTORY ---
  applySectionTitle(18, "IV. PERSONAL TRANSACTION LEDGER HISTORY");

  const row19 = worksheet.getRow(19);
  row19.height = 22;
  applyTableHeaderStyle(row19.getCell(1), "left");   row19.getCell(1).value = "TX ID";
  applyTableHeaderStyle(row19.getCell(2), "left");   row19.getCell(2).value = "Date";
  applyTableHeaderStyle(row19.getCell(3), "left");   row19.getCell(3).value = "Type";
  applyTableHeaderStyle(row19.getCell(4), "right");  row19.getCell(4).value = "Amount (BDT)";
  applyTableHeaderStyle(row19.getCell(5), "center"); row19.getCell(5).value = "Status";
  applyTableHeaderStyle(row19.getCell(6), "left");   row19.getCell(6).value = "Reference";
  applyTableHeaderStyle(row19.getCell(7), "left");   row19.getCell(7).value = "Notes / Remarks";

  let txRowCursor = 20;
  if (userTx.length === 0) {
    worksheet.mergeCells(`A${txRowCursor}:G${txRowCursor}`);
    const emptyCell = worksheet.getCell(`A${txRowCursor}`);
    emptyCell.value = "No transactions recorded for this account.";
    emptyCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF64748B" } };
    emptyCell.alignment = { vertical: "middle", horizontal: "center" };
    emptyCell.border = borderThin;
    worksheet.getRow(txRowCursor).height = 24;
    txRowCursor++;
  } else {
    userTx.forEach((tx) => {
      const row = worksheet.getRow(txRowCursor);
      row.height = 20;

      // ID & Date
      applyValueStyle(row.getCell(1), { bold: true, color: "FF475569" }); row.getCell(1).value = tx.id;
      applyValueStyle(row.getCell(2)); row.getCell(2).value = tx.date;

      // Type Badge Fill
      const typeColor = tx.type === "Deposit" ? "FF16A34A" : "FFDC2626";
      const typeBg = tx.type === "Deposit" ? "FFF0FDF4" : "FFFFF2F2";
      applyValueStyle(row.getCell(3), { bold: true, color: typeColor });
      row.getCell(3).value = tx.type;
      row.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: typeBg } };

      // Amount
      applyValueStyle(row.getCell(4), { align: "right", numFmt: "৳#,##0", bold: true });
      row.getCell(4).value = Number(tx.amount);

      // Status Badge Fill
      let statusColor = "FFB45309";
      let statusBg = "FFFFF3C7";
      if (tx.status === "APPROVED") {
        statusColor = "FF15803D";
        statusBg = "FFDCFCE7";
      } else if (tx.status === "DECLINED") {
        statusColor = "FFB91C1C";
        statusBg = "FFFEE2E2";
      }
      applyValueStyle(row.getCell(5), { align: "center", bold: true, color: statusColor });
      row.getCell(5).value = tx.status;
      row.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusBg } };

      // Ref and Notes
      applyValueStyle(row.getCell(6)); row.getCell(6).value = tx.reference || "-";
      applyValueStyle(row.getCell(7)); row.getCell(7).value = tx.notes || tx.remarks || "-";

      txRowCursor++;
    });
  }

  // Spacing row
  worksheet.getRow(txRowCursor).height = 8;
  txRowCursor++;

  // --- 6. DETAILED PROJECT EXPENSE OUTFLOWS ---
  applySectionTitle(txRowCursor, "V. DETAILED PROJECT OUTFLOWS (EXPENSES)");
  txRowCursor++;

  const rowExpHeader = worksheet.getRow(txRowCursor);
  rowExpHeader.height = 22;
  applyTableHeaderStyle(rowExpHeader.getCell(1), "left");   rowExpHeader.getCell(1).value = "Date";
  worksheet.mergeCells(`B${txRowCursor}:C${txRowCursor}`);
  applyTableHeaderStyle(rowExpHeader.getCell(2), "left");   rowExpHeader.getCell(2).value = "Expense Category";
  applyTableHeaderStyle(rowExpHeader.getCell(3), "left");
  applyTableHeaderStyle(rowExpHeader.getCell(4), "left");   rowExpHeader.getCell(4).value = "Description";
  applyTableHeaderStyle(rowExpHeader.getCell(5), "left");   rowExpHeader.getCell(5).value = "Vendor";
  applyTableHeaderStyle(rowExpHeader.getCell(6), "right");  rowExpHeader.getCell(6).value = "Amount (BDT)";
  applyTableHeaderStyle(rowExpHeader.getCell(7), "left");   rowExpHeader.getCell(7).value = "Notes / Audits";
  txRowCursor++;

  if (expenses.length === 0) {
    worksheet.mergeCells(`A${txRowCursor}:G${txRowCursor}`);
    const emptyCell = worksheet.getCell(`A${txRowCursor}`);
    emptyCell.value = "No project expenses recorded.";
    emptyCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF64748B" } };
    emptyCell.alignment = { vertical: "middle", horizontal: "center" };
    emptyCell.border = borderThin;
    worksheet.getRow(txRowCursor).height = 24;
    txRowCursor++;
  } else {
    expenses.forEach((e) => {
      const row = worksheet.getRow(txRowCursor);
      row.height = 20;

      // Date
      applyValueStyle(row.getCell(1)); row.getCell(1).value = e.date;

      // Category (Merged across B & C)
      worksheet.mergeCells(`B${txRowCursor}:C${txRowCursor}`);
      applyValueStyle(row.getCell(2), { bold: true }); row.getCell(2).value = e.category;
      applyBorder(row.getCell(3));

      // Description, Vendor, Amount, Notes
      applyValueStyle(row.getCell(4)); row.getCell(4).value = e.description || "-";
      applyValueStyle(row.getCell(5)); row.getCell(5).value = e.vendor || "-";
      applyValueStyle(row.getCell(6), { align: "right", numFmt: "৳#,##0", color: "FFB91C1C", bold: true });
      row.getCell(6).value = Number(e.amount);
      applyValueStyle(row.getCell(7)); row.getCell(7).value = e.notes || "-";

      txRowCursor++;
    });

    // Add Expenses Total Row
    const totalRow = worksheet.getRow(txRowCursor);
    totalRow.height = 22;
    worksheet.mergeCells(`A${txRowCursor}:E${txRowCursor}`);
    for (let c = 1; c <= 5; c++) {
      totalRow.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" } // Slate 100
      };
      totalRow.getCell(c).border = borderThin;
      if (c === 1) {
        totalRow.getCell(c).value = "Total Outflow Accumulation:";
        totalRow.getCell(c).font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF0F172A" } };
        totalRow.getCell(c).alignment = { vertical: "middle", horizontal: "right" };
      }
    }
    applyValueStyle(totalRow.getCell(6), { align: "right", numFmt: "৳#,##0", color: "FFB91C1C", bold: true });
    totalRow.getCell(6).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" }
    };
    totalRow.getCell(6).value = Number(summary.totalExpense);

    applyValueStyle(totalRow.getCell(7));
    totalRow.getCell(7).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" }
    };

    txRowCursor++;
  }

  // Spacing row
  worksheet.getRow(txRowCursor).height = 12;
  txRowCursor++;

  // --- 7. FOOTER BAR ---
  worksheet.mergeCells(`A${txRowCursor}:G${txRowCursor}`);
  const footerCell = worksheet.getCell(`A${txRowCursor}`);
  footerCell.value = "CONFIDENTIAL SECURITY DOCUMENT • PRODUCED BY UN RIVER VIEW MANAGEMENT PORTAL";
  footerCell.font = { name: "Segoe UI", size: 8, bold: true, color: { argb: "FF94A3B8" } };
  footerCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(txRowCursor).height = 20;

  // Generate Excel stream buffer and prompt file download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  
  const cleanName = user.name.toLowerCase().replace(/\s+/g, "_");
  const filename = `${cleanName}_portfolio_statement.xlsx`;

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
