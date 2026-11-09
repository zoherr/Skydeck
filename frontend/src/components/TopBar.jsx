import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  RotateCw,
  FolderPlus,
  UploadCloud,
  Search,
  X,
  ChevronRight,
  HardDrive,
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
}) {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef(null);

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
      {/* Navigation & Breadcrumb */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          onClick={() => parentPath && onNavigate(parentPath)}
          disabled={!parentPath || currentPath === '/'}
          className="p-1.5 text-textMuted hover:text-textPrimary hover:bg-surface-2 rounded-btn transition-hover disabled:opacity-30 disabled:hover:bg-transparent"
          title="Back to parent folder"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Clickable Breadcrumbs */}
        <div className="flex items-center gap-1 overflow-x-auto py-1 text-xs text-textMuted scrollbar-none">
          <button
            onClick={() => handleBreadcrumbClick(-1)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-hover hover:text-textPrimary hover:bg-surface-2 ${
              segments.length === 0 ? 'text-accent font-semibold' : ''
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>root</span>
          </button>

          {segments.map((seg, idx) => {
            const isLast = idx === segments.length - 1;
            return (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3 h-3 text-border shrink-0" />
                <button
                  onClick={() => handleBreadcrumbClick(idx)}
                  className={`px-1.5 py-0.5 rounded transition-hover truncate max-w-[120px] ${
                    isLast
                      ? 'text-textPrimary font-semibold bg-surface-2'
                      : 'hover:text-textPrimary hover:bg-surface-2'
                  }`}
                  title={seg}
                >
                  {seg}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Action buttons + Search */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative w-48">
          <Search className="w-3.5 h-3.5 text-textMuted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search current folder..."
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
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-textPrimary bg-surface-2 hover:bg-border/60 border border-border rounded-btn transition-hover"
          title="New Folder"
        >
          <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
          <span>New Folder</span>
        </button>

        {/* Upload Button */}
        <button
          onClick={onUploadClick}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-btn transition-hover shadow-sm"
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

