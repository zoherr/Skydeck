import React, { useEffect, useRef } from 'react';
import {
  Download,
  Edit3,
  Copy,
  Shield,
  Trash2,
  FileArchive,
  Archive,
  Bookmark,
  Files,
} from 'lucide-react';

export default function ContextMenu({
  x,
  y,
  file,
  onClose,
  onDownload,
  onRename,
  onCopyPath,
  onChmod,
  onDelete,
  onExtractArchive,
  onCompress,
  onBookmark,
  onDuplicate,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', onClose);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', onClose);
    };
  }, [onClose]);

  if (!file) return null;

  const isArchive =
    !file.is_dir &&
    /\.(zip|tar\.gz|tgz|tar\.bz2|tar)$/i.test(file.name);

  // Prevent context menu from going off-screen
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 340);

  return (
    <div
      ref={menuRef}
      style={{ top: adjustedY, left: adjustedX }}
      className="fixed z-50 w-56 bg-surface-2 border border-border shadow-2xl rounded-card py-1.5 animate-in fade-in duration-100 select-none text-xs text-textPrimary"
    >
      <div className="px-3 py-1 text-[11px] font-semibold text-textMuted truncate border-b border-border/40 mb-1">
        {file.name}
      </div>

      {!file.is_dir && (
        <button
          onClick={() => {
            onClose();
            onDownload(file);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface text-left transition-hover hover:text-white"
        >
          <Download className="w-3.5 h-3.5 text-accent" />
          <span>Download</span>
        </button>
      )}

      {/* Extract Archive if archive file */}
      {isArchive && onExtractArchive && (
        <button
          onClick={() => {
            onClose();
            onExtractArchive(file);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface text-left transition-hover hover:text-white text-amber-400 font-medium"
        >
          <FileArchive className="w-3.5 h-3.5" />
          <span>Extract Archive</span>
        </button>
      )}

      {/* Compress */}
      {onCompress && (
        <button
          onClick={() => {
            onClose();
            onCompress(file);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface text-left transition-hover hover:text-white"
        >
          <Archive className="w-3.5 h-3.5 text-purple-400" />
          <span>Compress (ZIP/TAR)</span>
        </button>
      )}

      {/* Duplicate */}
      {onDuplicate && (
        <button
          onClick={() => {
            onClose();
            onDuplicate(file);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface text-left transition-hover hover:text-white"
        >
          <Files className="w-3.5 h-3.5 text-sky-400" />
          <span>Duplicate</span>
        </button>
      )}

      {/* Bookmark if directory */}
      {file.is_dir && onBookmark && (
        <button
          onClick={() => {
            onClose();
            onBookmark(file.path);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface text-left transition-hover hover:text-white text-amber-300"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Bookmark Folder</span>
        </button>
      )}

      <button
        onClick={() => {
          onClose();
          onRename(file);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface text-left transition-hover hover:text-white"
      >
        <Edit3 className="w-3.5 h-3.5 text-textMuted" />
        <span>Rename</span>
      </button>

      <button
        onClick={() => {
          onClose();
          onCopyPath(file);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface text-left transition-hover hover:text-white"
      >
        <Copy className="w-3.5 h-3.5 text-textMuted" />
        <span>Copy Path</span>
      </button>

      <button
        onClick={() => {
          onClose();
          onChmod(file);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface text-left transition-hover hover:text-white"
      >
        <Shield className="w-3.5 h-3.5 text-warning" />
        <span>Change Permissions (chmod)</span>
      </button>

      <div className="my-1 border-t border-border/40" />

      <button
        onClick={() => {
          onClose();
          onDelete(file);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-error/10 text-error text-left transition-hover"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Delete</span>
      </button>
    </div>
  );
}

