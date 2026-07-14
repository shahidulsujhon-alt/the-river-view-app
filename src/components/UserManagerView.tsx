/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { User, UserRole, UserStatus } from "../types.js";
import { api } from "../lib/api.js";
import {
  UserPlus,
  Key,
  ShieldAlert,
  Search,
  UserCheck,
  UserX,
  Plus,
  Lock,
  Mail,
  Phone,
  Hash,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Upload,
  RotateCw,
  FlipHorizontal,
  Check,
  Image as ImageIcon,
} from "lucide-react";

interface UserManagerViewProps {
  shareholders: User[];
  onRefreshData: () => void;
}

export function UserManagerView({ shareholders, onRefreshData }: UserManagerViewProps) {
  // Add User Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [shares, setShares] = useState("");
  const [photo, setPhoto] = useState("");
  const [password, setPassword] = useState("");

  // Photo Editor states
  const [photoSource, setPhotoSource] = useState<"url" | "file">("file");
  const [editorZoom, setEditorZoom] = useState(1);
  const [editorRotation, setEditorRotation] = useState(0);
  const [editorFlip, setEditorFlip] = useState(false);
  const [editorFilter, setEditorFilter] = useState("none");
  const [originalBase64, setOriginalBase64] = useState<string>("");
  const [photoFinalized, setPhotoFinalized] = useState(false);
  const [finalizingPhoto, setFinalizingPhoto] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setOriginalBase64(result);
        setPhoto(result);
        setPhotoFinalized(false);
        // reset edit attributes
        setEditorZoom(1);
        setEditorRotation(0);
        setEditorFlip(false);
        setEditorFilter("none");
      };
      reader.readAsDataURL(file);
    }
  };

  const applyImageEdits = (
    src: string,
    zoom: number,
    rotation: number,
    flip: boolean,
    filter: string
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }

        canvas.width = 150;
        canvas.height = 150;

        if (filter === "grayscale") {
          ctx.filter = "grayscale(100%)";
        } else if (filter === "contrast") {
          ctx.filter = "contrast(130%) brightness(110%)";
        } else if (filter === "warmth") {
          ctx.filter = "sepia(30%) saturate(140%) hue-rotate(-10deg)";
        } else if (filter === "cool") {
          ctx.filter = "saturate(120%) hue-rotate(10deg)";
        } else {
          ctx.filter = "none";
        }

        ctx.translate(75, 75);
        ctx.rotate((rotation * Math.PI) / 180);
        if (flip) {
          ctx.scale(-1, 1);
        }
        ctx.scale(zoom, zoom);

        const size = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - size) / 2,
          (img.height - size) / 2,
          size,
          size,
          -75,
          -75,
          150,
          150
        );

        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => {
        resolve(src);
      };
      img.src = src;
    });
  };

  const handleFinalizePhoto = async () => {
    if (!photo) return;
    setFinalizingPhoto(true);
    try {
      const cooked = await applyImageEdits(photo, editorZoom, editorRotation, editorFlip, editorFilter);
      setPhoto(cooked);
      setOriginalBase64(cooked); // update original to be the newly cropped/cooked one
      setPhotoFinalized(true);
      // Reset controls to baseline of cooked image
      setEditorZoom(1);
      setEditorRotation(0);
      setEditorFlip(false);
      setEditorFilter("none");
    } catch (e) {
      console.error("Failed to finalize photo", e);
    } finally {
      setFinalizingPhoto(false);
    }
  };

  const getPreviewStyle = () => {
    let transform = `scale(${editorZoom}) rotate(${editorRotation}deg)`;
    if (editorFlip) {
      transform += " scaleX(-1)";
    }
    
    let filterStyle = "";
    if (editorFilter === "grayscale") {
      filterStyle = "grayscale(100%)";
    } else if (editorFilter === "contrast") {
      filterStyle = "contrast(130%) brightness(110%)";
    } else if (editorFilter === "warmth") {
      filterStyle = "sepia(30%) saturate(140%) hue-rotate(-10deg)";
    } else if (editorFilter === "cool") {
      filterStyle = "saturate(120%) hue-rotate(10deg)";
    }
    
    return {
      transform,
      filter: filterStyle,
      transition: "transform 0.15s ease, filter 0.15s ease",
    };
  };

  // Reset Password Fields
  const [resetUserId, setResetUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Loading / Status
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !mobile || !shares) {
      alert("Please fill in Name, Email, Mobile, and Share Quantity.");
      return;
    }

    setCreating(true);
    try {
      await api.addUser({
        name,
        email,
        mobile,
        shares: Number(shares),
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        photo: photo || undefined,
        password: password || "password", // default password
      });

      // Reset
      setName("");
      setEmail("");
      setMobile("");
      setShares("");
      setPhoto("");
      setPassword("");
      setOriginalBase64("");
      setPhotoFinalized(false);
      setEditorZoom(1);
      setEditorRotation(0);
      setEditorFlip(false);
      setEditorFilter("none");

      onRefreshData();
      alert("Shareholder registered successfully. Default password is set to 'password' unless configured.");
    } catch (e: any) {
      alert(e.message || "Failed to create shareholder.");
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId) {
      alert("Please select a shareholder to reset password.");
      return;
    }
    if (!newPassword || newPassword.trim() === "") {
      alert("Please enter a valid new password.");
      return;
    }

    setResetting(true);
    try {
      await api.resetPassword(resetUserId, newPassword);
      setNewPassword("");
      setResetUserId("");
      alert("Password reset completed successfully.");
    } catch (e: any) {
      alert(e.message || "Failed to reset password.");
    } finally {
      setResetting(false);
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await api.toggleUserStatus(id);
      onRefreshData();
    } catch (e: any) {
      alert(e.message || "Failed to toggle user status.");
    }
  };

  // Filtered users for reset password dropdown & search status lists
  const filteredShareholders = shareholders.filter((sh) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      sh.role === UserRole.USER &&
      (sh.name.toLowerCase().includes(q) ||
        sh.email.toLowerCase().includes(q) ||
        sh.mobile.toLowerCase().includes(q))
    );
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
      {/* Add Shareholder (Span 7) */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
          <UserPlus className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-display font-semibold text-slate-800">
            Register New Shareholder Account
          </h3>
        </div>

        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahim Rahman"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="rahim@unriverview.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mobile / Phone
              </label>
              <input
                type="text"
                required
                placeholder="+880 1700-000000"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Committed Capital / Share Value (BDT)
              </label>
              <input
                type="number"
                required
                placeholder="e.g. 500000"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                Enter the exact share investment commitment in BDT (৳)
              </p>
            </div>
          </div>

          {/* Default Portal Password Block */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Default Portal Password (Optional)
              </label>
              <input
                type="password"
                placeholder="Defaults to 'password' if empty"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Premium Profile Photo Block with Live Editing */}
          <div className="border border-slate-100 rounded-2xl p-4 bg-slate-5/50 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-blue-600" /> Shareholder Profile Photo
              </span>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setPhotoSource("file");
                    setPhoto("");
                    setOriginalBase64("");
                    setPhotoFinalized(false);
                  }}
                  className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                    photoSource === "file" ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Local Upload
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhotoSource("url");
                    setPhoto("");
                    setOriginalBase64("");
                    setPhotoFinalized(false);
                  }}
                  className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                    photoSource === "url" ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Web URL
                </button>
              </div>
            </div>

            {photoSource === "file" ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center bg-white hover:bg-slate-50/50 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-[10px] font-bold text-slate-600">Choose Profile Image</span>
                <span className="text-[9px] text-slate-400 mt-0.5">JPG, PNG up to 5MB</span>
              </div>
            ) : (
              <input
                type="text"
                placeholder="e.g. https://images.unsplash.com/photo-..."
                value={photo && !photo.startsWith("data:") ? photo : ""}
                onChange={(e) => {
                  setPhoto(e.target.value);
                  setOriginalBase64(e.target.value);
                  setPhotoFinalized(false);
                }}
                className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
              />
            )}

            {/* Live Photo Editor Section */}
            {photo && (
              <div className="p-3 bg-white border border-slate-150 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-4 items-center animate-fade-in">
                {/* Preview Frame */}
                <div className="sm:col-span-4 flex flex-col items-center justify-center border-r border-slate-100 sm:pr-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-100 bg-slate-50 flex items-center justify-center shadow-xs">
                    <img
                      src={photo}
                      alt="Preview"
                      style={getPreviewStyle()}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-wider">
                    {photoFinalized ? "Finalized Preview" : "Live Tweak Preview"}
                  </span>
                </div>

                {/* Editor Sliders & Actions */}
                <div className="sm:col-span-8 space-y-3">
                  {/* Zoom Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Scale Zoom ({editorZoom.toFixed(1)}x)</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.1"
                      value={editorZoom}
                      onChange={(e) => {
                        setEditorZoom(parseFloat(e.target.value));
                        setPhotoFinalized(false);
                      }}
                      className="w-full accent-blue-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Rotate, Flip, Filter Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditorRotation((r) => (r + 90) % 360);
                        setPhotoFinalized(false);
                      }}
                      className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Rotate 90° Clockwise"
                    >
                      <RotateCw className="w-3 h-3" /> Rotate
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditorFlip((f) => !f);
                        setPhotoFinalized(false);
                      }}
                      className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Flip Horizontal"
                    >
                      <FlipHorizontal className="w-3 h-3" /> Mirror
                    </button>

                    {/* Filter Selector */}
                    <select
                      value={editorFilter}
                      onChange={(e) => {
                        setEditorFilter(e.target.value);
                        setPhotoFinalized(false);
                      }}
                      className="py-1 px-2 border border-slate-200 bg-white rounded-lg text-[10px] font-bold text-slate-700 focus:outline-hidden"
                    >
                      <option value="none">Normal Filter</option>
                      <option value="grayscale">Noir (Mono)</option>
                      <option value="contrast">High Contrast</option>
                      <option value="warmth">Warm (Amber)</option>
                      <option value="cool">Cool (Ocean)</option>
                    </select>
                  </div>

                  {/* Apply / Bake Action */}
                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleFinalizePhoto}
                      disabled={finalizingPhoto}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        photoFinalized
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-blue-600 text-white hover:bg-blue-700 shadow-xs"
                      }`}
                    >
                      {finalizingPhoto ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : photoFinalized ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : null}
                      {photoFinalized ? "Image Saved & Baked" : "Apply & Save Edits"}
                    </button>

                    {photoFinalized && (
                      <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Baked Successfully
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Register Shareholder
          </button>
        </form>
      </div>

      {/* Reset Password & Disable Utilities (Span 5) */}
      <div className="lg:col-span-5 space-y-6">
        {/* Reset Password Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
            <Key className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-display font-semibold text-slate-800">
              Reset Portal Password
            </h3>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Select Shareholder
              </label>
              <select
                required
                value={resetUserId}
                onChange={(e) => setResetUserId(e.target.value)}
                className="block w-full py-2 px-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
              >
                <option value="">-- Choose Account --</option>
                {shareholders
                  .filter((s) => s.role === UserRole.USER)
                  .map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name} ({sh.email})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                New Secured Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={resetting}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Reset Account Password
            </button>
          </form>
        </div>

        {/* Status manager shortcuts */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <h3 className="text-base font-display font-semibold text-slate-800">
              Account Status Shortcuts
            </h3>
          </div>

          {/* Quick Search */}
          <div className="relative mb-3">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              placeholder="Search user account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-150 rounded-lg text-[11px] placeholder-slate-400 focus:outline-hidden"
            />
          </div>

          <div className="max-h-[140px] overflow-y-auto divide-y divide-slate-50 space-y-2">
            {filteredShareholders.map((sh) => (
              <div key={sh.id} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <p className="font-semibold text-slate-800">{sh.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium font-mono">{sh.email}</p>
                </div>
                <button
                  onClick={() => handleToggleStatus(sh.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    sh.status === UserStatus.ACTIVE
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-100"
                      : "bg-rose-50 text-rose-700 border-rose-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-100"
                  }`}
                  title={sh.status === UserStatus.ACTIVE ? "Click to Disable Account" : "Click to Enable Account"}
                >
                  {sh.status === UserStatus.ACTIVE ? (
                    <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> Active</span>
                  ) : (
                    <span className="flex items-center gap-1"><UserX className="w-3.5 h-3.5" /> Disabled</span>
                  )}
                </button>
              </div>
            ))}
            {filteredShareholders.length === 0 && (
              <p className="text-center text-[11px] text-slate-400 py-4 font-medium">No accounts found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
