import React, { useState, useEffect } from 'react';
import {
  Container,
  Play,
  Square,
  RotateCw,
  Trash2,
  Terminal,
  FileText,
  Layers,
  HardDrive,
  RefreshCw,
  X,
  Sparkles,
} from 'lucide-react';
import { api } from '../../utils/api';

export default function DockerManager({ session, onToast, onOpenContainerShell }) {
  const [tab, setTab] = useState('containers'); // 'containers' | 'images' | 'volumes'
  const [data, setData] = useState({ available: true, containers: [], images: [], volumes: [] });
  const [loading, setLoading] = useState(true);
  const [logsModal, setLogsModal] = useState({ isOpen: false, name: '', content: '' });

  const fetchDocker = async () => {
    if (!session?.session_id) return;
    setLoading(true);
    try {
      const res = await api.v3.getDockerOverview(session.session_id);
      setData(res);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Docker Error',
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocker();
  }, [session?.session_id]);

  const handleContainerAction = async (containerId, action) => {
    try {
      await api.v3.dockerAction(session.session_id, containerId, action);
      onToast({
        type: 'success',
        title: 'Docker Action Complete',
        message: `Executed "${action}" on container ${containerId}`,
      });
      fetchDocker();
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Action Failed',
        message: err.message,
      });
    }
  };

  const handleViewLogs = async (container) => {
    try {
      const res = await api.v3.getDockerLogs(session.session_id, container.id, 300);
      setLogsModal({
        isOpen: true,
        name: container.names || container.id,
        content: res.logs || '(No logs output)',
      });
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Logs Error',
        message: err.message,
      });
    }
  };

  const handlePrune = async () => {
    try {
      const res = await api.v3.dockerPrune(session.session_id);
      onToast({
        type: 'success',
        title: 'Docker Prune Complete',
        message: res.output || 'Cleaned unused containers & dangling images',
      });
      fetchDocker();
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Prune Failed',
        message: err.message,
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-textPrimary flex items-center gap-2">
            <Container className="w-5 h-5 text-sky-400" />
            Docker Engine Manager
            {data.server_version && (
              <span className="text-[11px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded">
                v{data.server_version}
              </span>
            )}
          </h1>
          <p className="text-xs text-textMuted mt-0.5">
            Manage containers, inspect images, manage volumes, and stream container logs or exec shells
          </p>
        </div>

        <div className="flex items-center gap-2">
          {data.available && (
            <button
              onClick={handlePrune}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-rose-500/10 hover:text-rose-400 border border-border rounded-lg text-xs text-textMuted transition-all"
              title="Clean unused containers and dangling images"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>System Prune</span>
            </button>
          )}
          <button
            onClick={fetchDocker}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-medium transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {!data.available ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center max-w-lg mx-auto mt-10 space-y-2">
          <Container className="w-10 h-10 text-textMuted mx-auto opacity-50" />
          <h3 className="text-sm font-semibold text-textPrimary">Docker Daemon Unavailable</h3>
          <p className="text-xs text-textMuted">
            Could not detect a running Docker engine on this VPS ({data.reason || 'docker not installed or permission denied'}).
          </p>
        </div>
      ) : (
        <>
          {/* Sub-Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-2 shrink-0">
            <button
              onClick={() => setTab('containers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                tab === 'containers'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-textMuted hover:text-textPrimary hover:bg-surface'
              }`}
            >
              <Container className="w-3.5 h-3.5" />
              <span>Containers ({(data.containers || []).length})</span>
            </button>
            <button
              onClick={() => setTab('images')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                tab === 'images'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-textMuted hover:text-textPrimary hover:bg-surface'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Images ({(data.images || []).length})</span>
            </button>
            <button
              onClick={() => setTab('volumes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                tab === 'volumes'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-textMuted hover:text-textPrimary hover:bg-surface'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Volumes ({(data.volumes || []).length})</span>
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto border border-border rounded-xl bg-surface">
            {tab === 'containers' && (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-surface-2 text-textMuted border-b border-border sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Container</th>
                    <th className="py-2.5 px-3 font-semibold">Image</th>
                    <th className="py-2.5 px-3 font-semibold">State</th>
                    <th className="py-2.5 px-3 font-semibold">Ports</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(data.containers || []).map((c) => {
                    const isRunning = c.state === 'running';
                    return (
                      <tr key={c.id} className="hover:bg-surface-2/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-textPrimary">{c.names}</div>
                          <div className="text-[11px] font-mono text-textMuted">{c.id}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-sky-400 max-w-[200px] truncate">{c.image}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                              isRunning
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-surface-2 text-textMuted border border-border'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-textMuted'
                              }`}
                            />
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-textMuted max-w-[180px] truncate" title={c.ports}>
                          {c.ports || '—'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                          {isRunning ? (
                            <>
                              <button
                                onClick={() => onOpenContainerShell(c.id, c.names)}
                                className="px-2 py-1 bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 rounded transition-all"
                                title="Open interactive shell inside container"
                              >
                                <Terminal className="w-3.5 h-3.5 inline mr-1" />
                                Shell
                              </button>
                              <button
                                onClick={() => handleContainerAction(c.id, 'stop')}
                                className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded"
                                title="Stop Container"
                              >
                                <Square className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleContainerAction(c.id, 'restart')}
                                className="p-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded"
                                title="Restart Container"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleContainerAction(c.id, 'start')}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded"
                              title="Start Container"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleViewLogs(c)}
                            className="p-1.5 bg-surface-2 hover:bg-border text-textPrimary border border-border rounded"
                            title="View Container Logs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleContainerAction(c.id, 'rm')}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded"
                            title="Remove Container"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {(!data.containers || data.containers.length === 0) && (
                    <tr>
                      <td colSpan="5" className="text-center py-10 text-textMuted">
                        No containers found on this host.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === 'images' && (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-surface-2 text-textMuted border-b border-border sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Repository</th>
                    <th className="py-2.5 px-3 font-semibold">Tag</th>
                    <th className="py-2.5 px-3 font-semibold">Image ID</th>
                    <th className="py-2.5 px-3 font-semibold">Size</th>
                    <th className="py-2.5 px-4 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(data.images || []).map((img, i) => (
                    <tr key={img.id + i} className="hover:bg-surface-2/60">
                      <td className="py-2.5 px-4 font-mono font-semibold text-textPrimary">{img.repository}</td>
                      <td className="py-2.5 px-3 font-mono text-accent">{img.tag}</td>
                      <td className="py-2.5 px-3 font-mono text-textMuted">{img.id}</td>
                      <td className="py-2.5 px-3 font-mono">{img.size}</td>
                      <td className="py-2.5 px-4 text-textMuted">{img.created}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'volumes' && (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-surface-2 text-textMuted border-b border-border sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Volume Name</th>
                    <th className="py-2.5 px-3 font-semibold">Driver</th>
                    <th className="py-2.5 px-4 font-semibold">Mountpoint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(data.volumes || []).map((vol, i) => (
                    <tr key={vol.name + i} className="hover:bg-surface-2/60">
                      <td className="py-2.5 px-4 font-mono font-semibold text-textPrimary">{vol.name}</td>
                      <td className="py-2.5 px-3 font-mono text-accent">{vol.driver}</td>
                      <td className="py-2.5 px-4 font-mono text-textMuted text-[11px]">{vol.mountpoint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Container Logs Modal */}
      {logsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-4xl h-[75vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 bg-surface-2 border-b border-border">
              <div className="flex items-center gap-2 text-sm font-semibold text-textPrimary">
                <FileText className="w-4 h-4 text-sky-400" />
                <span>Container Logs: {logsModal.name}</span>
              </div>
              <button
                onClick={() => setLogsModal({ isOpen: false, name: '', content: '' })}
                className="p-1 text-textMuted hover:text-textPrimary rounded hover:bg-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 bg-[#0a0c10] text-emerald-400 font-mono text-xs whitespace-pre-wrap">
              {logsModal.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

