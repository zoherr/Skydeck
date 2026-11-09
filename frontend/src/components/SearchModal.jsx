import React, { useState } from 'react';
import {
  Search,
  FileText,
  Folder,
  X,
  FileCode,
  ArrowRight,
  ExternalLink,
  Loader2,
  Filter,
} from 'lucide-react';
import { api } from '../utils/api';
import { formatBytes } from '../utils/format';

export default function SearchModal({
  isOpen,
  onClose,
  session,
  currentPath,
  onNavigate,
  onOpenFile,
}) {
  const [activeTab, setActiveTab] = useState('filename'); // 'filename' or 'content'
  const [query, setQuery] = useState('');
  const [contentQuery, setContentQuery] = useState('');
  const [searchScope, setSearchScope] = useState(currentPath || '/');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!session?.session_id) return;

    const nameParam = activeTab === 'filename' ? query.trim() : '';
    const contentParam = activeTab === 'content' ? contentQuery.trim() : '';

    if (!nameParam && !contentParam) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await api.search(
        session.session_id,
        searchScope,
        nameParam,
        contentParam,
        150
      );
      setResults(res.data || []);
    } catch (err) {
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResult = (item) => {
    if (item.is_dir) {
      onNavigate(item.path);
      onClose();
    } else {
      onOpenFile(item);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-2 select-none">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-textPrimary">Search Remote Files</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-textMuted hover:text-textPrimary rounded hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab & Controls */}
        <div className="p-5 border-b border-border space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('filename')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'filename'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-surface-2 text-textMuted hover:text-textPrimary hover:bg-border/60'
              }`}
            >
              Search by Filename
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'content'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-surface-2 text-textMuted hover:text-textPrimary hover:bg-border/60'
              }`}
            >
              Grep Inside File Contents
            </button>
          </div>

          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={activeTab === 'filename' ? query : contentQuery}
                  onChange={(e) =>
                    activeTab === 'filename'
                      ? setQuery(e.target.value)
                      : setContentQuery(e.target.value)
                  }
                  placeholder={
                    activeTab === 'filename'
                      ? 'e.g. nginx.conf, *.js, error.log, docker-compose*'
                      : 'e.g. DB_PASSWORD, ServerName, TODO, function start'
                  }
                  className="w-full bg-surface-2 border border-border text-xs text-textPrimary pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-accent"
                />
              </div>

              <button
                type="submit"
                disabled={loading || (activeTab === 'filename' ? !query.trim() : !contentQuery.trim())}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 shrink-0 shadow-sm"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Search</span>
              </button>
            </div>

            {/* Scope Bar */}
            <div className="flex items-center gap-2 text-xs text-textMuted">
              <Filter className="w-3.5 h-3.5 text-textMuted shrink-0" />
              <span>Search in:</span>
              <input
                type="text"
                value={searchScope}
                onChange={(e) => setSearchScope(e.target.value)}
                className="bg-surface-2 border border-border px-2 py-0.5 rounded text-xs font-mono text-textPrimary flex-1 max-w-sm focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setSearchScope('/')}
                className="text-xs text-accent hover:underline"
              >
                Entire Server (/)
              </button>
            </div>
          </form>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 min-h-[240px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-textMuted gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span className="text-xs">Searching remote server with Go regex engine...</span>
            </div>
          )}

          {!loading && error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs">
              {error}
            </div>
          )}

          {!loading && searched && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-textMuted">
              <p className="text-sm font-medium">No matches found</p>
              <p className="text-xs mt-1">Try broadening your search term or checking a parent folder.</p>
            </div>
          )}

          {!loading &&
            results.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectResult(item)}
                className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2/60 hover:bg-surface-2 border border-border/50 hover:border-accent/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                  {item.is_dir ? (
                    <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-textPrimary truncate group-hover:text-accent transition-colors">
                        {item.name}
                      </span>
                      {item.is_dir && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                          directory
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-textMuted font-mono truncate">{item.path}</p>
                    {item.match_line && (
                      <p className="text-[11px] text-emerald-400 font-mono bg-black/40 px-2 py-0.5 rounded mt-1 truncate border border-emerald-500/20">
                        {item.match_line}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-right">
                  {!item.is_dir && (
                    <span className="text-[11px] text-textMuted font-mono">
                      {formatBytes(item.size)}
                    </span>
                  )}
                  <span className="text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-5 py-2.5 border-t border-border bg-surface-2 text-xs text-textMuted flex items-center justify-between">
            <span>Found {results.length} result(s)</span>
            <span className="text-[11px]">Click result to open file or navigate to folder</span>
          </div>
        )}
      </div>
    </div>
  );
}

