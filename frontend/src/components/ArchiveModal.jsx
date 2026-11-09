import React, { useState } from 'react';
import { Archive, X, FileArchive, Folder, Loader2 } from 'lucide-react';
import { api } from '../utils/api';

export default function ArchiveModal({
  isOpen,
  mode, // 'extract' or 'compress'
  targetItem, // single file for extract, or array of files for compress
  currentPath,
  session,
  onClose,
  onSuccess,
}) {
  const [destDir, setDestDir] = useState(currentPath || '/');
  const [archiveName, setArchiveName] = useState(
    mode === 'compress' ? 'archive.zip' : ''
  );
  const [format, setFormat] = useState('zip'); // 'zip' or 'tar.gz'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleAction = async (e) => {
    e.preventDefault();
    if (!session?.session_id) return;
    setLoading(true);
    setError(null);

    try {
      if (mode === 'extract') {
        await api.extractArchive(session.session_id, targetItem.path, destDir);
      } else {
        const fullArchivePath = destDir.endsWith('/')
          ? `${destDir}${archiveName}`
          : `${destDir}/${archiveName}`;
        const items = Array.isArray(targetItem)
          ? targetItem.map((i) => i.path)
          : [targetItem.path];
        await api.createArchive(session.session_id, items, fullArchivePath, format);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-2 select-none">
          <div className="flex items-center gap-2">
            <FileArchive className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-textPrimary">
              {mode === 'extract' ? 'Extract Archive' : 'Compress Items'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-textMuted hover:text-textPrimary rounded hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleAction} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
              {error}
            </div>
          )}

          {mode === 'extract' ? (
            <div>
              <label className="block text-textMuted mb-1 font-medium">Archive File</label>
              <div className="flex items-center gap-2 p-2 bg-surface-2 rounded-lg border border-border font-mono text-textPrimary">
                <FileArchive className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">{targetItem?.name}</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-textMuted mb-1 font-medium">Items to Compress</label>
              <div className="p-2 bg-surface-2 rounded-lg border border-border font-mono text-textPrimary max-h-24 overflow-y-auto space-y-1">
                {(Array.isArray(targetItem) ? targetItem : [targetItem]).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 truncate">
                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{item?.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'compress' && (
            <>
              <div>
                <label className="block text-textMuted mb-1 font-medium">Archive Name</label>
                <input
                  type="text"
                  required
                  value={archiveName}
                  onChange={(e) => setArchiveName(e.target.value)}
                  placeholder="backup.zip"
                  className="w-full bg-surface-2 border border-border px-3 py-1.5 rounded-lg text-textPrimary font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-textMuted mb-1 font-medium">Format</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-textPrimary">
                    <input
                      type="radio"
                      name="archive-format"
                      checked={format === 'zip'}
                      onChange={() => {
                        setFormat('zip');
                        if (archiveName.endsWith('.tar.gz')) {
                          setArchiveName(archiveName.replace(/\.tar\.gz$/, '.zip'));
                        }
                      }}
                      className="text-accent"
                    />
                    <span>ZIP (.zip)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-textPrimary ml-4">
                    <input
                      type="radio"
                      name="archive-format"
                      checked={format === 'tar.gz'}
                      onChange={() => {
                        setFormat('tar.gz');
                        if (archiveName.endsWith('.zip')) {
                          setArchiveName(archiveName.replace(/\.zip$/, '.tar.gz'));
                        }
                      }}
                      className="text-accent"
                    />
                    <span>Tar Gzip (.tar.gz)</span>
                  </label>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-textMuted mb-1 font-medium">
              {mode === 'extract' ? 'Destination Directory' : 'Output Directory'}
            </label>
            <input
              type="text"
              required
              value={destDir}
              onChange={(e) => setDestDir(e.target.value)}
              className="w-full bg-surface-2 border border-border px-3 py-1.5 rounded-lg text-textPrimary font-mono focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-surface-2 hover:bg-border text-textMuted hover:text-textPrimary rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{mode === 'extract' ? 'Extract' : 'Compress'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

