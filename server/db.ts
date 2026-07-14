/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  User,
  UserWithPassword,
  UserRole,
  UserStatus,
  Deposit,
  Withdrawal,
  Expense,
  ActivityLog,
  Notification,
  TransactionStatus,
  FinancialSummary,
  ExpenseCategory,
} from "../src/types.js"; // note: using relative path

const DB_PATH = path.join(process.cwd(), "data", "db.json");
const SHARE_PRICE = 50000; // $50,000 per share

interface DatabaseSchema {
  users: UserWithPassword[];
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  expenses: Expense[];
  activityLogs: ActivityLog[];
  notifications: Notification[];
  sharePrice: number;
}

// Secure password hashing helper
export function hashPassword(password: string): string {
  return crypto
    .pbkdf2Sync(password, "UN_RIVER_VIEW_SALT_SECRET", 1000, 64, "sha512")
    .toString("hex");
}

// Initial seeding of the database
function getInitialData(): DatabaseSchema {
  const seededUsers: UserWithPassword[] = [];

  const seededDeposits: Deposit[] = [];
  const seededWithdrawals: Withdrawal[] = [];
  const seededExpenses: Expense[] = [];

  const seededLogs: ActivityLog[] = [
    {
      id: "log-init",
      date: new Date().toISOString(),
      adminName: "System",
      action: "Portal initialized",
      remarks: "Secure asset management system initialized with Admin credentials.",
    },
  ];

  const seededNotifications: Notification[] = [];

  return {
    users: seededUsers,
    deposits: seededDeposits,
    withdrawals: seededWithdrawals,
    expenses: seededExpenses,
    activityLogs: seededLogs,
    notifications: seededNotifications,
    sharePrice: SHARE_PRICE,
  };
}

// Lowdb-style memory/file database instance
let database: DatabaseSchema = {
  users: [],
  deposits: [],
  withdrawals: [],
  expenses: [],
  activityLogs: [],
  notifications: [],
  sharePrice: SHARE_PRICE,
};

// Guard read-write
let isDbLoaded = false;

export function loadDatabase(): DatabaseSchema {
  if (isDbLoaded) {
    return database;
  }

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    try {
      const dataStr = fs.readFileSync(DB_PATH, "utf8");
      database = JSON.parse(dataStr);
      isDbLoaded = true;
      // Recalculate dynamic user fields on start to ensure integrity
      recalculateAllUsers();
      return database;
    } catch (e) {
      console.error("Error parsing db.json, seeding new database.", e);
    }
  }

  // Seed new DB
  database = getInitialData();
  saveDatabase();
  isDbLoaded = true;
  return database;
}

export function saveDatabase(): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), "utf8");
}

// Recalculate dynamic values for a user: totalShareValue, depositAmount, dueAmount
export function recalculateUserFields(user: User): void {
  const approvedDeposits = database.deposits
    .filter((d) => d.userId === user.id && d.status === TransactionStatus.APPROVED)
    .reduce((sum, d) => sum + d.amount, 0);

  const approvedWithdrawals = database.withdrawals
    .filter((w) => w.userId === user.id && w.status === TransactionStatus.APPROVED)
    .reduce((sum, w) => sum + w.amount, 0);

  user.totalShareValue = user.shares;
  user.depositAmount = approvedDeposits;
  // Outstanding Due includes the withdrawn amounts as they represent capital that was refunded and is now due again to meet full commitment
  user.dueAmount = Math.max(0, user.totalShareValue - (approvedDeposits - approvedWithdrawals));
}

export function recalculateAllUsers(): void {
  database.users.forEach((u) => {
    recalculateUserFields(u);
  });
}

// CRUD - Users
export function getUsers(): User[] {
  loadDatabase();
  // Strip passwordHash before sending to client
  return database.users.map(({ passwordHash, ...user }) => user);
}

export function getUser(id: string): User | undefined {
  loadDatabase();
  const u = database.users.find((u) => u.id === id);
  if (!u) return undefined;
  const { passwordHash, ...user } = u;
  return user;
}

