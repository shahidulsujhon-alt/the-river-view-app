/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  DISABLED = "DISABLED",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  DECLINED = "DECLINED",
}

export type ExpenseCategory = string;

export interface User {
  id: string;
  name: string;
  mobile: string;
  email: string;
  role: UserRole;
  shares: number;          // Share Quantity
  status: UserStatus;
  photo?: string;
  // Included fields for convenience in lists:
  totalShareValue: number; // Calculated as shares * pricePerShare
  depositAmount: number;   // Calculated as sum of approved deposits
  dueAmount: number;       // Calculated as totalShareValue - depositAmount
}

export interface UserWithPassword extends User {
  passwordHash: string;
}

export interface DepositEntry {
  id: string;
  amount: number;
  date: string;
  bankName?: string;
  chequeNumber?: string;
  reference: string;
  notes?: string;
  documentUrl?: string;
  fileName?: string;
}

export interface Deposit {
  id: string;
  userId: string;
  userName: string; // denormalized or populated for display
  amount: number;
  date: string;
  bankName?: string;
  chequeNumber?: string;
  reference: string;
  notes?: string;
  documentUrl?: string;
  fileName?: string;
  status: TransactionStatus;
  approvedBy?: string; // Admin Name
  remarks?: string;    // Comment (mandatory if declined)
  createdAt: string;
}

export interface WithdrawalEntry {
  id: string;
  amount: number;
  date: string;
  chequeNumber?: string;
  reference: string;
  notes?: string;
  documentUrl?: string;
  fileName?: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  userName: string; // denormalized or populated for display
  amount: number;
  date: string;
  chequeNumber?: string;
  reference: string;
  notes?: string;
  documentUrl?: string;
  fileName?: string;
  status: TransactionStatus;
  approvedBy?: string; // Admin Name
  remarks?: string;    // Comment (mandatory if declined)
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  vendor: string;
  receiptUrl?: string;
  fileName?: string;
  notes?: string;
  createdBy: string; // Admin Name
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  date: string;
  adminName: string;
  action: string;
  remarks?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export interface FinancialSummary {
  totalShareValue: number;
  totalDeposit: number;
  totalExpense: number;
  currentBalance: number;
  expensePerShare: number;
  totalDue: number;
}
