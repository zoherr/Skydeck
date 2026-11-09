import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const { type = 'info', message, title } = toast;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-success shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-error shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning shrink-0" />,
    info: <Info className="w-5 h-5 text-accent shrink-0" />,
  };

  const borderColors = {
    success: 'border-success/30',
    error: 'border-error/30',
    warning: 'border-warning/30',
    info: 'border-accent/30',
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-start gap-3 bg-surface border shadow-2xl p-4 rounded-card max-w-md animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="pt-0.5">{icons[type] || icons.info}</div>
      <div className="flex-1 pr-2">
        {title && <div className="text-sm font-semibold text-textPrimary mb-0.5">{title}</div>}
        <div className="text-xs text-textPrimary/90 leading-relaxed break-words">{message}</div>
      </div>
      <button
        onClick={onClose}
        className="text-textMuted hover:text-textPrimary transition-hover p-1 -mr-1 -mt-1 rounded hover:bg-surface-2"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

