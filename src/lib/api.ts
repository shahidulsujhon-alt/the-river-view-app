/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  Deposit,
  Withdrawal,
  Expense,
  ActivityLog,
  Notification,
  FinancialSummary,
  TransactionStatus,
  UserRole,
} from "../types.js";

const TOKEN_KEY = "un_river_view_session_token";

// Get token from localStorage
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Set token in localStorage
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

// Clear token from localStorage
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Helper fetch wrapper
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errMsg = "An error occurred";
    try {
      const data = await response.json();
      errMsg = data.error || errMsg;
    } catch (e) {
      // ignore
    }
    throw new Error(errMsg);
  }

  return response.json() as Promise<T>;
}

// API Services
export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await apiFetch<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    return res;
  },

  async register(data: {
    name: string;
    email: string;
    mobile: string;
    shares: number;
    password: string;
  }): Promise<{ token: string; user: User }> {
    const res = await apiFetch<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setToken(res.token);
    return res;
  },

  async logout(): Promise<void> {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // ignore logout failure on server
    } finally {
      clearToken();
    }
  },

  async getMe(): Promise<{ user: User }> {
    return apiFetch<{ user: User }>("/api/auth/me");
  },

  // File Upload
  async uploadFile(fileName: string, fileType: string, fileData: string): Promise<{ url: string; fileName: string }> {
    return apiFetch<{ url: string; fileName: string }>("/api/upload", {
      method: "POST",
      body: JSON.stringify({ fileName, fileType, fileData }),
    });
  },

  // Dashboard
  async getSummary(): Promise<FinancialSummary> {
    return apiFetch<FinancialSummary>("/api/dashboard/summary");
  },

  async getTransactions(): Promise<any[]> {
    return apiFetch<any[]>("/api/dashboard/transactions");
  },

  async getActivityLogs(): Promise<ActivityLog[]> {
    return apiFetch<ActivityLog[]>("/api/dashboard/activity-logs");
  },

  // Deposits
  async getDeposits(): Promise<Deposit[]> {
    return apiFetch<Deposit[]>("/api/deposits");
  },

  async submitDeposits(entries: Omit<Deposit, "id" | "userId" | "userName" | "status" | "createdAt">[]): Promise<Deposit[]> {
    return apiFetch<Deposit[]>("/api/deposits", {
      method: "POST",
      body: JSON.stringify({ entries }),
    });
  },

  async approveDeposit(id: string, remarks?: string): Promise<Deposit> {
    return apiFetch<Deposit>(`/api/deposits/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify({ remarks }),
    });
  },

  async declineDeposit(id: string, remarks: string): Promise<Deposit> {
    return apiFetch<Deposit>(`/api/deposits/${id}/decline`, {
      method: "PUT",
      body: JSON.stringify({ remarks }),
    });
  },

  // Withdrawals
  async getWithdrawals(): Promise<Withdrawal[]> {
    return apiFetch<Withdrawal[]>("/api/withdrawals");
  },

  async submitWithdrawals(entries: Omit<Withdrawal, "id" | "userId" | "userName" | "status" | "createdAt">[]): Promise<Withdrawal[]> {
    return apiFetch<Withdrawal[]>("/api/withdrawals", {
      method: "POST",
      body: JSON.stringify({ entries }),
    });
  },

  async approveWithdrawal(id: string, remarks?: string): Promise<Withdrawal> {
    return apiFetch<Withdrawal>(`/api/withdrawals/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify({ remarks }),
    });
  },

  async declineWithdrawal(id: string, remarks: string): Promise<Withdrawal> {
    return apiFetch<Withdrawal>(`/api/withdrawals/${id}/decline`, {
      method: "PUT",
      body: JSON.stringify({ remarks }),
    });
  },

  // Expenses
  async getExpenses(): Promise<Expense[]> {
    return apiFetch<Expense[]>("/api/expenses");
  },

  async addExpense(expense: Omit<Expense, "id" | "createdBy" | "createdAt">): Promise<Expense> {
    return apiFetch<Expense>("/api/expenses", {
      method: "POST",
      body: JSON.stringify(expense),
    });
  },

  async editExpense(id: string, updates: Partial<Expense>): Promise<Expense> {
    return apiFetch<Expense>(`/api/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async deleteExpense(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(`/api/expenses/${id}`, {
      method: "DELETE",
    });
  },

  // Users Management
  async getUsers(): Promise<User[]> {
    return apiFetch<User[]>("/api/users");
  },

  async addUser(user: Omit<User, "id" | "totalShareValue" | "depositAmount" | "dueAmount"> & { password?: string }): Promise<User> {
    return apiFetch<User>("/api/users", {
      method: "POST",
      body: JSON.stringify(user),
    });
  },

  async editUser(id: string, updates: Partial<User>): Promise<User> {
    return apiFetch<User>(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async toggleUserStatus(id: string): Promise<User> {
    return apiFetch<User>(`/api/users/${id}/toggle-status`, {
      method: "PUT",
    });
  },

  async resetPassword(id: string, passwordHash: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(`/api/users/${id}/reset-password`, {
      method: "PUT",
      body: JSON.stringify({ password: passwordHash }),
    });
  },

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    return apiFetch<Notification[]>("/api/notifications");
  },

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/notifications/${id}/read`, {
      method: "PUT",
    });
  },

  async markAllNotificationsRead(): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>("/api/notifications/read-all", {
      method: "PUT",
    });
  },

  // Bulk Transactions Import
  async bulkImportTransactions(transactions: any[]): Promise<{ success: boolean; count: number }> {
    return apiFetch<{ success: boolean; count: number }>("/api/admin/bulk-import", {
      method: "POST",
      body: JSON.stringify({ transactions }),
    });
  },

  // Delete transactions
  async deleteDeposit(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(`/api/admin/transactions/deposit/${id}`, {
      method: "DELETE",
    });
  },

  async deleteWithdrawal(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(`/api/admin/transactions/withdrawal/${id}`, {
      method: "DELETE",
    });
  },

  // Database Backup and Maintenance
  async getDatabaseBackup(): Promise<any> {
    return apiFetch<any>("/api/admin/backup");
  },

  async restoreDatabaseBackup(backup: any): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>("/api/admin/restore", {
      method: "POST",
      body: JSON.stringify({ backup }),
    });
  },

  async cleanDatabase(actionType: "all_ledger" | "factory_reset" | "individual", userId?: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>("/api/admin/clean", {
      method: "POST",
      body: JSON.stringify({ actionType, userId }),
    });
  },

  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(`/api/users/${id}`, {
      method: "DELETE",
    });
  },
};
