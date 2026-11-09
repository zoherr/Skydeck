import React, { useState, useEffect } from 'react';
import { Server, Lock, ArrowRight, AlertTriangle, RotateCcw } from 'lucide-react';
import { auth } from '../utils/auth';
import ConfirmDialog from '../components/ConfirmDialog';

export default function LockScreen({ onUnlocked, onResetApp }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [showResetDialog, setShowResetDialog] = useState(false);

  useEffect(() => {
    let interval = null;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setError('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (countdown > 0) return;
    if (!password) {
      setError('Please enter your master password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await auth.verify(password);
      if (res.success) {
        onUnlocked();
      } else {
        if (res.locked && res.remainingSeconds) {
          setCountdown(res.remainingSeconds);
          setError(`Too many attempts. Lockout in effect for ${res.remainingSeconds}s.`);
        } else {
          setAttempts(res.attempts || 0);
          setError(res.error || 'Incorrect master password');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background p-4 relative select-none">
      {/* Background subtle glow */}
      <div className="absolute w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm flex flex-col items-center z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Skydeck Logo */}
        <div className="w-14 h-14 rounded-card bg-surface border border-border shadow-2xl flex items-center justify-center mb-4 group transition-hover">
          <Server className="w-7 h-7 text-accent" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-textPrimary">Skydeck</h1>
        <p className="text-xs text-textMuted mt-1 mb-8">Enter master password to unlock your servers</p>

        {/* Lock form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="relative">
            <Lock className="w-4 h-4 text-textMuted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              autoFocus
              disabled={countdown > 0}
              placeholder={countdown > 0 ? `Locked (${countdown}s)` : 'Master password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-border pl-10 pr-4 py-2.5 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent disabled:opacity-50 shadow-inner"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-error/10 border border-error/30 rounded-input text-xs text-error">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {attempts >= 2 && countdown === 0 && (
            <div className="text-[11px] text-warning text-center">
              Failed attempts: {attempts} of 5. After 5 attempts, app locks for 30 seconds.
            </div>
          )}

          <button
            type="submit"
            disabled={loading || countdown > 0 || !password}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-btn transition-hover disabled:opacity-50 shadow-md shadow-accent/20"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : countdown > 0 ? (
              <span>Locked ({countdown}s)</span>
            ) : (
              <>
                <span>Unlock Skydeck</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Reset Option */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setShowResetDialog(true)}
            className="text-[11px] text-textMuted hover:text-error transition-hover flex items-center gap-1.5 mx-auto"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Forgot password? Reset app</span>
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showResetDialog}
        title="Reset Skydeck"
        message="Resetting the app will permanently erase all saved server profiles and allow you to set a new master password. Are you sure you want to proceed?"
        confirmText="Reset App"
        danger={true}
        onConfirm={async () => {
          setShowResetDialog(false);
          await auth.reset();
          onResetApp();
        }}
        onCancel={() => setShowResetDialog(false)}
      />
    </div>
  );
}

