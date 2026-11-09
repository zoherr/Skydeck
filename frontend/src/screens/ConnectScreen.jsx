import React, { useState, useEffect } from 'react';
import {
  Server,
  KeyRound,
  FileKey,
  FolderOpen,
  ArrowRight,
  AlertTriangle,
  BookmarkCheck,
  ShieldAlert,
} from 'lucide-react';
import { profiles } from '../utils/profiles';

export default function ConnectScreen({
  initialProfile,
  onConnect,
  loading,
  error,
  savedProfiles,
}) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState('password'); // 'password' | 'key'
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [trustHost, setTrustHost] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [saveProfile, setSaveProfile] = useState(true);

  useEffect(() => {
    if (initialProfile) {
      setHost(initialProfile.host || '');
      setPort(initialProfile.port || 22);
      setUsername(initialProfile.username || 'root');
      setAuthType(initialProfile.auth_type || 'password');
      setKeyPath(initialProfile.key_path || '');
      setProfileName(initialProfile.name || initialProfile.host || '');
      // Passwords are never saved in profiles
      setPassword('');
      setPassphrase('');
    }
  }, [initialProfile]);

  const handleSelectKeyFile = async () => {
    try {
      const res = await profiles.selectKeyFile();
      if (!res.canceled && res.filePath) {
        setKeyPath(res.filePath);
      }
    } catch (e) {
      console.error('Failed to open key dialog:', e);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!host || !username) return;

    const payload = {
      host: host.trim(),
      port: Number(port) || 22,
      username: username.trim(),
      auth_type: authType,
      password: authType === 'password' ? password : '',
      key_path: authType === 'key' ? keyPath : '',
      passphrase: authType === 'key' ? passphrase : '',
      trust_host: trustHost,
      save_profile: saveProfile,
      profile_name: profileName.trim() || host.trim(),
    };

    onConnect(payload);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background flex flex-col items-center justify-center p-6 select-none relative">
      <div className="w-full max-w-xl bg-surface border border-border rounded-card p-6 shadow-2xl animate-in fade-in duration-150">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-card bg-accent/10 text-accent">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-textPrimary">Connect to Remote Server</h2>
            <p className="text-xs text-textMuted">Establish a secure SSH/SFTP session</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 bg-error/10 border border-error/30 rounded-input text-xs text-error mb-5 leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words flex-1">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Host & Port */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="block text-xs font-medium text-textMuted mb-1">
                Hostname or IP Address
              </label>
              <input
                type="text"
                required
                placeholder="192.168.1.100 or vps.domain.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full bg-surface-2 border border-border px-3 py-2 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-textMuted mb-1">Port</label>
              <input
                type="number"
                min="1"
                max="65535"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full bg-surface-2 border border-border px-3 py-2 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent text-center font-mono"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1">Username</label>
            <input
              type="text"
              required
              placeholder="root, ubuntu, debian..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface-2 border border-border px-3 py-2 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent font-mono"
            />
          </div>

          {/* Auth Method Toggle */}
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1.5">
              Authentication Method
            </label>
            <div className="grid grid-cols-2 gap-2 bg-surface-2 p-1 rounded-card border border-border/60">
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-input transition-hover ${
                  authType === 'password'
                    ? 'bg-surface text-accent font-semibold shadow-sm'
                    : 'text-textMuted hover:text-textPrimary'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Password</span>
              </button>
              <button
                type="button"
                onClick={() => setAuthType('key')}
                className={`flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-input transition-hover ${
                  authType === 'key'
                    ? 'bg-surface text-accent font-semibold shadow-sm'
                    : 'text-textMuted hover:text-textPrimary'
                }`}
              >
                <FileKey className="w-3.5 h-3.5" />
                <span>SSH Private Key</span>
              </button>
            </div>
          </div>

          {/* Password field */}
          {authType === 'password' && (
            <div>
              <label className="block text-xs font-medium text-textMuted mb-1">
                Password <span className="text-[10px] text-textMuted/70">(session only, never saved)</span>
              </label>
              <input
                type="password"
                required
                placeholder="Enter SSH password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-2 border border-border px-3 py-2 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent"
              />
            </div>
          )}

          {/* SSH Key field */}
          {authType === 'key' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-textMuted mb-1">
                  Private Key File (.pem, .key, id_rsa, id_ed25519)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    readOnly
                    placeholder="Click browse to select key..."
                    value={keyPath}
                    className="flex-1 bg-surface-2 border border-border px-3 py-2 text-xs text-textPrimary rounded-input focus:outline-none font-mono truncate"
                  />
                  <button
                    type="button"
                    onClick={handleSelectKeyFile}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-textPrimary bg-surface-2 hover:bg-border/60 border border-border rounded-btn transition-hover shrink-0"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-accent" />
                    <span>Browse</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-textMuted mb-1">
                  Key Passphrase <span className="text-[10px] text-textMuted/70">(leave blank if unencrypted)</span>
                </label>
                <input
                  type="password"
                  placeholder="Optional passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full bg-surface-2 border border-border px-3 py-2 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          )}

          {/* Profile Name & Save Checkbox */}
          <div className="pt-2 border-t border-border/40 space-y-3">
            <div>
              <label className="block text-xs font-medium text-textMuted mb-1">
                Profile Name <span className="text-[10px] text-textMuted/70">(optional label)</span>
              </label>
              <input
                type="text"
                placeholder={host || 'e.g. Production Webserver'}
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full bg-surface-2 border border-border px-3 py-2 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-textMuted hover:text-textPrimary">
                <input
                  type="checkbox"
                  checked={saveProfile}
                  onChange={(e) => setSaveProfile(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
                <span>Save profile for quick reconnect</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-textMuted hover:text-textPrimary">
                <input
                  type="checkbox"
                  checked={trustHost}
                  onChange={(e) => setTrustHost(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
                <span>Accept host key</span>
              </label>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !host || !username}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-btn transition-hover disabled:opacity-50 shadow-md shadow-accent/20"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Connect via SFTP</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
