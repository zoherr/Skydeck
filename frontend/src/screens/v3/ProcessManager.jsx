import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Search,
  RefreshCw,
  Skull,
  Power,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { api } from '../../utils/api';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function ProcessManager({ session, onToast }) {
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('cpu'); // 'cpu' | 'mem'
  const [filterText, setFilterText] = useState('');
  const [confirmKill, setConfirmKill] = useState({
    isOpen: false,
    proc: null,
    signal: 'TERM',
  });

  const fetchProcesses = async () => {
    if (!session?.session_id) return;
    setLoading(true);
    try {
      const data = await api.v3.getProcesses(session.session_id, sortBy);
      setProcesses(data || []);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Process Fetch Error',
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, [session?.session_id, sortBy]);

  const handleKillConfirm = async () => {
    const { proc, signal } = confirmKill;
    if (!proc) return;
    try {
      await api.v3.killProcess(session.session_id, proc.pid, signal);
      onToast({
        type: 'success',
        title: `SIG${signal} Sent`,
        message: `Signal sent to PID ${proc.pid} (${proc.command})`,
      });
      setConfirmKill({ isOpen: false, proc: null, signal: 'TERM' });
      setTimeout(fetchProcesses, 400);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Kill Failed',
        message: err.message,
      });
      setConfirmKill({ isOpen: false, proc: null, signal: 'TERM' });
    }
  };

  const filtered = processes.filter((p) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      String(p.pid).includes(q) ||
      p.user.toLowerCase().includes(q) ||
      p.command.toLowerCase().includes(q) ||
      p.args.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-textPrimary flex items-center gap-2">
            <Cpu className="w-5 h-5 text-accent" />
            Linux Process Manager
          </h1>
          <p className="text-xs text-textMuted mt-0.5">
            Active processes running on {session.host} ({filtered.length} visible)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search filter */}
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-textMuted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter PID, user, command..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full bg-surface border border-border text-xs text-textPrimary pl-8 pr-7 py-1.5 rounded-lg focus:outline-none focus:border-accent"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-textMuted hover:text-textPrimary"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sort Switch */}
          <button
            onClick={() => setSortBy(sortBy === 'cpu' ? 'mem' : 'cpu')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface-2 border border-border rounded-lg text-xs text-textPrimary transition-all"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-accent" />
            <span>Sort: {sortBy === 'cpu' ? 'CPU %' : 'MEM %'}</span>
          </button>

          <button
            onClick={fetchProcesses}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-medium transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border border-border rounded-xl bg-surface">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-surface-2 text-textMuted border-b border-border sticky top-0 z-10 select-none">
            <tr>
              <th className="py-2.5 px-4 font-semibold">PID</th>
              <th className="py-2.5 px-3 font-semibold">User</th>
              <th className="py-2.5 px-3 font-semibold">CPU %</th>
              <th className="py-2.5 px-3 font-semibold">MEM %</th>
              <th className="py-2.5 px-3 font-semibold">State</th>
              <th className="py-2.5 px-3 font-semibold">Command / Arguments</th>
              <th className="py-2.5 px-4 font-semibold text-right">Signals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map((p) => (
              <tr key={p.pid} className="hover:bg-surface-2/60 transition-colors">
                <td className="py-2 px-4 font-mono font-semibold text-accent">{p.pid}</td>
                <td className="py-2 px-3 font-mono text-textMuted">{p.user}</td>
                <td className="py-2 px-3 font-mono">
                  <span
                    className={`px-1.5 py-0.5 rounded ${
                      p.cpu_pct > 50
                        ? 'bg-rose-500/20 text-rose-400 font-bold'
                        : p.cpu_pct > 15
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-textPrimary'
                    }`}
                  >
                    {p.cpu_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 px-3 font-mono">
                  <span
                    className={`px-1.5 py-0.5 rounded ${
                      p.mem_pct > 40 ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-textPrimary'
                    }`}
                  >
                    {p.mem_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 px-3 font-mono text-textMuted">{p.state}</td>
                <td className="py-2 px-3 font-mono max-w-md truncate text-textPrimary" title={p.args}>
                  <span className="font-semibold text-sky-400 mr-1.5">{p.command}</span>
                  <span className="text-textMuted text-[11px]">{p.args}</span>
                </td>
                <td className="py-2 px-4 text-right whitespace-nowrap space-x-1">
                  <button
                    onClick={() => setConfirmKill({ isOpen: true, proc: p, signal: 'TERM' })}
                    disabled={p.pid <= 1}
                    className="px-2 py-1 text-[11px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded disabled:opacity-30 transition-all"
                    title="Send SIGTERM (Graceful Stop)"
                  >
                    <Power className="w-3 h-3 inline mr-1" />
                    TERM
                  </button>
                  <button
                    onClick={() => setConfirmKill({ isOpen: true, proc: p, signal: 'KILL' })}
                    disabled={p.pid <= 1}
                    className="px-2 py-1 text-[11px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded disabled:opacity-30 transition-all"
                    title="Send SIGKILL (Force Kill)"
                  >
                    <Skull className="w-3 h-3 inline mr-1" />
                    KILL
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={confirmKill.isOpen}
        title={`Send SIG${confirmKill.signal}`}
        message={`Send SIG${confirmKill.signal} to process PID ${confirmKill.proc?.pid} (${confirmKill.proc?.command})?`}
        onConfirm={handleKillConfirm}
        onCancel={() => setConfirmKill({ isOpen: false, proc: null, signal: 'TERM' })}
      />
    </div>
  );
}

