/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import {
  loadDatabase,
  getUsers,
  getUser,
  getUserWithPasswordByEmail,
  createUser,
  updateUser,
  resetPassword,
  getDeposits,
  createDeposit,
  updateDepositStatus,
  getWithdrawals,
  createWithdrawal,
  updateWithdrawalStatus,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getActivityLogs,
  addActivityLog,
  getNotifications,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getFinancialSummary,
  hashPassword,
  deleteDeposit,
  deleteWithdrawal,
  clearAllLedgerData,
  resetDatabaseToDefaults,
  cleanIndividualData,
  restoreDatabase,
  deleteUser,
} from "./server/db.js";
import {
  UserRole,
  UserStatus,
  TransactionStatus,
  ExpenseCategory,
} from "./src/types.js";

// Extend Express Request interface to include the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize and load database
  loadDatabase();

  // Configure middleware with large limit for base64 uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // In-memory sessions map (sessionId -> userId)
  const sessions = new Map<string, string>();

  // Ensure uploads directory exists and serve static files from it
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));

  // Authentication Middleware
  const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }
    const sessionId = authHeader.split(" ")[1];
    const userId = sessions.get(sessionId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Session expired or invalid" });
    }
    const user = getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }
    if (user.status === UserStatus.DISABLED) {
      return res.status(401).json({ error: "Unauthorized: Your account has been disabled" });
    }
    req.user = user;
    next();
  };

  // Admin Role Gate Middleware
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    next();
  };

  // --- API ROUTES ---

  // Auth: Login
  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = getUserWithPasswordByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (user.status === UserStatus.DISABLED) {
        return res.status(401).json({ error: "Your account is disabled. Please contact admin." });
      }

      const inputHash = hashPassword(password);
      if (user.passwordHash !== inputHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Generate session
      const sessionId = `sess-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      sessions.set(sessionId, user.id);

      const { passwordHash, ...safeUser } = user;
      res.json({
        token: sessionId,
        user: safeUser,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Auth: Register
  app.post("/api/auth/register", (req, res) => {
    try {
      const { name, email, mobile, shares, password } = req.body;
      if (!name || !email || !mobile || password === undefined) {
        return res.status(400).json({ error: "Name, email, mobile, and password are required" });
      }

      const existingUser = getUserWithPasswordByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email is already registered" });
      }

      // Check if this is the first user
      const users = getUsers();
      const isFirstUser = users.length === 0;

      const role = isFirstUser ? UserRole.ADMIN : UserRole.USER;
      const status = UserStatus.ACTIVE;
      const passHash = hashPassword(password);

      const newUser = createUser({
        name,
        email,
        mobile,
        role,
        shares: Number(shares) || 0,
        status,
        passwordHash: passHash,
      });

      // Add log
      addActivityLog({
        adminName: isFirstUser ? "System" : name,
        action: "User self-registered",
        remarks: `${name} registered successfully as ${role.toLowerCase()}.`
      });

      // Generate session
      const sessionId = `sess-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      sessions.set(sessionId, newUser.id);

      res.json({
        token: sessionId,
        user: newUser,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  // Auth: Logout
  app.post("/api/auth/logout", authenticate, (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const sessionId = authHeader.split(" ")[1];
      sessions.delete(sessionId);
    }
    res.json({ success: true, message: "Logged out successfully" });
  });

  // Auth: Get current user
  app.get("/api/auth/me", authenticate, (req, res) => {
    res.json({ user: req.user });
  });

  // Dashboard: Financial Summary
  app.get("/api/dashboard/summary", authenticate, (req, res) => {
    try {
      const summary = getFinancialSummary();
      res.json(summary);
    } catch (e) {
      res.status(500).json({ error: "Failed to load financial summary" });
    }
  });

  // Dashboard: Transactions List (Deposits & Withdrawals combined)
  app.get("/api/dashboard/transactions", authenticate, (req, res) => {
    try {
      const user = req.user;
      let deposits = getDeposits();
      let withdrawals = getWithdrawals();

      // If general user, filter by their own ID
      if (user.role === UserRole.USER) {
        deposits = deposits.filter((d) => d.userId === user.id);
        withdrawals = withdrawals.filter((w) => w.userId === user.id);
      }

      // Map to consistent format
      const txDeposits = deposits.map((d) => ({
        id: d.id,
        date: d.date,
        user: d.userName,
        type: "Deposit" as const,
        amount: d.amount,
        status: d.status,
        approvedBy: d.approvedBy || "-",
        remarks: d.remarks || d.notes || "-",
        reference: d.reference,
        bankName: d.bankName || "-",
        chequeNumber: d.chequeNumber || "-",
        documentUrl: d.documentUrl || null,
        fileName: d.fileName || null,
        createdAt: d.createdAt,
      }));

      const txWithdrawals = withdrawals.map((w) => ({
        id: w.id,
        date: w.date,
        user: w.userName,
        type: "Withdrawal" as const,
        amount: w.amount,
        status: w.status,
        approvedBy: w.approvedBy || "-",
        remarks: w.remarks || w.notes || "-",
        reference: w.reference,
        bankName: "-",
        chequeNumber: w.chequeNumber || "-",
        documentUrl: w.documentUrl || null,
        fileName: w.fileName || null,
        createdAt: w.createdAt,
      }));

      const allTx = [...txDeposits, ...txWithdrawals].sort((a, b) => {
        // Sort descending by date and time
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      res.json(allTx);
    } catch (e) {
      res.status(500).json({ error: "Failed to load transactions" });
    }
  });

  // Dashboard: Activity Logs (Admin and General users can see, but mainly lists admin activity)
  app.get("/api/dashboard/activity-logs", authenticate, (req, res) => {
    try {
      const logs = getActivityLogs();
      res.json(logs.slice(0, 50)); // Return top 50 logs
    } catch (e) {
      res.status(500).json({ error: "Failed to load activity logs" });
    }
  });

  // Upload File
  app.post("/api/upload", authenticate, (req, res) => {
    try {
      const { fileData, fileName, fileType } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: "No file data provided" });
      }

      // Extract base64
      const base64Str = fileData.split(";base64,").pop();
      if (!base64Str) {
        return res.status(400).json({ error: "Invalid base64 encoding" });
      }

      const buffer = Buffer.from(base64Str, "base64");

      // Verify file size limit of 10 MB
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "File size exceeds 10 MB limit" });
      }

      // Verify extensions
      const ext = path.extname(fileName).toLowerCase();
      if (![".jpg", ".jpeg", ".png", ".pdf"].includes(ext)) {
        return res.status(400).json({ error: "Only JPG, PNG, and PDF uploads are supported" });
      }

      const uniqueFileName = `${Date.now()}-${Math.floor(Math.random() * 100000)}${ext}`;
      const filePath = path.join(uploadsDir, uniqueFileName);

      fs.writeFileSync(filePath, buffer);

      res.json({
        url: `/uploads/${uniqueFileName}`,
        fileName,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "File upload failed" });
    }
  });

  // CRUD - Deposits
  app.get("/api/deposits", authenticate, (req, res) => {
    try {
      let deposits = getDeposits();
      if (req.user.role === UserRole.USER) {
        deposits = deposits.filter((d) => d.userId === req.user.id);
      }
      res.json(deposits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch deposits" });
    }
  });

  // Multiple entries submitted using "+" button
  app.post("/api/deposits", authenticate, (req, res) => {
    try {
      const { entries } = req.body; // array of deposit entries
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: "Deposits entries array is required" });
      }

      const added = [];
      for (const entry of entries) {
        const deposit = createDeposit({
          userId: req.user.role === UserRole.ADMIN ? (entry.userId || req.user.id) : req.user.id,
          amount: Number(entry.amount),
          date: entry.date,
          bankName: entry.bankName,
          chequeNumber: entry.chequeNumber,
          reference: entry.reference || `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          notes: entry.notes,
          documentUrl: entry.documentUrl,
          fileName: entry.fileName,
          status: TransactionStatus.PENDING,
        });
        added.push(deposit);
      }

      // Admin logs
      const userObj = req.user;
      addActivityLog({
        adminName: userObj.name,
        action: "Deposit Requested",
        remarks: `Submitted ${entries.length} deposit request(s) total BDT ${entries.reduce((s, e) => s + Number(e.amount), 0).toLocaleString()}`,
      });

      res.status(201).json(added);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to submit deposits" });
    }
  });

  // Approve Deposit (Admin Only)
  app.put("/api/deposits/:id/approve", authenticate, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { remarks } = req.body;
      const dep = updateDepositStatus(id, TransactionStatus.APPROVED, req.user.name, remarks);
      if (!dep) {
        return res.status(404).json({ error: "Deposit request not found" });
      }

      addActivityLog({
        adminName: req.user.name,
        action: "Approved Deposit",
        remarks: `Approved Deposit of BDT ${dep.amount.toLocaleString()} for ${dep.userName} (${dep.id}). Remarks: ${remarks || "None"}`,
      });

      res.json(dep);
    } catch (e) {
      res.status(500).json({ error: "Failed to approve deposit" });
    }
  });

  // Decline Deposit (Admin Only)
  app.put("/api/deposits/:id/decline", authenticate, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { remarks } = req.body;
      if (!remarks || remarks.trim() === "") {
        return res.status(400).json({ error: "Decline comments are mandatory" });
      }

      const dep = updateDepositStatus(id, TransactionStatus.DECLINED, req.user.name, remarks);
      if (!dep) {
        return res.status(404).json({ error: "Deposit request not found" });
      }

      addActivityLog({
        adminName: req.user.name,
        action: "Declined Deposit",
        remarks: `Declined Deposit of BDT ${dep.amount.toLocaleString()} for ${dep.userName} (${dep.id}). Remarks: ${remarks}`,
      });

      res.json(dep);
    } catch (e) {
      res.status(500).json({ error: "Failed to decline deposit" });
    }
  });

  // CRUD - Withdrawals
  app.get("/api/withdrawals", authenticate, (req, res) => {
    try {
      let withdrawals = getWithdrawals();
      if (req.user.role === UserRole.USER) {
        withdrawals = withdrawals.filter((w) => w.userId === req.user.id);
      }
      res.json(withdrawals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch withdrawals" });
    }
  });

  app.post("/api/withdrawals", authenticate, (req, res) => {
    try {
      const { entries } = req.body;
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: "Withdrawal entries array is required" });
      }

      const added = [];
      for (const entry of entries) {
        const wth = createWithdrawal({
          userId: req.user.role === UserRole.ADMIN ? (entry.userId || req.user.id) : req.user.id,
          amount: Number(entry.amount),
          date: entry.date,
          chequeNumber: entry.chequeNumber,
          reference: entry.reference || `WTH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          notes: entry.notes,
          documentUrl: entry.documentUrl,
          fileName: entry.fileName,
          status: TransactionStatus.PENDING,
        });
        added.push(wth);
      }

      addActivityLog({
        adminName: req.user.name,
        action: "Withdrawal Requested",
        remarks: `Submitted ${entries.length} withdrawal request(s) total BDT ${entries.reduce((s, e) => s + Number(e.amount), 0).toLocaleString()}`,
      });

      res.status(201).json(added);
    } catch (e) {
      res.status(500).json({ error: "Failed to submit withdrawals" });
    }
  });

  app.put("/api/withdrawals/:id/approve", authenticate, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { remarks } = req.body;
      const wth = updateWithdrawalStatus(id, TransactionStatus.APPROVED, req.user.name, remarks);
      if (!wth) {
        return res.status(404).json({ error: "Withdrawal request not found" });
      }

      addActivityLog({
        adminName: req.user.name,
        action: "Approved Withdrawal",
        remarks: `Approved Withdrawal of BDT ${wth.amount.toLocaleString()} for ${wth.userName} (${wth.id}). Remarks: ${remarks || "None"}`,
      });

      res.json(wth);
    } catch (e) {
      res.status(500).json({ error: "Failed to approve withdrawal" });
    }
  });

  app.put("/api/withdrawals/:id/decline", authenticate, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { remarks } = req.body;
      if (!remarks || remarks.trim() === "") {
        return res.status(400).json({ error: "Decline comments are mandatory" });
      }

      const wth = updateWithdrawalStatus(id, TransactionStatus.DECLINED, req.user.name, remarks);
      if (!wth) {
        return res.status(404).json({ error: "Withdrawal request not found" });
      }

      addActivityLog({
        adminName: req.user.name,
        action: "Declined Withdrawal",
        remarks: `Declined Withdrawal of BDT ${wth.amount.toLocaleString()} for ${wth.userName} (${wth.id}). Remarks: ${remarks}`,
      });

      res.json(wth);
    } catch (e) {
      res.status(500).json({ error: "Failed to decline withdrawal" });
    }
  });

  // CRUD - Expenses
  app.get("/api/expenses", authenticate, (req, res) => {
    try {
      const expenses = getExpenses();
      res.json(expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", authenticate, (req, res) => {
    try {
      const { date, category, description, amount, vendor, receiptUrl, fileName, notes } = req.body;
      if (!date || !category || !description || !amount || !vendor) {
        return res.status(400).json({ error: "Date, category, description, amount, and vendor are required" });
      }

      const expense = createExpense({
        date,
        category: category as ExpenseCategory,
        description,
        amount: Number(amount),
        vendor,
        receiptUrl,
        fileName,
        notes,
        createdBy: req.user.name,
      });

      addActivityLog({
        adminName: req.user.name,
        action: "Expense added",
        remarks: `Added Expense: BDT ${expense.amount.toLocaleString()} - ${expense.category} (${expense.description}) paid to ${expense.vendor}`,
      });

      res.status(201).json(expense);
    } catch (e) {
      res.status(500).json({ error: "Failed to add expense" });
    }
  });

  app.put("/api/expenses/:id", authenticate, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { date, category, description, amount, vendor, receiptUrl, fileName, notes } = req.body;

      const expense = updateExpense(id, {
        ...(date && { date }),
        ...(category && { category: category as ExpenseCategory }),
        ...(description && { description }),
        ...(amount && { amount: Number(amount) }),
        ...(vendor && { vendor }),
        ...(receiptUrl !== undefined && { receiptUrl }),
        ...(fileName !== undefined && { fileName }),
        ...(notes !== undefined && { notes }),
      });

      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }

      addActivityLog({
        adminName: req.user.name,
        action: "Expense edited",
        remarks: `Updated Expense: BDT ${expense.amount.toLocaleString()} - ${expense.category} (${expense.description}) paid to ${expense.vendor}`,
      });

      res.json(expense);
    } catch (e) {
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", authenticate, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const expense = getExpenses().find((e) => e.id === id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }

      const success = deleteExpense(id);
      if (success) {
        addActivityLog({
          adminName: req.user.name,
          action: "Expense removed",
          remarks: `Deleted Expense: BDT ${expense.amount.toLocaleString()} - ${expense.category} (${expense.description}) from ${expense.vendor}`,
        });
        res.json({ success: true, message: "Expense deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete expense" });
      }
    } catch (e) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // Admin bulk import of transactions (Deposits & Withdrawals)
  app.post("/api/admin/bulk-import", authenticate, requireAdmin, (req, res) => {
    try {
      const { transactions } = req.body;
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({ error: "Transactions array is required" });
      }

      const added = [];
      for (const tx of transactions) {
        const status = tx.status === TransactionStatus.APPROVED ? TransactionStatus.APPROVED : TransactionStatus.PENDING;
        if (tx.type === "Deposit") {
          const deposit = createDeposit({
            userId: tx.userId,
            amount: Number(tx.amount),
            date: tx.date || new Date().toISOString().split("T")[0],
            bankName: tx.bankName || undefined,
            chequeNumber: tx.chequeNumber || undefined,
            reference: tx.reference || `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            notes: tx.notes || undefined,
            status,
            approvedBy: status === TransactionStatus.APPROVED ? req.user.name : undefined,
          });
          added.push({ id: deposit.id, type: "Deposit" });
        } else if (tx.type === "Withdrawal") {
          const withdrawal = createWithdrawal({
            userId: tx.userId,
            amount: Number(tx.amount),
            date: tx.date || new Date().toISOString().split("T")[0],
            chequeNumber: tx.chequeNumber || undefined,
            reference: tx.reference || `WTH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            notes: tx.notes || undefined,
            status,
            approvedBy: status === TransactionStatus.APPROVED ? req.user.name : undefined,
          });
          added.push({ id: withdrawal.id, type: "Withdrawal" });
        }
      }

      addActivityLog({
        adminName: req.user.name,
        action: "Bulk Transactions Imported",
        remarks: `Bulk imported ${transactions.length} transaction(s) directly from file.`,
      });

      res.status(201).json({ success: true, count: added.length });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to bulk import transactions" });
    }
  });

  // Delete a Deposit Transaction
  app.delete("/api/admin/transactions/deposit/:id", authenticate, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const deposits = getDeposits();
      const dep = deposits.find((d) => d.id === id);
      if (!dep) {
        return res.status(404).json({ error: "Deposit transaction not found" });
      }
      const success = deleteDeposit(id);
      if (success) {
        addActivityLog({
          adminName: req.user.name,
          action: "Deleted Deposit Transaction",
          remarks: `Deleted Deposit of BDT ${dep.amount.toLocaleString()} for ${dep.userName} (Reference: ${dep.reference})`,
        });
        res.json({ success: true, message: "Deposit deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete deposit" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to delete deposit" });
    }
  });

  // Delete a Withdrawal Transaction
  app.delete("/api/admin/transactions/withdrawal/:id", authenticate, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const withdrawals = getWithdrawals();
      const wth = withdrawals.find((w) => w.id === id);
      if (!wth) {
        return res.status(404).json({ error: "Withdrawal transaction not found" });
      }
      const success = deleteWithdrawal(id);
      if (success) {
        addActivityLog({
          adminName: req.user.name,
          action: "Deleted Withdrawal Transaction",
          remarks: `Deleted Withdrawal of BDT ${wth.amount.toLocaleString()} for ${wth.userName} (Reference: ${wth.reference})`,
        });
        res.json({ success: true, message: "Withdrawal deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete withdrawal" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to delete withdrawal" });
    }
  });

  // Backup entire database as JSON file
  app.get("/api/admin/backup", authenticate, requireAdmin, (req, res) => {
    try {
      const dbData = loadDatabase();
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=ledger_backup_${Date.now()}.json`);
      res.json(dbData);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to generate backup" });
    }
  });

  // Restore database from uploaded JSON
  app.post("/api/admin/restore", authenticate, requireAdmin, (req, res) => {
    try {
      const { backup } = req.body;
      if (!backup) {
        return res.status(400).json({ error: "Backup data is required" });
      }
      const success = restoreDatabase(backup);
      if (success) {
        addActivityLog({
          adminName: req.user.name,
          action: "Database Restored",
          remarks: "Successfully restored database parameters from backup file.",
        });
        res.json({ success: true, message: "Database restored successfully" });
      } else {
        res.status(400).json({ error: "Invalid backup file structure" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to restore database" });
    }
  });

  // Clean application data
  app.post("/api/admin/clean", authenticate, requireAdmin, (req, res) => {
    try {
      const { actionType, userId } = req.body;
      if (actionType === "all_ledger") {
        clearAllLedgerData();
        addActivityLog({
          adminName: req.user.name,
          action: "Cleared All Ledger",
          remarks: "Admin wiped all transactions, expenses, and resets shareholder balances.",
        });
        res.json({ success: true, message: "All financial ledger data wiped successfully" });
      } else if (actionType === "factory_reset") {
        resetDatabaseToDefaults();
        addActivityLog({
          adminName: req.user.name,
          action: "Factory Reset",
          remarks: "Admin reset database to factory seeds and default configurations.",
        });
        res.json({ success: true, message: "Database reset to factory defaults successfully" });
      } else if (actionType === "individual") {
        if (!userId) {
          return res.status(400).json({ error: "User ID is required for individual clean" });
        }
        const user = getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "Shareholder not found" });
        }
        const success = cleanIndividualData(userId);
        if (success) {
          addActivityLog({
            adminName: req.user.name,
            action: "Cleared Individual Ledger",
            remarks: `Wiped all ledger records (deposits/withdrawals) for ${user.name}.`,
          });
          res.json({ success: true, message: `Successfully cleared financial records for ${user.name}` });
        } else {
          res.status(500).json({ error: "Failed to clear individual shareholder records" });
        }
      } else {
        res.status(400).json({ error: "Invalid clean action request" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to clean app data" });
    }
  });

  // CRUD - Users / Shareholder Management
  app.get("/api/users", authenticate, (req, res) => {
    try {
      // Both admin and users can view the general shareholders list, but only admin can manage them
      const users = getUsers();
      res.json(users);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", authenticate, requireAdmin, (req, res) => {
    try {
      const { name, mobile, email, shares, photo, status, password } = req.body;
      if (!name || !email || !mobile || shares === undefined) {
        return res.status(400).json({ error: "Name, email, mobile, and shares are required" });
      }

      const existing = getUserWithPasswordByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const user = createUser({
        name,
        mobile,
        email,
        role: UserRole.USER,
        shares: Number(shares),
        status: (status as UserStatus) || UserStatus.ACTIVE,
        photo: photo || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80",
        passwordHash: hashPassword(password || "password"),
      });

      addActivityLog({
        adminName: req.user.name,
        action: "User created",
        remarks: `Registered new shareholder: ${user.name} with ${user.shares} shares. Email: ${user.email}`,
      });

      res.status(201).json(user);
    } catch (e) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", authenticate, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { name, mobile, email, shares, photo, status } = req.body;

      const updated = updateUser(id, {
        ...(name && { name }),
        ...(mobile && { mobile }),
        ...(email && { email }),
        ...(shares !== undefined && { shares: Number(shares) }),
        ...(photo !== undefined && { photo }),
        ...(status && { status: status as UserStatus }),
      });

      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }

      addActivityLog({
        adminName: req.user.name,
        action: "User edited",
        remarks: `Updated profile for shareholder: ${updated.name} (Shares: ${updated.shares}, Status: ${updated.status})`,
      });

      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.put("/api/users/:id/reset-password", authenticate, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      if (!password || password.trim() === "") {
        return res.status(400).json({ error: "New password is required" });
      }

      const success = resetPassword(id, hashPassword(password));
      const user = getUser(id);
      if (!success || !user) {
        return res.status(404).json({ error: "User not found" });
      }

      addActivityLog({
        adminName: req.user.name,
        action: "Reset Password",
        remarks: `Reset password for shareholder: ${user.name} (${user.email})`,
      });

      res.json({ success: true, message: "Password reset successfully" });
    } catch (e) {
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Admin disabling a user
  app.put("/api/users/:id/toggle-status", authenticate, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const current = getUser(id);
      if (!current) {
        return res.status(404).json({ error: "User not found" });
      }

      const newStatus = current.status === UserStatus.ACTIVE ? UserStatus.DISABLED : UserStatus.ACTIVE;
      const updated = updateUser(id, { status: newStatus });

      addActivityLog({
        adminName: req.user.name,
        action: newStatus === UserStatus.DISABLED ? "User disabled" : "User enabled",
        remarks: `${newStatus === UserStatus.DISABLED ? "Disabled" : "Enabled"} shareholder account: ${current.name} (${current.email})`,
      });

      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: "Failed to toggle user status" });
    }
  });

  // Admin deleting a user
  app.delete("/api/users/:id", authenticate, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const current = getUser(id);
      if (!current) {
        return res.status(404).json({ error: "User not found" });
      }

      const success = deleteUser(id);
      if (success) {
        addActivityLog({
          adminName: req.user.name,
          action: "User deleted",
          remarks: `Permanently deleted shareholder account and wiped associated transaction histories for: ${current.name} (${current.email})`,
        });
        res.json({ success: true, message: "User deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete user" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to delete user" });
    }
  });

  // Notifications
  app.get("/api/notifications", authenticate, (req, res) => {
    try {
      const ntfs = getNotifications(req.user.id);
      res.json(ntfs);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.put("/api/notifications/:id/read", authenticate, (req, res) => {
    try {
      const { id } = req.params;
      const success = markNotificationAsRead(id);
      res.json({ success });
    } catch (e) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.put("/api/notifications/read-all", authenticate, (req, res) => {
    try {
      const success = markAllNotificationsAsRead(req.user.id);
      res.json({ success });
    } catch (e) {
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // --- VITE MIDDLEWARE AND STATIC FILES ---

  if (process.env.NODE_ENV !== "production") {
    // Development Mode: Use Vite dev server as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode: Serve built static files from /dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start Server
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (Production: ${process.env.NODE_ENV === "production"})`);
  });
}

startServer();
