import React, { useState, useEffect } from 'react';
import { HardDrive, X, RotateCw, Folder, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../utils/api';

export default function DiskUsageModal({ isOpen, onClose, session, currentPath, onNavigate }) {
  const [data, setData] = useState({ mounts: [], folder_sizes: [] });
  const [loading, setLoading] = useState(false);
  const [checkPath, setCheckPath] = useState(currentPath || '/');
  const [error, setError] = useState(null);

  const fetchDiskUsage = async (pathTarget) => {
    if (!session?.session_id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDiskUsage(session.session_id, pathTarget);
      setData({
        mounts: res.mounts || [],
        folder_sizes: res.folder_sizes || [],
      });
    } catch (err) {
      setError(err.message || 'Failed to retrieve disk usage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCheckPath(currentPath || '/');
      fetchDiskUsage(currentPath || '/');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getProgressColor = (percent) => {
    if (percent >= 85) return 'bg-rose-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-2 select-none">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-textPrimary">Disk Usage Analyzer</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-textMuted hover:text-textPrimary rounded hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Path Bar + Refresh */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-2 bg-surface">
          <span className="text-xs text-textMuted shrink-0">Analyze Folder:</span>
          <input
            type="text"
            value={checkPath}
            onChange={(e) => setCheckPath(e.target.value)}
            className="bg-surface-2 border border-border px-3 py-1 text-xs font-mono text-textPrimary rounded-lg flex-1 focus:outline-none focus:border-accent"
          />
          <button
            onClick={() => fetchDiskUsage(checkPath)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Analyze</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-textMuted gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span className="text-xs">Calculating remote storage consumption...</span>
            </div>
          )}

          {!loading && error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Filesystem Mounts */}
              <div>
                <h4 className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-2.5">
                  Mounted Filesystems
                </h4>
                <div className="space-y-2">
                  {data.mounts.map((mount, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-surface-2 rounded-lg border border-border/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-medium text-textPrimary">
                          {mount.mounted_on} ({mount.filesystem})
                        </span>
                        <span className="text-textMuted font-mono">
                          <strong className="text-textPrimary">{mount.used}</strong> / {mount.total} ({mount.percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-surface h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${getProgressColor(
                            mount.percent
                          )}`}
                          style={{ width: `${Math.min(mount.percent, 100)}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-textMuted flex justify-between">
                        <span>Available: {mount.available}</span>
                        <span>Usage: {mount.percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Largest Folders */}
              {data.folder_sizes.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-2.5">
                    Largest Items in {checkPath}
                  </h4>
                  <div className="space-y-1">
                    {data.folder_sizes.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          onNavigate(item.path);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 bg-surface-2/60 hover:bg-surface-2 rounded-lg border border-border/40 hover:border-accent/40 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2 min-w-0 mr-2">
                          <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="text-xs font-mono text-textPrimary truncate group-hover:text-accent transition-colors">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-mono font-semibold text-textPrimary px-2 py-0.5 bg-surface rounded border border-border/50">
                            {item.size}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-surface-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-surface hover:bg-border text-xs text-textPrimary font-medium rounded-lg border border-border transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