export function getUserWithPasswordByEmail(email: string): UserWithPassword | undefined {
  loadDatabase();
  return database.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function createUser(
  user: Omit<UserWithPassword, "id" | "totalShareValue" | "depositAmount" | "dueAmount">
): User {
  loadDatabase();
  const newId = `usr-${Date.now()}`;
  const fullUser: UserWithPassword = {
    ...user,
    id: newId,
    totalShareValue: user.shares,
    depositAmount: 0,
    dueAmount: user.shares,
  };
  database.users.push(fullUser);
  saveDatabase();
  const { passwordHash, ...safeUser } = fullUser;
  return safeUser;
}

export function updateUser(id: string, updates: Partial<UserWithPassword>): User | undefined {
  loadDatabase();
  const idx = database.users.findIndex((u) => u.id === id);
  if (idx === -1) return undefined;

  const current = database.users[idx];
  const updatedUser: UserWithPassword = {
    ...current,
    ...updates,
    id, // protect ID
  };

  if (updates.shares !== undefined) {
    updatedUser.totalShareValue = updates.shares;
  }

  database.users[idx] = updatedUser;
  recalculateUserFields(database.users[idx]);
  saveDatabase();

  const { passwordHash, ...safeUser } = database.users[idx];
  return safeUser;
}

export function resetPassword(userId: string, newPasswordHash: string): boolean {
  loadDatabase();
  const idx = database.users.findIndex((u) => u.id === userId);
  if (idx === -1) return false;
  database.users[idx].passwordHash = newPasswordHash;
  saveDatabase();
  return true;
}

// CRUD - Deposits
export function getDeposits(): Deposit[] {
  loadDatabase();
  return database.deposits;
}

export function createDeposit(depData: Omit<Deposit, "id" | "userName" | "createdAt">): Deposit {
  loadDatabase();
  const user = getUser(depData.userId);
  const userName = user ? user.name : "Unknown User";

  const newDeposit: Deposit = {
    ...depData,
    id: `dep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userName,
    createdAt: new Date().toISOString(),
  };

  database.deposits.push(newDeposit);
  if (newDeposit.status === TransactionStatus.APPROVED) {
    recalculateAllUsers();
  }
  saveDatabase();
  return newDeposit;
}

export function updateDepositStatus(
  id: string,
  status: TransactionStatus,
  approvedBy: string,
  remarks?: string
): Deposit | undefined {
  loadDatabase();
  const dep = database.deposits.find((d) => d.id === id);
  if (!dep) return undefined;

  dep.status = status;
  dep.approvedBy = approvedBy;
  if (remarks !== undefined) {
    dep.remarks = remarks;
  }

  // Auto-send notification to user
  const userObj = getUser(dep.userId);
  if (userObj) {
    const statusText = status === TransactionStatus.APPROVED ? "Approved" : "Declined";
    const commentsText = remarks ? ` Comments: ${remarks}` : "";
    createNotification({
      userId: dep.userId,
      title: `Deposit ${statusText}`,
      message: `Your deposit of BDT ${dep.amount.toLocaleString()} on ${dep.date} was ${statusText.toLowerCase()}.${commentsText}`,
    });
  }

  // Recalculate user details since deposit approved/declined status changed
  recalculateAllUsers();
  saveDatabase();
  return dep;
}

// CRUD - Withdrawals
export function getWithdrawals(): Withdrawal[] {
  loadDatabase();
  return database.withdrawals;
}

export function createWithdrawal(wthData: Omit<Withdrawal, "id" | "userName" | "createdAt">): Withdrawal {
  loadDatabase();
  const user = getUser(wthData.userId);
  const userName = user ? user.name : "Unknown User";

  const newWithdrawal: Withdrawal = {
    ...wthData,
    id: `wth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userName,
    createdAt: new Date().toISOString(),
  };

  database.withdrawals.push(newWithdrawal);
  if (newWithdrawal.status === TransactionStatus.APPROVED) {
    recalculateAllUsers();
  }
  saveDatabase();
  return newWithdrawal;
}

export function updateWithdrawalStatus(
  id: string,
  status: TransactionStatus,
  approvedBy: string,
  remarks?: string
): Withdrawal | undefined {
  loadDatabase();
  const wth = database.withdrawals.find((w) => w.id === id);
  if (!wth) return undefined;

  wth.status = status;
  wth.approvedBy = approvedBy;
  if (remarks !== undefined) {
    wth.remarks = remarks;
  }

  // Auto-send notification to user
  const userObj = getUser(wth.userId);
  if (userObj) {
    const statusText = status === TransactionStatus.APPROVED ? "Approved" : "Declined";
    const commentsText = remarks ? ` Comments: ${remarks}` : "";
    createNotification({
      userId: wth.userId,
      title: `Withdrawal ${statusText}`,
      message: `Your withdrawal of BDT ${wth.amount.toLocaleString()} on ${wth.date} was ${statusText.toLowerCase()}.${commentsText}`,
    });
  }

  recalculateAllUsers();
  saveDatabase();
  return wth;
}

// CRUD - Expenses
export function getExpenses(): Expense[] {
  loadDatabase();
  return database.expenses;
}

export function createExpense(expData: Omit<Expense, "id" | "createdAt">): Expense {
  loadDatabase();
  const newExpense: Expense = {
    ...expData,
    id: `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
  };
  database.expenses.push(newExpense);
  saveDatabase();
  return newExpense;
}

export function updateExpense(id: string, updates: Partial<Expense>): Expense | undefined {
  loadDatabase();
  const idx = database.expenses.findIndex((e) => e.id === id);
  if (idx === -1) return undefined;

  database.expenses[idx] = {
    ...database.expenses[idx],
    ...updates,
    id, // protect ID
  };
  saveDatabase();
  return database.expenses[idx];
}

export function deleteExpense(id: string): boolean {
  loadDatabase();
  const lengthBefore = database.expenses.length;
  database.expenses = database.expenses.filter((e) => e.id !== id);
  if (database.expenses.length !== lengthBefore) {
    saveDatabase();
    return true;
  }
  return false;
}

export function deleteDeposit(id: string): boolean {
  loadDatabase();
  const depIndex = database.deposits.findIndex((d) => d.id === id);
  if (depIndex === -1) return false;
  const dep = database.deposits[depIndex];
  database.deposits.splice(depIndex, 1);
  if (dep.status === TransactionStatus.APPROVED) {
    recalculateAllUsers();
  }
  saveDatabase();
  return true;
}

export function deleteWithdrawal(id: string): boolean {
  loadDatabase();
  const wthIndex = database.withdrawals.findIndex((w) => w.id === id);
  if (wthIndex === -1) return false;
  const wth = database.withdrawals[wthIndex];
  database.withdrawals.splice(wthIndex, 1);
  if (wth.status === TransactionStatus.APPROVED) {
    recalculateAllUsers();
  }
  saveDatabase();
  return true;
}

export function clearAllLedgerData(): void {
  loadDatabase();
  database.deposits = [];
  database.withdrawals = [];
  database.expenses = [];
  database.notifications = [];
  // Keep users, but reset counters
  database.users.forEach((u) => {
    u.depositAmount = 0;
    u.dueAmount = u.shares;
  });
  saveDatabase();
}

export function resetDatabaseToDefaults(): void {
  database = getInitialData();
  saveDatabase();
}

export function deleteUser(id: string): boolean {
  loadDatabase();
  const idx = database.users.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  const user = database.users[idx];
  if (user.role === UserRole.ADMIN) return false;

  database.users.splice(idx, 1);
  database.deposits = database.deposits.filter((d) => d.userId !== id);
  database.withdrawals = database.withdrawals.filter((w) => w.userId !== id);
  database.notifications = database.notifications.filter((n) => n.userId !== id);

  saveDatabase();
  return true;
}

export function cleanIndividualData(userId: string): boolean {
  loadDatabase();
  const user = database.users.find((u) => u.id === userId);
  if (!user) return false;

  database.deposits = database.deposits.filter((d) => d.userId !== userId);
  database.withdrawals = database.withdrawals.filter((w) => w.userId !== userId);
  database.notifications = database.notifications.filter((n) => n.userId !== userId);

  recalculateUserFields(user);
  saveDatabase();
  return true;
}

export function restoreDatabase(backup: any): boolean {
  if (!backup || typeof backup !== "object" || !Array.isArray(backup.users)) {
    return false;
  }
  database = {
    users: backup.users || [],
    deposits: backup.deposits || [],
    withdrawals: backup.withdrawals || [],
    expenses: backup.expenses || [],
    activityLogs: backup.activityLogs || [],
    notifications: backup.notifications || [],
    sharePrice: backup.sharePrice || SHARE_PRICE,
  };
  recalculateAllUsers();
  saveDatabase();
  return true;
}

// Activity Logs
export function getActivityLogs(): ActivityLog[] {
  loadDatabase();
  return database.activityLogs;
}

export function addActivityLog(log: Omit<ActivityLog, "id" | "date">): ActivityLog {
  loadDatabase();
  const newLog: ActivityLog = {
    ...log,
    id: `log-${Date.now()}`,
    date: new Date().toISOString(),
  };
  database.activityLogs.unshift(newLog); // newest first
  saveDatabase();
  return newLog;
}

// Notifications
export function getNotifications(userId: string): Notification[] {
  loadDatabase();
  return database.notifications.filter((n) => n.userId === userId);
}

export function createNotification(ntf: Omit<Notification, "id" | "date" | "read">): Notification {
  loadDatabase();
  const newNtf: Notification = {
    ...ntf,
    id: `ntf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date: new Date().toISOString(),
    read: false,
  };
  database.notifications.unshift(newNtf);
  saveDatabase();
  return newNtf;
}

export function markNotificationAsRead(id: string): boolean {
  loadDatabase();
  const n = database.notifications.find((n) => n.id === id);
  if (!n) return false;
  n.read = true;
  saveDatabase();
  return true;
}

export function markAllNotificationsAsRead(userId: string): boolean {
  loadDatabase();
  database.notifications
    .filter((n) => n.userId === userId)
    .forEach((n) => (n.read = true));
  saveDatabase();
  return true;
}

// Financial calculations
export function getFinancialSummary(): FinancialSummary {
  loadDatabase();

  const totalShareValue = database.users
    .reduce((sum, u) => sum + u.shares, 0);

  const totalDeposit = database.deposits
    .filter((d) => d.status === TransactionStatus.APPROVED)
    .reduce((sum, d) => sum + d.amount, 0);

  const totalExpense = database.expenses.reduce((sum, e) => sum + e.amount, 0);

  const totalWithdrawal = database.withdrawals
    .filter((w) => w.status === TransactionStatus.APPROVED)
    .reduce((sum, w) => sum + w.amount, 0);

  const currentBalance = totalDeposit - totalWithdrawal - totalExpense;

  const totalShares = database.users
    .reduce((sum, u) => sum + u.shares, 0);

  const expensePerShare = totalShares > 0 ? totalExpense / totalShares : 0;

  const totalDue = Math.max(0, totalShareValue - (totalDeposit - totalWithdrawal));

  return {
    totalShareValue,
    totalDeposit,
    totalExpense,
    currentBalance,
    expensePerShare,
    totalDue,
  };
}
