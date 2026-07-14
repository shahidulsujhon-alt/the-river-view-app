/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google OAuth Provider
export const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive");
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/drive.readonly");

// Internal memory-cached access token
let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Load cached token from memory
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Set token
export const setAccessToken = (token: string | null): void => {
  cachedAccessToken = token;
};

// Initialize auth state listener
export const initGoogleAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Open Sign-In Popup and authenticate with Google
export const googleSignIn = async (): Promise<{
  user: FirebaseUser;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve Google Access Token.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    console.error("Google login failed:", err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

// Sign-out from Google
export const googleSignOut = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Interface for Google Drive file
export interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  iconLink?: string;
}

// Check if access token exists and is valid (simple check)
const getValidToken = (): string => {
  if (!cachedAccessToken) {
    throw new Error("Please connect your Google Drive first.");
  }
  return cachedAccessToken;
};

// API calls to Google Drive v3
export const gdriveApi = {
  /**
   * List files in a folder, sorted by type (folders first) then name
   */
  async listFiles(folderId: string = "root"): Promise<GDriveFile[]> {
    const token = getValidToken();
    const query = `'${folderId}' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id,name,mimeType,webViewLink,size,modifiedTime,thumbnailLink,iconLink)&orderBy=folder,name&pageSize=100`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "Failed to list Google Drive files.");
    }

    const data = await res.json();
    return data.files || [];
  },

  /**
   * Create a new folder
   */
  async createFolder(name: string, parentId: string = "root"): Promise<GDriveFile> {
    const token = getValidToken();
    const url = "https://www.googleapis.com/drive/v3/files";
    const body = {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "Failed to create folder.");
    }

    return res.json();
  },

  /**
   * Upload file to folder (using Multipart Upload Type)
   */
  async uploadFile(file: File, parentId: string = "root"): Promise<GDriveFile> {
    const token = getValidToken();
    const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

    const metadata = {
      name: file.name,
      parents: [parentId],
    };

    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    formData.append("file", file);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "Failed to upload file to Google Drive.");
    }

    return res.json();
  },

  /**
   * Delete file/folder
   */
  async deleteFile(fileId: string): Promise<void> {
    const token = getValidToken();
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "Failed to delete file from Google Drive.");
    }
  },
};
