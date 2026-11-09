import React, { useState, useEffect, useRef } from 'react';
import TopBar from '../components/TopBar';
import FileList from '../components/FileList';
import ContextMenu from '../components/ContextMenu';
import EditorModal from '../components/EditorModal';
import ImagePreviewModal from '../components/ImagePreviewModal';
import PermissionsModal from '../components/PermissionsModal';
import UploadProgress from '../components/UploadProgress';
import ConfirmDialog from '../components/ConfirmDialog';
import { api } from '../utils/api';
import { getFileExtension } from '../utils/format';

export default function FileManager({ activeSession, navTarget, onToast }) {
  const [currentPath, setCurrentPath] = useState(activeSession?.initial_path || '/');
  const [parentPath, setParentPath] = useState('/');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, file: null });

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

  // Fetch directory listing
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

  useEffect(() => {
    fetchDirectory(currentPath);
  }, [activeSession]);

  // Handle external navigation target from Sidebar Quick Locations
  useEffect(() => {
    if (navTarget) {
      fetchDirectory(navTarget);
    }
  }, [navTarget]);

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
      message: `Are you sure you want to permanently delete "${file.name}"? This action cannot be reversed.`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await api.deleteItem(activeSession.session_id, file.path, file.is_dir);
          onToast({
            type: 'info',
            title: 'Deleted',
            message: `${file.name} has been deleted.`,
          });
          fetchDirectory(currentPath);
        } catch (err) {
          onToast({
            type: 'error',
            title: 'Delete failed',
            message: err.message,
          });
        }
      },
    });
  };

  // Rename
  const handleRenameSubmit = async (file, newName) => {
    const parent = file.path.substring(0, file.path.lastIndexOf('/'));
    const newPath = (parent === '' ? '/' : parent) + (parent.endsWith('/') ? '' : '/') + newName;

    try {
      await api.renameItem(activeSession.session_id, file.path, newPath);
      onToast({
        type: 'success',
        title: 'Renamed',
        message: `Renamed to ${newName}`,
      });
      fetchDirectory(currentPath);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Rename failed',
        message: err.message,
      });
    }
  };

  // Create Folder
  const handleCreateFolder = async (folderName) => {
    const newPath = (currentPath.endsWith('/') ? currentPath : currentPath + '/') + folderName;
    try {
      await api.createFolder(activeSession.session_id, newPath);
      onToast({
        type: 'success',
        title: 'Folder created',
        message: `Created folder ${folderName}`,
      });
      fetchDirectory(currentPath);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Failed to create folder',
        message: err.message,
      });
    }
  };

  // Chmod
  const handleApplyChmod = async (path, mode) => {
    try {
      await api.chmod(activeSession.session_id, path, mode);
      setIsChmodOpen(false);
      onToast({
        type: 'success',
        title: 'Permissions changed',
        message: `Updated permissions of ${chmodFile.name} to ${mode}`,
      });
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
  const handleCopyPath = (file) => {
    if (window.skydeck && window.skydeck.clipboard) {
      window.skydeck.clipboard.writeText(file.path);
    } else {
      navigator.clipboard.writeText(file.path);
    }
    onToast({
      type: 'info',
      title: 'Copied to clipboard',
      message: file.path,
    });
  };

  // Upload handler
  const handleUploadFiles = async (files) => {
    if (!files || files.length === 0) return;

    setUploadProgress({
      isUploading: true,
      percent: 0,
      loaded: 0,
      total: 0,
      filename: files.length === 1 ? files[0].name : `${files.length} files`,
    });

    try {
      await api.uploadFiles(
        activeSession.session_id,
        currentPath,
        files,
        ({ loaded, total, percent }) => {
          setUploadProgress((prev) => ({
            ...prev,
            loaded,
            total,
            percent,
          }));
        }
      );

      onToast({
        type: 'success',
        title: 'Upload complete',
        message: `Successfully uploaded ${files.length} file(s) to ${currentPath}`,
      });
      fetchDirectory(currentPath);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Upload failed',
        message: err.message,
      });
    } finally {
      setUploadProgress({ isUploading: false, percent: 0, loaded: 0, total: 0 });
    }
  };

  // Context Menu trigger
  const handleContextMenu = (e, file) => {
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      file,
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

      {/* File List Table with drag & drop */}
      <FileList
        entries={filteredEntries}
        loading={loading}
        selectedFile={selectedFile}
        currentPath={currentPath}
        parentPath={parentPath}
        onSelectFile={setSelectedFile}
        onOpenFolder={fetchDirectory}
        onOpenFile={handleOpenFile}
        onContextMenu={handleContextMenu}
        onRenameSubmit={handleRenameSubmit}
        renamingFile={renamingFile}
        setRenamingFile={setRenamingFile}
        onDropFiles={handleUploadFiles}
      />

      {/* Context Menu */}
      {contextMenu.visible && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onClose={() => setContextMenu({ visible: false, x: 0, y: 0, file: null })}
          onDownload={handleDownload}
          onRename={(file) => setRenamingFile(file)}
          onCopyPath={handleCopyPath}
          onChmod={(file) => {
            setChmodFile(file);
            setIsChmodOpen(true);
          }}
          onDelete={handleDelete}
        />
      )}

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
