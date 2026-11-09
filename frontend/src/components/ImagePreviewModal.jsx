import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Image as ImageIcon, Loader2 } from 'lucide-react';
import { api, getBackendAuthToken } from '../utils/api';
import { formatBytes } from '../utils/format';

export default function ImagePreviewModal({ isOpen, file, sessionId, onClose, onDownload }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!isOpen || !file || !sessionId) {
      setImageUrl(null);
      setZoom(1);
      setError('');
      return;
    }

    let active = true;
    let objectUrl = null;

    async function loadImage() {
      setLoading(true);
      setError('');
      try {
        const token = await getBackendAuthToken();
        const url = `http://127.0.0.1:48921/api/download?session_id=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(file.path)}&token=${encodeURIComponent(token)}`;

        const response = await fetch(url, {
          headers: { 'X-Skydeck-Token': token },
        });

        if (!response.ok) throw new Error(`Failed to load image: status ${response.status}`);

        const blob = await response.blob();
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadImage();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, file, sessionId]);

  if (!isOpen || !file) return null;

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
  const handleResetZoom = () => setZoom(1);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-150 p-6 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border rounded-card w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-textPrimary truncate">{file.name}</span>
            <span className="text-[11px] text-textMuted font-mono shrink-0">
              {formatBytes(file.size)}
            </span>
            {dimensions.width > 0 && (
              <span className="text-[11px] text-textMuted font-mono shrink-0">
                • {dimensions.width} × {dimensions.height} px
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Zoom Controls */}
            <div className="flex items-center bg-surface border border-border/60 rounded-btn p-0.5 mr-2">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 0.25}
                className="p-1 text-textMuted hover:text-textPrimary hover:bg-surface-2 rounded transition-hover disabled:opacity-30"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-textMuted font-mono px-2">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-1 text-textMuted hover:text-textPrimary hover:bg-surface-2 rounded transition-hover disabled:opacity-30"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1 text-textMuted hover:text-textPrimary hover:bg-surface-2 rounded transition-hover"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => onDownload(file)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-textPrimary bg-surface-2 hover:bg-border/60 border border-border rounded-btn transition-hover"
            >
              <Download className="w-3.5 h-3.5 text-accent" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 text-textMuted hover:text-textPrimary hover:bg-surface-2 rounded-btn transition-hover ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[#07080b] min-h-[400px] relative">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-textMuted">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span className="text-xs">Loading image from server...</span>
            </div>
          )}

          {error && (
            <div className="text-xs text-error bg-error/10 border border-error/20 p-4 rounded-card max-w-sm text-center">
              {error}
            </div>
          )}

          {!loading && !error && imageUrl && (
            <img
              src={imageUrl}
              alt={file.name}
              onLoad={(e) => {
                setDimensions({
                  width: e.target.naturalWidth,
                  height: e.target.naturalHeight,
                });
              }}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="max-h-[70vh] max-w-full object-contain transition-transform duration-150 ease-out rounded shadow-lg"
            />
          )}
        </div>
      </div>
    </div>
  );
}

