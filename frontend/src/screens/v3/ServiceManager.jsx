import React, { useState, useEffect } from 'react';
import {
  Cog,
  Play,
  Square,
  RotateCw,
  FileText,
  Search,
  RefreshCw,
  Clock,
  Save,
  X,
  Plus,
} from 'lucide-react';
import { api } from '../../utils/api';

export default function ServiceManager({ session, onToast }) {
  const [subTab, setSubTab] = useState('systemd'); // 'systemd' | 'cron'
  const [services, setServices] = useState([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [logsModal, setLogsModal] = useState({ isOpen: false, unit: '', content: '' });

  // Cron state
  const [cronContent, setCronContent] = useState('');
  const [cronLoading, setCronLoading] = useState(false);

  const fetchServices = async () => {
    if (!session?.session_id) return;
    setLoading(true);
    try {
      const res = await api.v3.getServices(session.session_id);
      setAvailable(res.available !== false);
      setServices(res.services || []);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Service Error',
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCron = async () => {
    if (!session?.session_id) return;
    setCronLoading(true);
    try {
      const res = await api.v3.getCron(session.session_id);
      setCronContent(res.raw || '');
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Cron Error',
        message: err.message,
      });
    } finally {
      setCronLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'systemd') fetchServices();
    else fetchCron();
  }, [subTab, session?.session_id]);

  const handleAction = async (unit, action) => {
    try {
      await api.v3.serviceAction(session.session_id, unit, action);
      onToast({
        type: 'success',
        title: 'Service Updated',
        message: `${action} succeeded for ${unit}`,
      });
      fetchServices();
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Service Action Failed',
        message: err.message,
      });
    }
  };

  const handleViewLogs = async (unit) => {
    try {
      const res = await api.v3.getServiceLogs(session.session_id, unit, 200);
      setLogsModal({
        isOpen: true,
        unit,
        content: res.logs || '(No journal output)',
      });
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Journal Error',
        message: err.message,
      });
    }
  };

  const handleSaveCron = async () => {
    setCronLoading(true);
    try {
      await api.v3.saveCron(session.session_id, cronContent);
      onToast({
        type: 'success',
        title: 'Crontab Saved',
        message: 'Scheduled cron jobs updated on the server.',
      });
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message,
      });
    } finally {
      setCronLoading(false);
    }
  };

  const insertCronTemplate = (template) => {
    setCronContent((prev) => (prev.trim() ? prev.trim() + '\n' + template : template));
  };

  const filteredServices = services.filter((s) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      s.unit.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.active.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-textPrimary flex items-center gap-2">
            <Cog className="w-5 h-5 text-purple-400" />
            Services & Scheduled Tasks
          </h1>
          <p className="text-xs text-textMuted mt-0.5">
            Manage systemd units, inspect journalctl logs, and edit cron schedules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('systemd')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              subTab === 'systemd'
                ? 'bg-accent text-white border-accent'
                : 'bg-surface border-border text-textMuted hover:text-textPrimary'
            }`}
          >
            Systemd Services
          </button>
          <button
            onClick={() => setSubTab('cron')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              subTab === 'cron'
                ? 'bg-accent text-white border-accent'
                : 'bg-surface border-border text-textMuted hover:text-textPrimary'
            }`}
          >
            Cron Jobs
          </button>
        </div>
      </div>

      {subTab === 'systemd' ? (
        <>
          <div className="flex items-center justify-between gap-3 shrink-0">
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 text-textMuted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search unit (e.g. nginx, docker, ssh, mysql)..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-surface border border-border text-xs text-textPrimary pl-8 pr-7 py-1.5 rounded-lg focus:outline-none focus:border-accent"
              />
            </div>

            <button
              onClick={fetchServices}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface-2 border border-border rounded-lg text-xs text-textPrimary transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {!available ? (
            <div className="bg-surface border border-border rounded-xl p-8 text-center text-xs text-textMuted">
              systemd is not running or inaccessible on this server.
            </div>
          ) : (
            <div className="flex-1 overflow-auto border border-border rounded-xl bg-surface">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-surface-2 text-textMuted border-b border-border sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Service Unit</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Description</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredServices.map((svc) => {
                    const isActive = svc.active === 'active';
                    const isFailed = svc.active === 'failed';
                    return (
                      <tr key={svc.unit} className="hover:bg-surface-2/60 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-semibold text-textPrimary">{svc.unit}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                              isActive
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : isFailed
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-surface-2 text-textMuted border border-border'
                            }`}
                          >
                            {svc.active} ({svc.sub})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-textMuted max-w-sm truncate">{svc.description}</td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-1">
                          {isActive ? (
                            <>
                              <button
                                onClick={() => handleAction(svc.unit, 'restart')}
                                className="px-2 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded"
                                title="Restart service"
                              >
                                <RotateCw className="w-3 h-3 inline mr-1" />
                                Restart
                              </button>
                              <button
                                onClick={() => handleAction(svc.unit, 'stop')}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded"
                                title="Stop service"
                              >
                                <Square className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleAction(svc.unit, 'start')}
                              className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded"
                              title="Start service"
                            >
                              <Play className="w-3 h-3 inline mr-1" />
                              Start
                            </button>
                          )}
                          <button
                            onClick={() => handleViewLogs(svc.unit)}
                            className="p-1.5 bg-surface-2 hover:bg-border text-textPrimary border border-border rounded"
                            title="View journalctl logs"
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Visual Cron Manager */
        <div className="flex-1 flex flex-col bg-surface border border-border rounded-xl p-5 space-y-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-textPrimary flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                User Crontab Editor (`crontab -l`)
              </h3>
              <p className="text-xs text-textMuted mt-0.5">
                Format: <code className="font-mono text-accent">minute hour day month weekday command</code>
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => insertCronTemplate('0 0 * * * /path/to/backup.sh')}
                className="px-2.5 py-1 bg-surface-2 hover:bg-border border border-border rounded text-textMuted hover:text-textPrimary"
              >
                <Plus className="w-3 h-3 inline mr-1" />
                Daily Midnight
              </button>
              <button
                onClick={() => insertCronTemplate('*/5 * * * * /usr/bin/curl -s http://localhost/health >/dev/null')}
                className="px-2.5 py-1 bg-surface-2 hover:bg-border border border-border rounded text-textMuted hover:text-textPrimary"
              >
                <Plus className="w-3 h-3 inline mr-1" />
                Every 5 Min
              </button>
              <button
                onClick={handleSaveCron}
                disabled={cronLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg ml-2 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Crontab</span>
              </button>
            </div>
          </div>

          <textarea
            value={cronContent}
            onChange={(e) => setCronContent(e.target.value)}
            spellCheck={false}
            placeholder="# No cron jobs configured yet. Click a preset or type crontab entries..."
            className="flex-1 w-full bg-[#0a0c10] border border-border rounded-xl p-4 font-mono text-xs text-emerald-400 focus:outline-none focus:border-accent resize-none leading-relaxed"
          />
        </div>
      )}

      {/* Journal Logs Modal */}
      {logsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-4xl h-[75vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 bg-surface-2 border-b border-border">
              <span className="text-sm font-semibold text-textPrimary flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                journalctl -u {logsModal.unit}
              </span>
              <button
                onClick={() => setLogsModal({ isOpen: false, unit: '', content: '' })}
                className="p-1 text-textMuted hover:text-textPrimary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 bg-[#0a0c10] text-textPrimary font-mono text-xs whitespace-pre-wrap">
              {logsModal.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

