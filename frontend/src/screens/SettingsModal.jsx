import React, { useState, useEffect } from 'react';
import {
  Settings,
  KeyRound,
  Trash2,
  FolderOpen,
  Info,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { auth } from '../utils/auth';
import { profiles } from '../utils/profiles';
import ConfirmDialog from '../components/ConfirmDialog';

export default function SettingsModal({ isOpen, onClose, onResetApp, onToast }) {
  const [activeTab, setActiveTab] = useState('security'); // 'security' | 'storage' | 'about'
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [appInfo, setAppInfo] = useState({
    name: 'Skydeck',
    version: '2.0.0',
    platform: 'win32',
    userData: 'Loading...',
    logsDir: 'Loading...',
  });

  const [confirmClearProfiles, setConfirmClearProfiles] = useState(false);
  const [confirmResetApp, setConfirmResetApp] = useState(false);

  useEffect(() => {
    if (isOpen && window.skydeck && window.skydeck.app) {
      window.skydeck.app.getInfo().then((info) => {
        setAppInfo(info);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await auth.changePassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordSuccess('Master password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onToast({
          type: 'success',
          title: 'Security',
          message: 'Master password updated successfully.',
        });
      } else {
        setPasswordError(res.error || 'Failed to update password');
      }
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleClearProfiles = async () => {
    try {
      await profiles.save([]);
      setConfirmClearProfiles(false);
      onToast({
        type: 'info',
        title: 'Profiles Cleared',
        message: 'All saved VPS server profiles have been removed.',
      });
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to clear profiles: ' + err.message,
      });
    }
  };

  const handleOpenLogs = async () => {
    if (window.skydeck && window.skydeck.shell) {
      await window.skydeck.shell.openLogs();
    } else {
      onToast({
        type: 'info',
        title: 'Logs Directory',
        message: appInfo.logsDir,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 p-4">
      <div className="bg-surface border border-border rounded-card w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2/60">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-accent" />
            <h3 className="text-base font-semibold text-textPrimary">Preferences & Security</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-textMuted hover:text-textPrimary hover:bg-surface rounded-btn transition-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-surface px-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 px-3 border-b-2 transition-hover ${
              activeTab === 'security'
                ? 'border-accent text-accent font-semibold'
                : 'border-transparent text-textMuted hover:text-textPrimary'
            }`}
          >
            Master Password
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`py-3 px-3 border-b-2 transition-hover ${
              activeTab === 'storage'
                ? 'border-accent text-accent font-semibold'
                : 'border-transparent text-textMuted hover:text-textPrimary'
            }`}
          >
            Data & Profiles
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`py-3 px-3 border-b-2 transition-hover ${
              activeTab === 'about'
                ? 'border-accent text-accent font-semibold'
                : 'border-transparent text-textMuted hover:text-textPrimary'
            }`}
          >
            About & Logs
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'security' && (
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div>
                <h4 className="text-sm font-semibold text-textPrimary mb-1">
                  Change Master Password
                </h4>
                <p className="text-xs text-textMuted mb-4">
                  Your master password encrypts all stored server profiles using AES-256-GCM.
                </p>
              </div>

              {passwordError && (
                <div className="flex items-center gap-2 p-2.5 bg-error/10 border border-error/30 rounded-input text-xs text-error">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="flex items-center gap-2 p-2.5 bg-success/10 border border-success/30 rounded-input text-xs text-success">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-textMuted mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-surface-2 border border-border px-3 py-1.5 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-textMuted mb-1">
                  New Master Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-surface-2 border border-border px-3 py-1.5 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-textMuted mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-surface-2 border border-border px-3 py-1.5 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent"
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-btn transition-hover disabled:opacity-50"
              >
                {passwordLoading ? 'Updating Password...' : 'Update Master Password'}
              </button>
            </form>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-textPrimary mb-1">Profile Storage</h4>
                <p className="text-xs text-textMuted">
                  Encrypted at rest: <code className="text-textPrimary bg-surface-2 px-1 rounded">profiles.enc</code>
                </p>
              </div>

              <div className="p-4 bg-surface-2 border border-border/50 rounded-card flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-textPrimary">Clear All Saved Profiles</div>
                  <div className="text-[11px] text-textMuted mt-0.5">
                    Deletes all stored VPS server connections from encrypted disk storage.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmClearProfiles(true)}
                  className="px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10 border border-error/30 rounded-btn transition-hover shrink-0"
                >
                  Clear Profiles
                </button>
              </div>

              <div className="p-4 bg-error/5 border border-error/20 rounded-card flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-error">Factory Reset Skydeck</div>
                  <div className="text-[11px] text-textMuted mt-0.5">
                    Erase master password, all saved profiles, and lock credentials completely.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmResetApp(true)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-error hover:bg-red-600 rounded-btn transition-hover shrink-0"
                >
                  Reset Everything
                </button>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="text-sm font-semibold text-textPrimary mb-1">About Skydeck</h4>
                <p className="text-textMuted leading-relaxed">
                  Skydeck is an ultra-fast, secure VPS file manager combining an embedded Go SSH/SFTP backend with Electron.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="p-3 bg-surface-2 rounded-card border border-border/50">
                  <span className="text-textMuted block text-[11px]">Version</span>
                  <span className="font-semibold text-textPrimary">2.0.0 Production</span>
                </div>
                <div className="p-3 bg-surface-2 rounded-card border border-border/50">
                  <span className="text-textMuted block text-[11px]">Backend Port</span>
                  <span className="font-semibold text-textPrimary font-mono">127.0.0.1:48921</span>
                </div>
                <div className="p-3 bg-surface-2 rounded-card border border-border/50">
                  <span className="text-textMuted block text-[11px]">Encryption</span>
                  <span className="font-semibold text-textPrimary">AES-256-GCM + PBKDF2</span>
                </div>
                <div className="p-3 bg-surface-2 rounded-card border border-border/50">
                  <span className="text-textMuted block text-[11px]">Platform</span>
                  <span className="font-semibold text-textPrimary">{appInfo.platform}</span>
                </div>
              </div>

              <div className="p-4 bg-surface-2 border border-border/50 rounded-card flex items-center justify-between">
                <div className="min-w-0 pr-4">
                  <div className="font-semibold text-textPrimary">Application & Backend Logs</div>
                  <div className="text-[11px] text-textMuted truncate mt-0.5 font-mono">
                    {appInfo.logsDir}
                  </div>
                </div>
                <button
                  onClick={handleOpenLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-textPrimary bg-surface hover:bg-border/60 border border-border rounded-btn transition-hover shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-accent" />
                  <span>Open Folder</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmClearProfiles}
        title="Clear Saved Profiles"
        message="Are you sure you want to delete all saved VPS server profiles? This action cannot be undone."
        confirmText="Clear All"
        danger={true}
        onConfirm={handleClearProfiles}
        onCancel={() => setConfirmClearProfiles(false)}
      />

      <ConfirmDialog
        isOpen={confirmResetApp}
        title="Factory Reset Skydeck"
        message="This will immediately wipe your master password, all server profiles, and all cached settings. Skydeck will return to first-time setup."
        confirmText="Erase All Data"
        danger={true}
        onConfirm={async () => {
          setConfirmResetApp(false);
          await auth.reset();
          onResetApp();
        }}
        onCancel={() => setConfirmResetApp(false)}
      />
    </div>
  );
}

