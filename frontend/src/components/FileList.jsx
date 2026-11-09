import React, { useState } from 'react';
import {
  Folder,
  FileText,
  FileCode,
  FileArchive,
  FileImage,
  File as FileGeneric,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Upload,
} from 'lucide-react';
import { formatBytes, formatDate, getFileExtension } from '../utils/format';

export default function FileList({
  entries,
  loading,
  selectedFile,
  onSelectFile,
  onOpenFolder,
  onOpenFile,
  onContextMenu,
  onRenameSubmit,
  renamingFile,
  setRenamingFile,
  onDropFiles,
}) {
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [newName, setNewName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getFileIcon = (file) => {
    if (file.is_dir) {
      return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />;
    }

    const ext = getFileExtension(file.name);
    const codeExts = ['js', 'jsx', 'ts', 'tsx', 'go', 'py', 'sh', 'bash', 'html', 'css', 'sql', 'rs', 'c', 'cpp'];
    const archiveExts = ['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'tgz'];
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'];
    const configExts = ['json', 'yaml', 'yml', 'env', 'conf', 'ini', 'md', 'txt', 'log'];

    if (codeExts.includes(ext)) {
      return <FileCode className="w-4 h-4 text-accent shrink-0" />;
    }
    if (archiveExts.includes(ext)) {
      return <FileArchive className="w-4 h-4 text-warning shrink-0" />;
    }
    if (imageExts.includes(ext)) {
      return <FileImage className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (configExts.includes(ext)) {
      return <FileText className="w-4 h-4 text-sky-400 shrink-0" />;
    }
    return <FileGeneric className="w-4 h-4 text-textMuted shrink-0" />;
  };

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.is_dir !== b.is_dir) {
      return a.is_dir ? -1 : 1;
    }

    let comparison = 0;
    if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortField === 'size') {
      comparison = a.size - b.size;
    } else if (sortField === 'mod_time') {
      comparison = new Date(a.mod_time).getTime() - new Date(b.mod_time).getTime();
    } else if (sortField === 'mode') {
      comparison = (a.mode || '').localeCompare(b.mode || '');
    }

    return sortAsc ? comparison : -comparison;
  });

  const handleRowDoubleClick = (file) => {
    if (file.is_dir) {
      onOpenFolder(file.path);
    } else {
      onOpenFile(file);
    }
  };

  const startRename = (file) => {
    setRenamingFile(file);
    setNewName(file.name);
  };

  const handleRenameKeyDown = (e, file) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (newName.trim() && newName !== file.name) {
        onRenameSubmit(file, newName.trim());
      }
      setRenamingFile(null);
    } else if (e.key === 'Escape') {
      setRenamingFile(null);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files);
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-textMuted/40 group-hover:text-textMuted" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-accent" />
    ) : (
      <ArrowDown className="w-3 h-3 text-accent" />
    );
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 flex flex-col h-full overflow-hidden bg-background relative ${
        isDragOver ? 'ring-2 ring-accent ring-inset bg-accent/5' : ''
      }`}
    >
      {/* Drop zone overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none border-2 border-dashed border-accent m-3 rounded-card">
          <Upload className="w-12 h-12 text-accent animate-bounce mb-3" />
          <h3 className="text-base font-semibold text-textPrimary">Drop files to upload</h3>
          <p className="text-xs text-textMuted mt-1">Upload directly to current VPS directory</p>
        </div>
      )}

      {/* Table Header */}
      <div className="flex items-center px-4 py-2.5 bg-surface border-b border-border text-xs font-semibold text-textMuted select-none shrink-0">
        <div
          onClick={() => handleSort('name')}
          className="flex-1 flex items-center gap-1.5 cursor-pointer hover:text-textPrimary group transition-hover"
        >
          <span>Name</span>
          {renderSortIcon('name')}
        </div>
        <div
          onClick={() => handleSort('size')}
          className="w-28 flex items-center justify-end gap-1.5 cursor-pointer hover:text-textPrimary group transition-hover"
        >
          <span>Size</span>
          {renderSortIcon('size')}
        </div>
        <div
          onClick={() => handleSort('mod_time')}
          className="w-48 flex items-center justify-end gap-1.5 cursor-pointer hover:text-textPrimary group transition-hover"
        >
          <span>Modified</span>
          {renderSortIcon('mod_time')}
        </div>
        <div
          onClick={() => handleSort('mode')}
          className="w-28 flex items-center justify-end gap-1.5 cursor-pointer hover:text-textPrimary group transition-hover"
        >
          <span>Permissions</span>
          {renderSortIcon('mode')}
        </div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-textMuted">
            <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs font-medium">Fetching remote directory...</span>
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-textMuted p-8">
            <Folder className="w-12 h-12 text-border/60 mb-3" />
            <p className="text-sm font-medium text-textPrimary">This folder is empty</p>
            <p className="text-xs text-textMuted mt-1">Drag files here or click "Upload" above.</p>
          </div>
        ) : (
          <div>
            {sortedEntries.map((file) => {
              const isSelected = selectedFile && selectedFile.path === file.path;
              const isRenaming = renamingFile && renamingFile.path === file.path;

              return (
                <div
                  key={file.path}
                  onClick={() => onSelectFile(file)}
                  onDoubleClick={() => handleRowDoubleClick(file)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onSelectFile(file);
                    onContextMenu(e, file);
                  }}
                  className={`flex items-center px-4 py-2 text-xs border-b border-border/30 cursor-pointer select-none transition-hover group ${
                    isSelected
                      ? 'bg-surface-2 text-textPrimary font-medium border-accent/40'
                      : 'hover:bg-surface/60 text-textPrimary/90'
                  }`}
                >
                  {/* File icon + Name */}
                  <div className="flex-1 flex items-center gap-2.5 min-w-0 pr-4">
                    {getFileIcon(file)}

                    {isRenaming ? (
                      <input
                        type="text"
                        value={newName}
                        autoFocus
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => handleRenameKeyDown(e, file)}
                        onBlur={() => {
                          if (newName.trim() && newName !== file.name) {
                            onRenameSubmit(file, newName.trim());
                          }
                          setRenamingFile(null);
                        }}
                        className="bg-surface border border-accent rounded-input px-1.5 py-0.5 text-xs text-textPrimary focus:outline-none w-full max-w-sm"
                      />
                    ) : (
                      <span className="truncate group-hover:text-white">{file.name}</span>
                    )}
                  </div>

                  {/* Size */}
                  <div className="w-28 text-right font-mono text-textMuted truncate">
                    {file.is_dir ? '—' : formatBytes(file.size)}
                  </div>

                  {/* Modified */}
                  <div className="w-48 text-right text-textMuted truncate">
                    {formatDate(file.mod_time)}
                  </div>

                  {/* Permissions */}
                  <div className="w-28 text-right font-mono text-textMuted/80 text-[11px] truncate">
                    {file.octal_mode ? `${file.octal_mode} ` : ''}
                    <span className="text-[10px] text-textMuted">{file.mode}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

