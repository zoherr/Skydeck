import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, AlertCircle, ShieldAlert } from 'lucide-react';
import { auth } from '../utils/auth';

export default function SetPasswordScreen({ onPasswordSet }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Password strength calculation
  const getStrength = (p) => {
    if (!p) return { level: 0, label: 'None', color: 'bg-border' };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-error' };
    if (score === 2) return { level: 2, label: 'Fair', color: 'bg-warning' };
    if (score >= 3) return { level: 3, label: 'Strong', color: 'bg-success' };
    return { level: 1, label: 'Weak', color: 'bg-error' };
  };

  const strength = getStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await auth.setup(password);
      if (res.success) {
        onPasswordSet();
      } else {
        setError(res.error || 'Failed to configure master password');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background p-4 relative select-none">
      <div className="absolute w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm flex flex-col items-center z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-card bg-surface border border-border shadow-2xl flex items-center justify-center mb-4">
          <ShieldCheck className="w-7 h-7 text-accent" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-textPrimary">Welcome to Skydeck</h1>
        <p className="text-xs text-textMuted mt-1 mb-6 text-center">
          Set a master password to protect your VPS connections and credentials
        </p>

        {/* Warning banner */}
        <div className="w-full flex items-start gap-2.5 p-3 bg-surface-2 border border-border/80 rounded-card mb-5 text-[11px] text-textMuted leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <span>
            This password encrypts your server profiles with <strong className="text-textPrimary">AES-256-GCM</strong>. Passwords are never saved to disk in plaintext.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1">
              Create Master Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-textMuted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                autoFocus
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface border border-border pl-10 pr-4 py-2 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent"
              />
            </div>

            {/* Strength meter */}
            {password && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-textMuted mb-1">
                  <span>Strength: {strength.label}</span>
                </div>
                <div className="w-full bg-surface-2 h-1 rounded-full overflow-hidden flex gap-0.5">
                  <div className={`h-full flex-1 ${strength.level >= 1 ? strength.color : 'bg-border'}`} />
                  <div className={`h-full flex-1 ${strength.level >= 2 ? strength.color : 'bg-border'}`} />
                  <div className={`h-full flex-1 ${strength.level >= 3 ? strength.color : 'bg-border'}`} />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-textMuted mb-1">
              Confirm Master Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-textMuted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-surface border border-border pl-10 pr-4 py-2 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-error/10 border border-error/30 rounded-input text-xs text-error">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-btn transition-hover disabled:opacity-50 shadow-md shadow-accent/20"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Save Password & Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
