import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  Maximize2,
  Minimize2,
  RotateCw,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { api } from '../utils/api';

function TerminalTabInstance({ session, tabId, containerId, isActive, isExpanded }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState('connecting'); // connecting, connected, disconnected, error

  const connectTerminal = async () => {
    if (!session?.session_id) return;
    setStatus('connecting');

    try {
      const wsUrl = await api.getTerminalWsUrl(session.session_id, containerId || '');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.binaryType = 'arraybuffer';

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Courier New", monospace',
        lineHeight: 1.25,
        theme: {
          background: '#0a0c10',
          foreground: '#e2e8f0',
          cursor: '#6366f1',
          cursorAccent: '#0a0c10',
          selectionBackground: 'rgba(99, 102, 241, 0.35)',
          black: '#161922',
          red: '#ef4444',
          green: '#10b981',
          yellow: '#f59e0b',
          blue: '#6366f1',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#f1f5f9',
          brightBlack: '#475569',
          brightRed: '#f87171',
          brightGreen: '#34d399',
          brightYellow: '#fbbf24',
          brightBlue: '#818cf8',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#ffffff',
        },
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      termRef.current = term;
      fitAddonRef.current = fitAddon;

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        term.open(containerRef.current);
        fitAddon.fit();
      }

      ws.onopen = () => {
        setStatus('connected');
        // Notify backend of terminal dimensions
        if (term.cols && term.rows) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
        term.focus();
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data));
        } else {
          term.write(event.data);
        }
      };

      ws.onerror = () => {
        setStatus('error');
        term.write('\r\n\x1b[31m[WebSocket connection error]\x1b[0m\r\n');
      };

      ws.onclose = () => {
        setStatus('disconnected');
        term.write('\r\n\x1b[33m[Session disconnected]\x1b[0m\r\n');
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });
    } catch (err) {
      console.error('Failed to initialize terminal:', err);
      setStatus('error');
    }
  };

  useEffect(() => {
    connectTerminal();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (termRef.current) {
        termRef.current.dispose();
      }
    };
  }, [session?.session_id, tabId]);

  // Fit terminal when active or expanded changes
  useEffect(() => {
    if (isActive && fitAddonRef.current && termRef.current) {
      const timer = setTimeout(() => {
        try {
          fitAddonRef.current.fit();
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'resize',
                cols: termRef.current.cols,
                rows: termRef.current.rows,
              })
            );
          }
        } catch (e) {
          // container not sized yet
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive, isExpanded]);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      if (isActive && fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'resize',
                cols: termRef.current.cols,
                rows: termRef.current.rows,
              })
            );
          }
        } catch (e) {}
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isActive]);

  const handleClear = () => {
    if (termRef.current) {
      termRef.current.clear();
    }
  };

  return (
    <div
      className={`h-full w-full flex-col ${isActive ? 'flex' : 'hidden'} bg-[#0a0c10] relative`}
    >
      {/* Terminal Canvas */}
      <div ref={containerRef} className="flex-1 w-full overflow-hidden p-3" />

      {/* Disconnected / Reconnect banner */}
      {status === 'disconnected' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-3 select-none">
          <span className="text-sm text-textMuted">Terminal connection closed</span>
          <button
            onClick={connectTerminal}
            className="flex items-center gap-1.5 px-3 py-1 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded shadow transition-all"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Reconnect
          </button>
        </div>
      )}
    </div>
  );
}

export default function TerminalPanel({ session, isOpen, onClose, containerShellRequest }) {
  const [tabs, setTabs] = useState([{ id: 1, title: 'Terminal 1', containerId: '' }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (containerShellRequest && containerShellRequest.id) {
      const nextId = (tabs[tabs.length - 1]?.id || 0) + 1;
      const label = containerShellRequest.name || containerShellRequest.id.slice(0, 12);
      const newTab = {
        id: nextId,
        title: `🐳 ${label}`,
        containerId: containerShellRequest.id,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(nextId);
    }
  }, [containerShellRequest]);

  if (!isOpen) return null;

  const handleAddTab = () => {
    const nextId = (tabs[tabs.length - 1]?.id || 0) + 1;
    const newTab = { id: nextId, title: `Terminal ${nextId}`, containerId: '' };
    setTabs([...tabs, newTab]);
    setActiveTabId(nextId);
  };

  const handleCloseTab = (id, e) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      onClose();
      return;
    }
    const filtered = tabs.filter((t) => t.id !== id);
    setTabs(filtered);
    if (activeTabId === id) {
      setActiveTabId(filtered[filtered.length - 1].id);
    }
  };

  return (
    <div
      className={`border-t border-border bg-[#0a0c10] flex flex-col transition-all duration-200 z-30 shadow-2xl ${
        isExpanded ? 'h-[75vh]' : 'h-72'
      }`}
    >
      {/* Terminal Titlebar & Tabs */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-border select-none shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 text-accent font-semibold text-xs px-2 py-1 bg-accent/10 border border-accent/20 rounded">
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>SSH Shell</span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1 text-xs rounded transition-all cursor-pointer ${
                    isActive
                      ? 'bg-surface-2 text-textPrimary font-medium border border-border'
                      : 'text-textMuted hover:text-textPrimary hover:bg-surface-2/60'
                  }`}
                >
                  <span>{tab.title}</span>
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="p-0.5 text-textMuted hover:text-rose-400 rounded"
                    title="Close tab"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            <button
              onClick={handleAddTab}
              className="p-1 text-textMuted hover:text-textPrimary hover:bg-surface-2 rounded transition-all ml-1"
              title="New Terminal Tab"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-textMuted hover:text-textPrimary hover:bg-surface-2 rounded transition-all"
            title={isExpanded ? 'Restore size' : 'Maximize terminal'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-textMuted hover:text-rose-400 hover:bg-surface-2 rounded transition-all"
            title="Hide Terminal (Ctrl+`)"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Viewports */}
      <div className="flex-1 w-full relative overflow-hidden">
        {tabs.map((tab) => (
          <TerminalTabInstance
            key={tab.id}
            tabId={tab.id}
            containerId={tab.containerId}
            session={session}
            isActive={tab.id === activeTabId}
            isExpanded={isExpanded}
          />
        ))}
      </div>
    </div>
  );
}

