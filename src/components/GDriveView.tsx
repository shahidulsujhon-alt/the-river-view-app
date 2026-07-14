/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Folder,
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  Trash2,
  ExternalLink,
  Copy,
  Plus,
  ArrowLeft,
  Upload,
  Search,
  Loader2,
  FolderPlus,
  Cloud,
  CheckCircle,
  AlertCircle,
  LogOut,
  Building2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  gdriveApi,
  googleSignIn,
  googleSignOut,
  getAccessToken,
  initGoogleAuth,
  GDriveFile,
} from "../lib/googleAuth.js";
import { User } from "../types.js";

interface GDriveViewProps {
  user: User;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function GDriveView({ user }: GDriveViewProps) {
  // Authentication states
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  // File explorer states
  const [currentFolderId, setCurrentFolderId] = useState<string>("root");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: "My Drive" },
  ]);
  const [files, setFiles] = useState<GDriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Actions states
  const [newFolderName, setNewFolderName] = useState("");
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [dragActive, setDragActive] = useState(false);

  // Status/Notifications
  const [notif, setNotif] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set timeout notification
  const showNotification = (type: "success" | "error", message: string) => {
    setNotif({ type, message });
    setTimeout(() => {
      setNotif(null);
    }, 4000);
  };

  // Initialize and check Google Auth status
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (gUser, token) => {
        setGoogleUser(gUser);
        setIsConnected(true);
        setAuthChecking(false);
      },
      () => {
        setGoogleUser(null);
        setIsConnected(false);
        setAuthChecking(false);
      }
    );

    // If there's already an active access token in memory, use it
    if (getAccessToken()) {
      setIsConnected(true);
      setAuthChecking(false);
    } else {
      // Just check short delay
      const t = setTimeout(() => {
        setAuthChecking(false);
      }, 800);
      return () => {
        clearTimeout(t);
        unsubscribe();
      };
    }

    return () => unsubscribe();
  }, []);

  // Fetch files when folderId or isConnected changes
  useEffect(() => {
    if (isConnected) {
      loadFiles(currentFolderId);
    }
  }, [isConnected, currentFolderId]);

  const loadFiles = async (folderId: string) => {
    setLoadingFiles(true);
    try {
      const gFiles = await gdriveApi.listFiles(folderId);
      setFiles(gFiles);
    } catch (err: any) {
      console.error(err);
      showNotification("error", err.message || "Failed to fetch files from Google Drive.");
    } finally {
      setLoadingFiles(false);
    }
  };

  // Google Login Trigger
  const handleConnect = async () => {
    setIsConnecting(true);
    setNotif(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setIsConnected(true);
        showNotification("success", "Connected to Google Drive successfully!");
      }
    } catch (err: any) {
      console.error(err);
      showNotification("error", err.message || "Connection to Google Drive failed.");
    } finally {
      setIsConnecting(false);
    }
  };

  // Google Sign Out
  const handleDisconnect = async () => {
    try {
      await googleSignOut();
      setIsConnected(false);
      setGoogleUser(null);
      setCurrentFolderId("root");
      setBreadcrumbs([{ id: "root", name: "My Drive" }]);
      setFiles([]);
      showNotification("success", "Disconnected Google Drive.");
    } catch (err: any) {
      console.error(err);
      showNotification("error", "Failed to sign out Google account.");
    }
  };

  // Navigate Into Folder
  const navigateIntoFolder = (folderId: string, folderName: string) => {
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
    setCurrentFolderId(folderId);
  };

  // Navigate via Breadcrumbs
  const navigateToBreadcrumb = (idx: number) => {
    const target = breadcrumbs[idx];
    setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
    setCurrentFolderId(target.id);
  };

  // Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    try {
      await gdriveApi.createFolder(newFolderName.trim(), currentFolderId);
      showNotification("success", `Folder "${newFolderName}" created successfully.`);
      setNewFolderName("");
      setShowFolderModal(false);
      // Reload current directory
      loadFiles(currentFolderId);
    } catch (err: any) {
      showNotification("error", err.message || "Failed to create folder.");
    } finally {
      setCreatingFolder(false);
    }
  };

  // File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    uploadMultipleFiles(Array.from(fileList));
  };

  const uploadMultipleFiles = async (fileList: File[]) => {
    for (const file of fileList) {
      setUploadingFiles((prev) => ({ ...prev, [file.name]: true }));
      try {
        await gdriveApi.uploadFile(file, currentFolderId);
        showNotification("success", `Uploaded "${file.name}" to Google Drive.`);
      } catch (err: any) {
        showNotification("error", `Failed to upload "${file.name}": ${err.message}`);
      } finally {
        setUploadingFiles((prev) => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
      }
    }
    loadFiles(currentFolderId);
  };

  // Delete File (MANDATORY User Confirmation Dialog)
  const handleDeleteFile = async (file: GDriveFile) => {
    const isFolder = file.mimeType === "application/vnd.google-apps.folder";
    const confirmMessage = `Are you sure you want to permanently delete the ${
      isFolder ? "folder" : "file"
    } "${file.name}" from your Google Drive? This action cannot be undone.`;

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    try {
      await gdriveApi.deleteFile(file.id);
      showNotification("success", `"${file.name}" deleted successfully.`);
      loadFiles(currentFolderId);
    } catch (err: any) {
      showNotification("error", err.message || "Failed to delete file.");
    }
  };

  // Copy Web Link to Clipboard
  const handleCopyLink = (link: string | undefined, name: string) => {
    if (!link) {
      showNotification("error", "Link is not available for this file.");
      return;
    }
    navigator.clipboard.writeText(link);
    showNotification("success", `Copied shareable link for "${name}"!`);
  };

  // Drag and Drop handlers
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
      uploadMultipleFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Helper formatting values
  const formatBytes = (bytesStr: string | undefined): string => {
    if (!bytesStr) return "-";
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return "-";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === "application/vnd.google-apps.folder") {
      return <Folder className="w-5 h-5 text-amber-500 fill-amber-100" />;
    } else if (mimeType.includes("pdf")) {
      return <FileText className="w-5 h-5 text-rose-500" />;
    } else if (mimeType.includes("image")) {
      return <FileImage className="w-5 h-5 text-blue-500" />;
    } else if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    }
    return <File className="w-5 h-5 text-slate-400" />;
  };

  // Filter files
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Cloud className="w-6 h-6 text-blue-600" />
            Project Cloud Storage
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Browse construction blueprints, purchase receipts, invoices, and share files using secure Google Drive.
          </p>
        </div>

        {/* Global Connection Header Action */}
        {isConnected && (
          <div className="flex items-center gap-3 bg-slate-100/60 border border-slate-200/80 px-4 py-2 rounded-2xl">
            {googleUser && (
              <>
                <img
                  src={googleUser.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80"}
                  alt={googleUser.displayName || "Google User"}
                  className="w-7 h-7 rounded-full border border-white shadow-xs"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 max-w-[120px] text-left">
                  <p className="text-[10px] font-bold text-slate-800 truncate leading-tight">
                    {googleUser.displayName || "Google Connected"}
                  </p>
                  <p className="text-[8px] font-medium text-slate-400 truncate">
                    {googleUser.email || ""}
                  </p>
                </div>
              </>
            )}
            <button
              onClick={handleDisconnect}
              className="flex items-center justify-center p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Disconnect Google Drive"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Global Notifications */}
      <AnimatePresence>
        {notif && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs font-medium max-w-xl shadow-xs ${
              notif.type === "success"
                ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                : "bg-rose-50 border-rose-100 text-rose-800"
            }`}
          >
            {notif.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            )}
            <span>{notif.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Screen (If not authenticated) */}
      {!isConnected ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 shadow-xl shadow-slate-100 text-center max-w-lg mx-auto my-6">
          {authChecking ? (
            <div className="space-y-4 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Locating secure cloud session...
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <Cloud className="w-9 h-9" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-display font-bold text-slate-900">
                  Connect Google Drive Ledger Storage
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                  Authorizing Google Drive lets you upload contract documents, construction receipts, and blueprints, making them easily retrievable by any project shareholder.
                </p>
              </div>

              {/* Secure authorization notice */}
              <div className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-left max-w-sm mx-auto">
                🔒 <strong>Zero Storage Risk:</strong> All files remain stored inside your secure, personal Google Drive accounts and are fetched securely in real-time.
              </div>

              {/* Custom Google Styled Authentication Button */}
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="gsi-material-button mx-auto flex items-center justify-center cursor-pointer transition-transform hover:scale-102"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    {isConnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                    ) : (
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    )}
                  </div>
                  <span className="gsi-material-button-contents font-sans font-semibold text-xs">
                    {isConnecting ? "Connecting Account..." : "Connect Google Drive"}
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Connected Google Drive Explorer Layout */
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px]">
          {/* File Browser Area */}
          <div className="flex-1 p-6 flex flex-col space-y-4">
            {/* Folder Actions and search toolbar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
              {/* Left back / breadcrumbs row */}
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    {idx > 0 && <span className="text-slate-300 font-bold mx-0.5">/</span>}
                    <button
                      onClick={() => navigateToBreadcrumb(idx)}
                      className={`font-semibold cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-200/50 transition-colors ${
                        idx === breadcrumbs.length - 1
                          ? "text-blue-600 bg-blue-50/50 border border-blue-100/50"
                          : "text-slate-500"
                      }`}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-2">
                {/* Search query input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search folder files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white w-44 focus:outline-hidden focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Create folder trigger */}
                <button
                  onClick={() => setShowFolderModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-semibold cursor-pointer shadow-xs hover:bg-slate-50 transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
                  New Folder
                </button>

                {/* Manual Upload trigger */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Drag & Drop Overlay Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative flex-grow flex flex-col min-h-[300px] border-2 border-dashed rounded-2xl transition-all duration-150 ${
                dragActive
                  ? "border-blue-500 bg-blue-50/20 scale-[0.99] shadow-inner"
                  : "border-slate-100 hover:border-slate-200 bg-white"
              }`}
            >
              {dragActive && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-50/70 backdrop-blur-xs rounded-2xl pointer-events-none">
                  <div className="text-center space-y-2">
                    <Upload className="w-8 h-8 text-blue-600 animate-bounce mx-auto" />
                    <p className="text-xs font-bold text-blue-600">Drop files to upload instantly</p>
                  </div>
                </div>
              )}

              {/* Active uploading overlay queue */}
              {Object.keys(uploadingFiles).length > 0 && (
                <div className="bg-slate-50 border-b border-slate-100 p-3 px-4 text-xs space-y-2">
                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Uploading Files...</p>
                  {Object.keys(uploadingFiles).map((name) => (
                    <div key={name} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span className="truncate">{name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Files Table Listing */}
              {loadingFiles ? (
                <div className="flex-grow flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2.5">Fetching Drive contents...</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center p-8 py-16 text-center">
                  <div className="h-12 w-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center mb-3">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700">No matching items found</h4>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    This directory is empty. Drag files here or click "Upload" above to store documents securely.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-50 bg-slate-50/40 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4 hidden sm:table-cell">Last Modified</th>
                        <th className="py-3 px-4 text-right">Size</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredFiles.map((file) => {
                        const isFolder = file.mimeType === "application/vnd.google-apps.folder";
                        return (
                          <tr
                            key={file.id}
                            className="text-xs hover:bg-slate-50/50 transition-colors group"
                          >
                            {/* File Icon & Name */}
                            <td className="py-3 px-4 font-medium text-slate-700">
                              <div className="flex items-center gap-2.5 max-w-[200px] sm:max-w-md">
                                <div className="shrink-0">{getFileIcon(file.mimeType)}</div>
                                <div className="min-w-0 flex-1">
                                  {isFolder ? (
                                    <button
                                      onClick={() => navigateIntoFolder(file.id, file.name)}
                                      className="font-bold text-slate-800 hover:text-blue-600 text-left hover:underline truncate cursor-pointer"
                                    >
                                      {file.name}
                                    </button>
                                  ) : (
                                    <span className="truncate text-slate-700">{file.name}</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Modified Time */}
                            <td className="py-3 px-4 text-slate-400 hidden sm:table-cell">
                              {file.modifiedTime
                                ? new Date(file.modifiedTime).toLocaleDateString()
                                : "-"}
                            </td>

                            {/* Size */}
                            <td className="py-3 px-4 text-right font-mono text-slate-500">
                              {isFolder ? "Folder" : formatBytes(file.size)}
                            </td>

                            {/* Row Actions */}
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                {file.webViewLink && (
                                  <a
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
                                    title="Open file in Google Drive"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {file.webViewLink && (
                                  <button
                                    onClick={() => handleCopyLink(file.webViewLink, file.name)}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Copy link"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteFile(file)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Folder Creation Dialog Popup */}
      <AnimatePresence>
        {showFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs"
              onClick={() => setShowFolderModal(false)}
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white border border-slate-100 rounded-2xl p-6 shadow-xl z-10"
            >
              <h3 className="font-display font-bold text-slate-900 text-sm mb-3">
                Create New Folder
              </h3>
              <form onSubmit={handleCreateFolder} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Folder Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Project Invoices Q2"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowFolderModal(false)}
                    className="px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingFolder}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {creatingFolder ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Create Folder"
                    )}
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
