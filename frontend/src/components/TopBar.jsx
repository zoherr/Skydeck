import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  RotateCw,
  FolderPlus,
  UploadCloud,
  Search,
  X,
  ChevronRight,
  HardDrive,
  Edit2,
  Check,
  Terminal,
  Columns2,
} from 'lucide-react';

export default function TopBar({
  currentPath,
  parentPath,
  onNavigate,
  onRefresh,
  onCreateFolder,
  onUploadClick,
  searchQuery,
  onSearchChange,
  loading,
  isTerminalOpen,
  onToggleTerminal,
  isDualPane,
  onToggleDualPane,
  onOpenSearchModal,
  onOpenDiskUsage,
}) {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [manualPath, setManualPath] = useState(currentPath || '/');
  const pathInputRef = useRef(null);

  useEffect(() => {
    setManualPath(currentPath || '/');
  }, [currentPath]);

  useEffect(() => {
    if (isEditingPath && pathInputRef.current) {
      pathInputRef.current.focus();
      pathInputRef.current.select();
    }
  }, [isEditingPath]);

  // Compute breadcrumb segments
  const segments = currentPath ? currentPath.split('/').filter(Boolean) : [];

  const handleBreadcrumbClick = (index) => {
    if (index === -1) {
      onNavigate('/');
      return;
    }
    const target = '/' + segments.slice(0, index + 1).join('/');
    onNavigate(target);
  };

  const handleManualPathSubmit = (e) => {
    e.preventDefault();
    let target = manualPath.trim();
    if (!target) target = '/';
    if (!target.startsWith('/')) target = '/' + target;
    setIsEditingPath(false);
    onNavigate(target);
  };

  const handleCreateFolderSubmit = (e) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border select-none shrink-0 gap-3">
      {/* Navigation & Breadcrumb / Address Bar */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          onClick={() => parentPath && onNavigate(parentPath)}
          disabled={!parentPath || currentPath === '/'}
          className="p-1.5 text-textMuted hover:text-textPrimary hover:bg-surface-2 rounded-btn transition-hover disabled:opacity-30 disabled:hover:bg-transparent shrink-0"
          title={`Back to ${parentPath || 'parent'}`}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {isEditingPath ? (
          <form onSubmit={handleManualPathSubmit} className="flex-1 flex items-center gap-1.5 max-w-xl">
            <input
              ref={pathInputRef}
              type="text"
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsEditingPath(false);
              }}
              placeholder="/var/www/html or /"
              className="w-full bg-surface-2 border border-accent px-3 py-1 text-xs text-textPrimary rounded-input focus:outline-none font-mono"
            />
            <button
              type="submit"
              className="p-1 bg-accent hover:bg-accent-hover text-white rounded transition-hover"
              title="Go"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditingPath(false)}
              className="p-1 text-textMuted hover:text-textPrimary rounded hover:bg-surface-2"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-1 group flex-1 min-w-0 overflow-hidden">
            {/* Clickable Breadcrumbs */}
            <div className="flex items-center gap-1 overflow-x-auto py-1 text-xs text-textMuted scrollbar-none min-w-0">
              {/* Root "/" button */}
              <button
                onClick={() => handleBreadcrumbClick(-1)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-hover hover:text-textPrimary hover:bg-surface-2 shrink-0 ${
                  segments.length === 0
                    ? 'text-accent font-semibold bg-surface-2 border border-accent/30'
                    : 'text-textMuted'
                }`}
                title="Go to Root Directory (/)"
              >
                <HardDrive className="w-3.5 h-3.5 text-accent" />
                <span className="font-mono font-bold">/</span>
              </button>

              {segments.map((seg, idx) => {
                const isLast = idx === segments.length - 1;
                return (
                  <React.Fragment key={idx}>
                    <ChevronRight className="w-3 h-3 text-border shrink-0" />
                    <button
                      onClick={() => handleBreadcrumbClick(idx)}
                      className={`px-2 py-0.5 rounded transition-hover truncate max-w-[140px] font-mono ${
                        isLast
                          ? 'text-textPrimary font-semibold bg-surface-2 border border-border/50'
                          : 'hover:text-textPrimary hover:bg-surface-2'
                      }`}
                      title={`Go to /${segments.slice(0, idx + 1).join('/')}`}
                    >
                      {seg}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Click to edit path shortcut */}
            <button
              onClick={() => setIsEditingPath(true)}
              className="p-1 text-textMuted hover:text-textPrimary hover:bg-surface-2 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
              title="Edit Path (Type / or any folder)"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Action buttons + Search */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Search */}
        <div className="relative w-40">
          <Search className="w-3.5 h-3.5 text-textMuted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-surface-2 border border-border text-xs text-textPrimary pl-8 pr-7 py-1 rounded-input focus:outline-none focus:border-accent"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-textMuted hover:text-textPrimary"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Advanced Remote Search Button */}
        <button
          onClick={onOpenSearchModal}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-textMuted hover:text-textPrimary bg-surface-2 hover:bg-border/60 border border-border rounded-btn transition-hover"
          title="Deep File & Content Search (Grep)"
        >
          <Search className="w-3.5 h-3.5 text-accent" />
          <span>Find</span>
        </button>

        {/* Dual Pane Toggle */}
        <button
          onClick={onToggleDualPane}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium border rounded-btn transition-all ${
            isDualPane
              ? 'bg-accent/20 border-accent text-accent'
              : 'bg-surface-2 border-border text-textMuted hover:text-textPrimary hover:bg-border/60'
          }`}
          title="Toggle Dual-Pane Explorer"
        >
          <Columns2 className="w-3.5 h-3.5" />
          <span>Dual Pane</span>
        </button>

        {/* Terminal Toggle */}
        <button
          onClick={onToggleTerminal}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium border rounded-btn transition-all ${
            isTerminalOpen
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
              : 'bg-surface-2 border-border text-textMuted hover:text-textPrimary hover:bg-border/60'
          }`}
          title="Toggle SSH Terminal (Ctrl+`)"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Terminal</span>
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 text-textMuted hover:text-textPrimary hover:bg-surface-2 rounded-btn transition-hover"
          title="Refresh directory"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-accent' : ''}`} />
        </button>

        {/* New Folder */}
        <button
          onClick={() => setIsCreatingFolder(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-textPrimary bg-surface-2 hover:bg-border/60 border border-border rounded-btn transition-hover"
          title="New Folder"
        >
          <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
          <span>Folder</span>
        </button>

        {/* Upload Button */}
        <button
          onClick={onUploadClick}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-btn transition-hover shadow-sm"
          title="Upload Files"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Upload</span>
        </button>
      </div>

      {/* Inline Create Folder Modal */}
      {isCreatingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateFolderSubmit}
            className="bg-surface border border-border rounded-card w-80 p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-textPrimary">Create Directory</h4>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="text-textMuted hover:text-textPrimary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              placeholder="folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full bg-surface-2 border border-border px-3 py-1.5 text-xs text-textPrimary rounded-input focus:outline-none focus:border-accent mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="px-3 py-1 text-xs text-textMuted hover:text-textPrimary bg-surface-2 rounded-btn transition-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                className="px-3 py-1 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-btn transition-hover disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
