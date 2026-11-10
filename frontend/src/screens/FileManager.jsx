import React, { useState, useEffect, useRef } from 'react';
import TopBar from '../components/TopBar';
import FileList from '../components/FileList';
import ContextMenu from '../components/ContextMenu';
import EditorModal from '../components/EditorModal';
import ImagePreviewModal from '../components/ImagePreviewModal';
import PermissionsModal from '../components/PermissionsModal';
import UploadProgress from '../components/UploadProgress';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchModal from '../components/SearchModal';
import DiskUsageModal from '../components/DiskUsageModal';
import ArchiveModal from '../components/ArchiveModal';
import { api } from '../utils/api';
import { getFileExtension } from '../utils/format';
import { ArrowLeft, HardDrive, RefreshCw } from 'lucide-react';

export default function FileManager({
  activeSession,
  navTarget,
  onToast,
  bookmarks = [],
  onBookmark,
  isDiskUsageOpen,
  setIsDiskUsageOpen,
  isTerminalOpen,
  onToggleTerminal,
}) {
  // Primary Pane State
  const [currentPath, setCurrentPath] = useState(activeSession?.initial_path || '/');
  const [parentPath, setParentPath] = useState('/');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Secondary Pane State (for Dual-Pane mode)
  const [isDualPane, setIsDualPane] = useState(false);
  const [secondaryPath, setSecondaryPath] = useState('/');
  const [secondaryParentPath, setSecondaryParentPath] = useState('/');
  const [secondaryEntries, setSecondaryEntries] = useState([]);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [secondarySelectedFile, setSecondarySelectedFile] = useState(null);
  const [activePane, setActivePane] = useState('primary'); // 'primary' | 'secondary'

  // Search Modal State
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Archive Modal State
  const [archiveModal, setArchiveModal] = useState({
    isOpen: false,
    mode: 'extract', // 'extract' | 'compress'
    targetItem: null,
  });

  // Context Menu state
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, file: null, pane: 'primary' });

  // Inline Rename
  const [renamingFile, setRenamingFile] = useState(null);

  // Editor Modal
  const [editorFile, setEditorFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Image Preview Modal
  const [imageFile, setImageFile] = useState(null);
  const [isImageOpen, setIsImageOpen] = useState(false);

  // Permissions Modal
  const [chmodFile, setChmodFile] = useState(null);
  const [isChmodOpen, setIsChmodOpen] = useState(false);

  // Upload progress
  const [uploadProgress, setUploadProgress] = useState({ isUploading: false, percent: 0, loaded: 0, total: 0 });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const uploadInputRef = useRef(null);

  // Fetch Primary Directory Listing
  const fetchDirectory = async (targetPath) => {
    if (!activeSession) return;
    setLoading(true);
    try {
      const data = await api.listFiles(activeSession.session_id, targetPath);
      setCurrentPath(data.path);
      setParentPath(data.parent_path);
      setEntries(data.entries || []);
      setSelectedFile(null);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Error reading directory',
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Secondary Directory Listing (Dual Pane)
  const fetchSecondaryDirectory = async (targetPath) => {
    if (!activeSession) return;
    setSecondaryLoading(true);
    try {
      const data = await api.listFiles(activeSession.session_id, targetPath);
      setSecondaryPath(data.path);
      setSecondaryParentPath(data.parent_path);
      setSecondaryEntries(data.entries || []);
      setSecondarySelectedFile(null);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Secondary pane error',
        message: err.message,
      });
    } finally {
      setSecondaryLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory(currentPath);
  }, [activeSession]);

  useEffect(() => {
    if (isDualPane && secondaryEntries.length === 0) {
      fetchSecondaryDirectory(secondaryPath);
    }
  }, [isDualPane]);

  // Handle external navigation target from Sidebar Quick Locations or Bookmarks
  useEffect(() => {
    if (navTarget) {
      if (activePane === 'secondary') {
        fetchSecondaryDirectory(navTarget);
      } else {
        fetchDirectory(navTarget);
      }
    }
  }, [navTarget]);

  // Keyboard shortcut listener: F5 copies to other pane, F6 moves
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F5 in dual pane copies selected item to other pane
      if (e.key === 'F5' && isDualPane) {
        e.preventDefault();
        handleCrossPaneTransfer(false);
      }
      // F6 moves selected item to other pane
      if (e.key === 'F6' && isDualPane) {
        e.preventDefault();
        handleCrossPaneTransfer(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDualPane, selectedFile, secondarySelectedFile, activePane, currentPath, secondaryPath]);

  // Cross pane copy or move
  const handleCrossPaneTransfer = async (isMove) => {
    const srcFile = activePane === 'primary' ? selectedFile : secondarySelectedFile;
    const destDir = activePane === 'primary' ? secondaryPath : currentPath;

    if (!srcFile) {
      onToast({
        type: 'info',
        title: 'No item selected',
        message: 'Select a file to transfer to the opposite pane.',
      });
      return;
    }

    const targetDestPath = destDir.endsWith('/')
      ? `${destDir}${srcFile.name}`
      : `${destDir}/${srcFile.name}`;

    try {
      await api.copyItem(activeSession.session_id, srcFile.path, targetDestPath, isMove);
      onToast({
        type: 'success',
        title: isMove ? 'Item Moved' : 'Item Copied',
        message: `${srcFile.name} transferred to ${destDir}`,
      });
      fetchDirectory(currentPath);
      fetchSecondaryDirectory(secondaryPath);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Transfer failed',
        message: err.message,
      });
    }
  };

  // Open file in Editor or Image Preview
  const handleOpenFile = async (file) => {
    const ext = getFileExtension(file.name);
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'];

    if (imageExts.includes(ext)) {
      setImageFile(file);
      setIsImageOpen(true);
      return;
    }

    try {
      const res = await api.readFile(activeSession.session_id, file.path);
      setEditorFile(file);
      setEditorContent(res.content);
      setIsEditorOpen(true);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Unable to open file',
        message: err.message,
      });
    }
  };

  // Save updated file
  const handleSaveEditor = async (path, content) => {
    try {
      await api.writeFile(activeSession.session_id, path, content);
      onToast({
        type: 'success',
        title: 'File saved',
        message: `${path} saved to server.`,
      });
      fetchDirectory(currentPath);
      if (isDualPane) fetchSecondaryDirectory(secondaryPath);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Save failed',
        message: err.message,
      });
      throw err;
    }
  };

  // Download
  const handleDownload = async (file) => {
    try {
      const res = await api.downloadFile(activeSession.session_id, file.path, file.name);
      if (!res.canceled) {
        onToast({
          type: 'success',
          title: 'Download complete',
          message: `${file.name} downloaded successfully.`,
        });
      }
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Download failed',
        message: err.message,
      });
    }
  };

  // Delete
  const handleDelete = (file) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${file.is_dir ? 'Directory' : 'File'}`,
      message: `Are you sure you want to permanently delete "${file.name}"? This action cannot be undone on the server.`,
      onConfirm: async () => {
        try {
          await api.deleteItem(activeSession.session_id, file.path, file.is_dir);
          onToast({
            type: 'success',
            title: 'Deleted',
            message: `${file.name} removed from server.`,
          });
          fetchDirectory(currentPath);
          if (isDualPane) fetchSecondaryDirectory(secondaryPath);
        } catch (err) {
          onToast({
            type: 'error',
            title: 'Delete failed',
            message: err.message,
          });
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Duplicate
  const handleDuplicate = async (file) => {
    const parentDir = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
    const copyPath = `${parentDir}${file.name}.copy`;
    try {
      await api.copyItem(activeSession.session_id, file.path, copyPath, false);
      onToast({
        type: 'success',
        title: 'Duplicated',
        message: `Created copy: ${file.name}.copy`,
      });
      fetchDirectory(currentPath);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Duplicate failed',
        message: err.message,
      });
    }
  };

  // Rename
  const handleRenameSubmit = async (file, newName) => {
    if (!newName || newName === file.name) {
      setRenamingFile(null);
      return;
    }
    const parent = file.path.substring(0, file.path.lastIndexOf('/'));
    const newPath = parent ? `${parent}/${newName}` : `/${newName}`;

    try {
      await api.renameItem(activeSession.session_id, file.path, newPath);
      onToast({
        type: 'success',
        title: 'Renamed',
        message: `Renamed to ${newName}`,
      });
      setRenamingFile(null);
      fetchDirectory(currentPath);
      if (isDualPane) fetchSecondaryDirectory(secondaryPath);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Rename failed',
        message: err.message,
      });
    }
  };

  // Create folder
  const handleCreateFolder = async (folderName) => {
    const target = currentPath.endsWith('/')
      ? `${currentPath}${folderName}`
      : `${currentPath}/${folderName}`;
    try {
      await api.createFolder(activeSession.session_id, target);
      onToast({
        type: 'success',
        title: 'Directory created',
        message: `Created ${folderName}`,
      });
      fetchDirectory(currentPath);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Failed to create directory',
        message: err.message,
      });
    }
  };

  // Upload files
  const handleUploadFiles = async (files) => {
    if (!files || files.length === 0) return;

    setUploadProgress({
      isUploading: true,
      percent: 0,
      loaded: 0,
      total: Array.from(files).reduce((acc, f) => acc + f.size, 0),
    });

    try {
      await api.uploadFiles(activeSession.session_id, currentPath, files, (prog) => {
        setUploadProgress({
          isUploading: true,
          ...prog,
        });
      });

      onToast({
        type: 'success',
        title: 'Upload complete',
        message: `Uploaded ${files.length} file(s) to ${currentPath}`,
      });
      fetchDirectory(currentPath);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Upload failed',
        message: err.message,
      });
    } finally {
      setTimeout(() => {
        setUploadProgress({ isUploading: false, percent: 0, loaded: 0, total: 0 });
      }, 600);
    }
  };

  // Apply Permissions
  const handleApplyChmod = async (mode) => {
    if (!chmodFile) return;
    try {
      await api.chmod(activeSession.session_id, chmodFile.path, mode);
      onToast({
        type: 'success',
        title: 'Permissions updated',
        message: `${chmodFile.name} set to ${mode}`,
      });
      setIsChmodOpen(false);
      fetchDirectory(currentPath);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Chmod failed',
        message: err.message,
      });
    }
  };

  // Copy Path
  const handleCopyPath = async (file) => {
    try {
      if (window.skydeck && window.skydeck.clipboard) {
        await window.skydeck.clipboard.writeText(file.path);
      } else {
        await navigator.clipboard.writeText(file.path);
      }
      onToast({
        type: 'success',
        title: 'Copied to clipboard',
        message: file.path,
      });
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Failed to copy path',
        message: err.message,
      });
    }
  };

  // Context Menu trigger
  const handleContextMenu = (e, file, pane = 'primary') => {
    e.preventDefault();
    setActivePane(pane);
    if (pane === 'primary') {
      setSelectedFile(file);
    } else {
      setSecondarySelectedFile(file);
    }
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      file,
      pane,
    });
  };

  // Filter entries
  const filteredEntries = entries.filter((entry) =>
    entry.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Top action bar */}
      <TopBar
        currentPath={currentPath}
        parentPath={parentPath}
        onNavigate={fetchDirectory}
        onRefresh={() => fetchDirectory(currentPath)}
        onCreateFolder={handleCreateFolder}
        onUploadClick={() => uploadInputRef.current && uploadInputRef.current.click()}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        loading={loading}
        isTerminalOpen={isTerminalOpen}
        onToggleTerminal={onToggleTerminal}
        isDualPane={isDualPane}
        onToggleDualPane={() => setIsDualPane(!isDualPane)}
        onOpenSearchModal={() => setIsSearchOpen(true)}
        onOpenDiskUsage={() => setIsDiskUsageOpen(true)}
      />

      {/* Hidden file input for uploads */}
      <input
        type="file"
        multiple
        ref={uploadInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadFiles(e.target.files);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Main File Browser Area (Single vs Dual Pane) */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left / Primary Pane */}
        <div
          className={`flex-1 flex flex-col min-w-0 h-full ${
            isDualPane ? 'border-r border-border' : ''
          }`}
          onClick={() => setActivePane('primary')}
        >
          {isDualPane && (
            <div className="flex items-center justify-between px-3 py-1 bg-surface-2/60 border-b border-border text-xs text-textMuted select-none">
              <div className="flex items-center gap-1.5 font-mono truncate">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="font-semibold text-textPrimary">Pane 1:</span>
                <span className="truncate">{currentPath}</span>
              </div>
              <button
                onClick={() => fetchDirectory(currentPath)}
                className="p-1 hover:text-textPrimary rounded"
                title="Refresh Pane 1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-accent' : ''}`} />
              </button>
            </div>
          )}

          <FileList
            entries={filteredEntries}
            loading={loading}
            selectedFile={selectedFile}
            currentPath={currentPath}
            parentPath={parentPath}
            onSelectFile={setSelectedFile}
            onOpenFolder={fetchDirectory}
            onOpenFile={handleOpenFile}
            onContextMenu={(e, file) => handleContextMenu(e, file, 'primary')}
            onRenameSubmit={handleRenameSubmit}
            renamingFile={renamingFile}
            setRenamingFile={setRenamingFile}
            onDropFiles={handleUploadFiles}
          />
        </div>

        {/* Right / Secondary Pane (Dual Pane mode) */}
        {isDualPane && (
          <div
            className="flex-1 flex flex-col min-w-0 h-full bg-background"
            onClick={() => setActivePane('secondary')}
          >
            <div className="flex items-center justify-between px-3 py-1 bg-surface-2/60 border-b border-border text-xs text-textMuted select-none">
              <div className="flex items-center gap-1.5 font-mono truncate">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="font-semibold text-textPrimary">Pane 2:</span>
                <span className="truncate">{secondaryPath}</span>
              </div>
              <div className="flex items-center gap-1">
                {secondaryParentPath && (
                  <button
                    onClick={() => fetchSecondaryDirectory(secondaryParentPath)}
                    className="p-1 hover:text-textPrimary rounded"
                    title={`Back to ${secondaryParentPath}`}
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => fetchSecondaryDirectory(secondaryPath)}
                  className="p-1 hover:text-textPrimary rounded"
                  title="Refresh Pane 2"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${secondaryLoading ? 'animate-spin text-accent' : ''}`}
                  />
                </button>
              </div>
            </div>

            <FileList
              entries={secondaryEntries}
              loading={secondaryLoading}
              selectedFile={secondarySelectedFile}
              currentPath={secondaryPath}
              parentPath={secondaryParentPath}
              onSelectFile={setSecondarySelectedFile}
              onOpenFolder={fetchSecondaryDirectory}
              onOpenFile={handleOpenFile}
              onContextMenu={(e, file) => handleContextMenu(e, file, 'secondary')}
              onRenameSubmit={handleRenameSubmit}
              renamingFile={renamingFile}
              setRenamingFile={setRenamingFile}
              onDropFiles={(files) => api.uploadFiles(activeSession.session_id, secondaryPath, files)}
            />
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onClose={() => setContextMenu({ visible: false, x: 0, y: 0, file: null, pane: 'primary' })}
          onDownload={handleDownload}
          onRename={(file) => setRenamingFile(file)}
          onCopyPath={handleCopyPath}
          onChmod={(file) => {
            setChmodFile(file);
            setIsChmodOpen(true);
          }}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onBookmark={onBookmark}
          onExtractArchive={(file) =>
            setArchiveModal({
              isOpen: true,
              mode: 'extract',
              targetItem: file,
            })
          }
          onCompress={(file) =>
            setArchiveModal({
              isOpen: true,
              mode: 'compress',
              targetItem: file,
            })
          }
        />
      )}

      {/* Advanced Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        session={activeSession}
        currentPath={currentPath}
        onNavigate={(path) => {
          fetchDirectory(path);
          setIsSearchOpen(false);
        }}
        onOpenFile={(file) => {
          handleOpenFile(file);
          setIsSearchOpen(false);
        }}
      />

      {/* Disk Usage Modal */}
      <DiskUsageModal
        isOpen={isDiskUsageOpen}
        onClose={() => setIsDiskUsageOpen(false)}
        session={activeSession}
        currentPath={currentPath}
        onNavigate={(path) => {
          fetchDirectory(path);
          setIsDiskUsageOpen(false);
        }}
      />

      {/* Archive Modal (Extract / Compress) */}
      <ArchiveModal
        isOpen={archiveModal.isOpen}
        mode={archiveModal.mode}
        targetItem={archiveModal.targetItem}
        currentPath={currentPath}
        session={activeSession}
        onClose={() => setArchiveModal((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={() => {
          onToast({
            type: 'success',
            title: 'Archive Completed',
            message:
              archiveModal.mode === 'extract'
                ? 'Archive extracted successfully.'
                : 'Archive created successfully.',
          });
          fetchDirectory(currentPath);
          if (isDualPane) fetchSecondaryDirectory(secondaryPath);
        }}
      />

      {/* Text Editor Modal (Monaco) */}
      <EditorModal
        isOpen={isEditorOpen}
        file={editorFile}
        content={editorContent}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveEditor}
      />

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={isImageOpen}
        file={imageFile}
        sessionId={activeSession?.session_id}
        onClose={() => setIsImageOpen(false)}
        onDownload={handleDownload}
      />

      {/* Permissions Modal */}
      <PermissionsModal
        isOpen={isChmodOpen}
        file={chmodFile}
        onClose={() => setIsChmodOpen(false)}
        onApply={handleApplyChmod}
      />

      {/* Upload Progress */}
      <UploadProgress
        progress={uploadProgress}
        onCancel={() => setUploadProgress({ isUploading: false, percent: 0, loaded: 0, total: 0 })}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
