import React from 'react';
import { UploadCloud, X } from 'lucide-react';
import { formatBytes } from '../utils/format';

export default function UploadProgress({ progress, onCancel }) {
  if (!progress || !progress.isUploading) return null;

  const { percent = 0, loaded = 0, total = 0, filename = 'Uploading files...' } = progress;

  return (
    <div className="fixed bottom-5 left-5 z-50 bg-surface border border-border shadow-2xl p-4 rounded-card w-80 animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-accent animate-pulse" />
          <span className="text-xs font-semibold text-textPrimary truncate max-w-[180px]">
            {filename}
          </span>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-textMuted hover:text-textPrimary transition-hover p-1 rounded hover:bg-surface-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden mb-2">
        <div
          className="bg-accent h-full transition-all duration-150 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex justify-between text-[11px] text-textMuted">
        <span>{percent}%</span>
        <span>
          {formatBytes(loaded)} / {formatBytes(total)}
        </span>
      </div>
    </div>
  );
}
