import React from 'react';
import { AlertTriangle, Trash2, LogOut, X } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-card w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-textMuted hover:text-textPrimary transition-hover"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-2 rounded-card ${
              danger ? 'bg-error/10 text-error' : 'bg-accent/10 text-accent'
            }`}
          >
            {danger ? <AlertTriangle className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
          </div>
          <h3 className="text-base font-semibold text-textPrimary">{title}</h3>
        </div>

        <p className="text-sm text-textMuted mb-6 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-textMuted hover:text-textPrimary bg-surface-2 hover:bg-border/50 rounded-btn transition-hover"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-medium text-white rounded-btn transition-hover ${
              danger
                ? 'bg-error hover:bg-red-600'
                : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
