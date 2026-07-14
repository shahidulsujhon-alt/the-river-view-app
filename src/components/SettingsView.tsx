/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { User, UserRole } from "../types.js";
import { api } from "../lib/api.js";
import {
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Database,
  ShieldAlert,
  AlertOctagon,
  FileJson,
  CheckCircle,
  Loader2,
  Users,
  Camera,
  Mail,
  Phone,
  User as UserIcon,
  ShieldCheck,
  Coins,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SettingsViewProps {
  user: User;
  shareholders: User[];
  onRefreshAllData: () => void;
  onUpdateCurrentUser: (updatedUser: User) => void;
}

export function SettingsView({ user, shareholders, onRefreshAllData, onUpdateCurrentUser }: SettingsViewProps) {
  const isAdmin = user.role === UserRole.ADMIN;

  // Profile Editor state
  const [profileName, setProfileName] = useState(user.name);
  const [profileEmail, setProfileEmail] = useState(user.email);
  const [profileMobile, setProfileMobile] = useState(user.mobile);
  const [profileShares, setProfileShares] = useState(user.shares || 0);
  const [photoUrl, setPhotoUrl] = useState(user.photo || "");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Backup & Restore state
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean data states
  const [cleaning, setCleaning] = useState(false);
  const [cleanSuccess, setCleanSuccess] = useState<string | null>(null);
  const [cleanError, setCleanError] = useState<string | null>(null);

  // Modal confirm state
  const [confirmAction, setConfirmAction] = useState<{
    type: "all_ledger" | "factory_reset" | "individual";
    title: string;
    description: string;
    userId?: string;
    userName?: string;
  } | null>(null);

  const [selectedIndividualId, setSelectedIndividualId] = useState("");

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-xs">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-display font-semibold text-slate-800">Access Denied</h3>
        <p className="text-xs text-slate-500 mt-1">
          Settings management is strictly restricted to designated Administrators.
        </p>
      </div>
    );
  }

  // Generate and download backup
  const handleBackupDownload = async () => {
    setDownloading(true);
    try {
      const dbData = await api.getDatabaseBackup();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(dbData, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `un_river_view_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert("Failed to download database backup: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  // Upload and restore backup
  const handleRestoreUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoring(true);
    setRestoreSuccess(null);
    setRestoreError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = await api.restoreDatabaseBackup(json);
        if (res.success) {
          setRestoreSuccess("Database backup restored successfully! All tables updated.");
          onRefreshAllData();
        } else {
          setRestoreError(res.message || "Invalid backup format.");
        }
      } catch (err: any) {
        setRestoreError("Error processing backup file: " + err.message);
      } finally {
        setRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Trigger modal confirm
  const triggerCleanConfirm = (type: "all_ledger" | "factory_reset" | "individual") => {
    setCleanSuccess(null);
    setCleanError(null);

    if (type === "all_ledger") {
      setConfirmAction({
        type,
        title: "Clear All Ledger Transactions?",
        description:
          "This will permanently erase all Deposits, Withdrawals, Expenses, and Notifications. Active Shareholders and Admin accounts will be preserved, but their financial balances will be reset to 0.",
      });
    } else if (type === "factory_reset") {
      setConfirmAction({
        type,
        title: "Reset Database to Factory Defaults?",
        description:
          "CRITICAL: This will destroy all current data, reset all transactions, and completely clear out all users. All current users and settings will be lost, and the first registered user will automatically receive system Administrator rights.",
      });
    } else if (type === "individual") {
      if (!selectedIndividualId) {
        setCleanError("Please select a shareholder from the list to clean.");
        return;
      }
      const shareholder = shareholders.find((s) => s.id === selectedIndividualId);
      if (!shareholder) return;

      setConfirmAction({
        type,
        title: `Clear Data for ${shareholder.name}?`,
        description: `This will permanently delete all deposits and withdrawals associated with ${shareholder.name}. Their paid deposit count will reset to BDT 0 and their due amount will be restored to their full share value.`,
        userId: selectedIndividualId,
        userName: shareholder.name,
      });
    }
  };

  // Perform clean operation
  const executeCleanAction = async () => {
    if (!confirmAction) return;

    setCleaning(true);
    setCleanError(null);
    setCleanSuccess(null);

    try {
      const res = await api.cleanDatabase(
        confirmAction.type,
        confirmAction.userId
      );
      if (res.success) {
        setCleanSuccess(res.message);
        onRefreshAllData();
        setSelectedIndividualId("");
        setConfirmAction(null);
      } else {
        setCleanError(res.message);
      }
    } catch (err: any) {
      setCleanError(err.message || "An error occurred during database cleanup.");
    } finally {
      setCleaning(false);
    }
  };

  // Profile photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileError("File size exceeds 5MB limit.");
      return;
    }

    setPhotoUploading(true);
    setProfileError(null);
    setProfileSuccess(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const fileData = event.target?.result as string;
        const res = await api.uploadFile(file.name, file.type, fileData);
        setPhotoUrl(res.url);
        setProfileSuccess("Profile photo uploaded successfully!");
      } catch (err: any) {
        setProfileError("Failed to upload profile photo: " + err.message);
      } finally {
        setPhotoUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      if (!profileName.trim() || !profileEmail.trim() || !profileMobile.trim()) {
        throw new Error("Name, email, and mobile number are required.");
      }

      const updatedUser = await api.editUser(user.id, {
        name: profileName,
        email: profileEmail,
        mobile: profileMobile,
        photo: photoUrl,
        shares: Number(profileShares) || 0,
      });

      setProfileSuccess("Admin profile updated successfully!");
      onUpdateCurrentUser(updatedUser);
      onRefreshAllData();
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile information.");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Page Title Header */}
      <div>
        <h2 className="text-xl font-display font-bold text-slate-800">Portal Systems & Maintenance</h2>
        <p className="text-xs text-slate-400">Manage database backups, ledger integrity, and reset options</p>
      </div>

      {/* Administrator Profile Settings Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-slate-50">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-display font-semibold text-slate-800">Administrator Profile Settings</h3>
            <p className="text-xs text-slate-400">Change your administrative contact details and profile photo</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {profileSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl flex items-center gap-2 border border-emerald-100 animate-fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl flex items-center gap-2 border border-rose-100 animate-fade-in">
              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar Photo Section */}
            <div className="flex flex-col items-center space-y-3 shrink-0">
              <div className="relative group">
                <img
                  src={photoUrl || "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&auto=format&fit=crop&q=80"}
                  alt="Admin Profile"
                  className="w-24 h-24 rounded-full object-cover border-2 border-slate-100 shadow-sm bg-slate-50"
                  referrerPolicy="no-referrer"
                />
                {photoUploading && (
                  <div className="absolute inset-0 bg-slate-900/60 rounded-full flex items-center justify-center text-white">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md transition-all border border-white cursor-pointer"
                  title="Upload profile photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="file"
                ref={avatarInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Photo Upload (JPG/PNG)
              </span>
            </div>

            {/* Input fields */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={profileMobile}
                    onChange={(e) => setProfileMobile(e.target.value)}
                    placeholder="Enter mobile number"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Committed Capital / Share Value (BDT)
                </label>
                <div className="relative">
                  <Coins className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="number"
                    value={profileShares}
                    onChange={(e) => setProfileShares(Number(e.target.value) || 0)}
                    placeholder="e.g. 500000"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              {/* Photo URL manual entry */}
              <div className="col-span-1 md:col-span-3 space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Profile Photo Image URL (Optional fallback)
                </label>
                <input
                  type="text"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="Or paste an image URL directly"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-50">
            <button
              type="submit"
              disabled={savingProfile || photoUploading}
              className="flex items-center gap-1.5 py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {savingProfile ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              Save Profile Changes
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backup & Restore Column */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-display font-semibold text-slate-800">Database Backup & Restore</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Export the current state of the ledger, users, and transactions into a single portable backup file. 
              You can restore the portal's data at any time by uploading a previously downloaded backup JSON file.
            </p>

            {restoreSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl flex items-center gap-2 border border-emerald-100 mb-4">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{restoreSuccess}</span>
              </div>
            )}

            {restoreError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl flex items-center gap-2 border border-rose-100 mb-4">
                <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{restoreError}</span>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-50">
            {/* Download Button */}
            <button
              onClick={handleBackupDownload}
              disabled={downloading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download JSON Database Backup
            </button>

            {/* Restore File Trigger */}
            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleRestoreUpload}
                accept=".json"
                className="hidden"
                disabled={restoring}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={restoring}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {restoring ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <Upload className="w-4 h-4 text-slate-500" />
                )}
                Upload & Restore from JSON
              </button>
            </div>
          </div>
        </div>

        {/* Clean Application Data Column */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <h3 className="text-base font-display font-semibold text-slate-800">Clear & Reset Ledger Data</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Perform administrative cleanup tasks. You can clear all financial ledger transaction history globally, 
              factory reset the whole portal back to original seeds, or selectively wipe history for an individual shareholder.
            </p>

            {cleanSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl flex items-center gap-2 border border-emerald-100 mb-4">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{cleanSuccess}</span>
              </div>
            )}

            {cleanError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl flex items-center gap-2 border border-rose-100 mb-4">
                <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{cleanError}</span>
              </div>
            )}

            {/* Individual shareholder drop selector */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 mb-6">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Select Individual Shareholder to Wipe
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedIndividualId}
                  onChange={(e) => {
                    setSelectedIndividualId(e.target.value);
                    setCleanError(null);
                    setCleanSuccess(null);
                  }}
                  className="flex-grow border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600"
                >
                  <option value="">-- Choose Shareholder --</option>
                  {shareholders
                    .filter((s) => s.role !== UserRole.ADMIN)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.shares} Shares)
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => triggerCleanConfirm("individual")}
                  className="py-2 px-4 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Wipe User Ledger
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50">
            {/* Clear All Ledger */}
            <button
              onClick={() => triggerCleanConfirm("all_ledger")}
              className="py-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Clear All Transactions
            </button>

            {/* Factory Reset */}
            <button
              onClick={() => triggerCleanConfirm("factory_reset")}
              className="py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <RefreshCw className="w-4 h-4" /> Factory System Reset
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal overlay */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setConfirmAction(null)}
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl border border-slate-150 shadow-2xl p-6 w-full max-w-md relative z-10"
            >
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <div className="p-2.5 bg-rose-50 rounded-xl">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <h4 className="text-base font-display font-semibold text-slate-800">
                  {confirmAction.title}
                </h4>
              </div>

              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                {confirmAction.description}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={executeCleanAction}
                  disabled={cleaning}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {cleaning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Execute Database Action
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  disabled={cleaning}
                  className="flex-1 py-2.5 bg-slate-55 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel Action
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
