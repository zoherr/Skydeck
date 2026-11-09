import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Save, X, FileCode, Check } from 'lucide-react';
import { getFileExtension, getLanguageFromExt } from '../utils/format';
import ConfirmDialog from './ConfirmDialog';

export default function EditorModal({ isOpen, file, content, onClose, onSave }) {
  const [currentContent, setCurrentContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  useEffect(() => {
    if (file) {
      setCurrentContent(content || '');
      setIsDirty(false);
    }
  }, [file, content]);

  if (!isOpen || !file) return null;

  const ext = getFileExtension(file.name);
  const language = getLanguageFromExt(ext);

  const handleEditorChange = (value) => {
    setCurrentContent(value);
    setIsDirty(value !== content);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(file.path, currentContent);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseAttempt = () => {
    if (isDirty) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  // Keyboard shortcut Ctrl+S
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 p-6"
    >
      <div className="bg-surface border border-border rounded-card w-full h-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Editor Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-border select-none">
          <div className="flex items-center gap-3">
            <FileCode className="w-4 h-4 text-accent" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-textPrimary">{file.name}</span>
              {isDirty && (
                <span className="w-2 h-2 rounded-full bg-warning animate-pulse" title="Unsaved changes" />
              )}
            </div>
            <span className="text-xs text-textMuted font-mono px-2 py-0.5 rounded bg-background/50 border border-border/40">
              {file.path}
            </span>
            <span className="text-[11px] text-textMuted uppercase tracking-wider font-semibold">
              {language}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn transition-hover ${
                isDirty
                  ? 'bg-accent hover:bg-accent-hover text-white shadow-sm'
                  : 'bg-surface border border-border/50 text-textMuted cursor-default'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save (Ctrl+S)'}</span>
            </button>

            <button
              onClick={handleCloseAttempt}
              className="p-1.5 text-textMuted hover:text-textPrimary hover:bg-surface rounded-btn transition-hover ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Monaco Editor Container */}
        <div className="flex-1 w-full h-full overflow-hidden bg-[#1e1e1e]">
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={currentContent}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: true },
              fontSize: 13,
              fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
              lineNumbers: 'on',
              roundedSelection: false,
            }}
          />
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirmClose}
        title="Unsaved Changes"
        message="You have unsaved changes in this file. Are you sure you want to close without saving?"
        confirmText="Discard and Close"
        cancelText="Keep Editing"
        danger={true}
        onConfirm={() => {
          setShowConfirmClose(false);
          onClose();
        }}
        onCancel={() => setShowConfirmClose(false)}
      />
    </div>
  );
}
