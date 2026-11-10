import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Server,
  Network,
  RefreshCw,
  Clock,
  Globe,
  Pause,
  Play,
} from 'lucide-react';
import { api } from '../../utils/api';
import { formatBytes } from '../../utils/format';

export default function MonitorDashboard({ session, onToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchTelemetry = async (silent = false) => {
    if (!session?.session_id) return;
    if (!silent) setLoading(true);
    try {
      const res = await api.v3.getTelemetry(session.session_id);
      setData(res);
    } catch (err) {
      if (!silent) {
        onToast({
          type: 'error',
          title: 'Telemetry Error',
          message: err.message,
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, [session?.session_id]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchTelemetry(true);
    }, 3500);
    return () => clearInterval(interval);
  }, [autoRefresh, session?.session_id]);

  const ramPct = data?.ram_total_mb
    ? Math.round((data.ram_used_mb / data.ram_total_mb) * 100)
    : 0;
  const swapPct = data?.swap_total_mb
    ? Math.round((data.swap_used_mb / data.swap_total_mb) * 100)
    : 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-textPrimary flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            Server Telemetry & Monitoring
          </h1>
          <p className="text-xs text-textMuted mt-0.5">
            Real-time metrics streamed directly from /proc and sysinfo via SSH
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              autoRefresh
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-surface border-border text-textMuted hover:text-textPrimary'
            }`}
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoRefresh ? 'Live (3.5s)' : 'Paused'}</span>
          </button>

          <button
            onClick={() => fetchTelemetry(false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface-2 border border-border rounded-lg text-xs font-medium text-textPrimary transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {!data && loading ? (
        <div className="flex-1 flex items-center justify-center py-20 text-textMuted text-xs gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-accent" />
          <span>Gathering live hardware telemetry...</span>
        </div>
      ) : (
        data && (
          <>
            {/* Top Hardware Summary Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* CPU Card */}
              <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-textMuted flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-accent" />
                    CPU Utilization
                  </span>
                  <span className="text-[11px] font-mono bg-surface-2 px-2 py-0.5 rounded border border-border/50 text-textPrimary">
                    {data.cpu_cores} Cores
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold text-textPrimary font-mono">
                    {data.cpu_usage_pct?.toFixed(1)}%
                  </div>
                  <div className="w-full bg-surface-2 h-2 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        data.cpu_usage_pct > 85
                          ? 'bg-rose-500'
                          : data.cpu_usage_pct > 60
                          ? 'bg-amber-500'
                          : 'bg-accent'
                      }`}
                      style={{ width: `${Math.min(data.cpu_usage_pct || 0, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-textMuted font-mono">
                  Load: {data.load_average?.join(' • ')}
                </div>
              </div>

              {/* Memory Card */}
              <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-textMuted flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-emerald-400" />
                    RAM Memory
                  </span>
                  <span className="text-[11px] font-mono bg-surface-2 px-2 py-0.5 rounded border border-border/50 text-textPrimary">
                    {ramPct}% Used
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold text-textPrimary font-mono">
                    {(data.ram_used_mb / 1024).toFixed(2)} <span className="text-xs font-normal text-textMuted">/ {(data.ram_total_mb / 1024).toFixed(2)} GB</span>
                  </div>
                  <div className="w-full bg-surface-2 h-2 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        ramPct > 85 ? 'bg-rose-500' : ramPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(ramPct, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-textMuted font-mono">
                  Free: {data.ram_free_mb} MB • Swap: {data.swap_used_mb}/{data.swap_total_mb} MB ({swapPct}%)
                </div>
              </div>

              {/* System OS Card */}
              <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-textMuted flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-sky-400" />
                    System Identity
                  </span>
                  <span className="text-[11px] font-mono text-sky-400">{data.arch}</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-textPrimary truncate" title={data.hostname}>
                    {data.hostname || session.host}
                  </div>
                  <div className="text-xs text-textMuted truncate mt-0.5">{data.os}</div>
                </div>
                <div className="text-[11px] text-textMuted font-mono truncate">
                  Kernel: {data.kernel}
                </div>
              </div>

              {/* Uptime & IPs Card */}
              <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-textMuted flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-400" />
                    Uptime & Network
                  </span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-emerald-400 truncate">
                    {data.uptime || 'Running'}
                  </div>
                  <div className="text-[11px] text-textMuted mt-1 font-mono truncate" title={data.ip_addresses}>
                    IPs: {data.ip_addresses || session.host}
                  </div>
                </div>
                <div className="text-[11px] text-textMuted font-mono">
                  SSH Port: {session.port || 22}
                </div>
              </div>
            </div>

            {/* Disk Mounts & Network Interfaces */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Storage Volumes */}
              <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-textPrimary flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-amber-400" />
                  Storage Mounts
                </h3>
                <div className="space-y-3">
                  {(data.mounts || []).map((m, idx) => (
                    <div key={idx} className="space-y-1.5 bg-surface-2/50 p-3 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-textPrimary">
                          {m.mounted_on}{' '}
                          <span className="text-textMuted font-normal">({m.filesystem})</span>
                        </span>
                        <span className="font-mono text-textMuted">
                          <strong className="text-textPrimary">{m.used}</strong> / {m.total} ({m.percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-surface h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            m.percent >= 85
                              ? 'bg-rose-500'
                              : m.percent >= 70
                              ? 'bg-amber-500'
                              : 'bg-accent'
                          }`}
                          style={{ width: `${Math.min(m.percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {(!data.mounts || data.mounts.length === 0) && (
                    <p className="text-xs text-textMuted">No block disk mounts detected.</p>
                  )}
                </div>
              </div>

              {/* Network Interfaces */}
              <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-textPrimary flex items-center gap-2">
                  <Network className="w-4 h-4 text-sky-400" />
                  Network Interface Traffic (Cumulative)
                </h3>
                <div className="space-y-2">
                  {(data.network_ifaces || []).map((iface, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-surface-2/50 rounded-lg border border-border/50 text-xs"
                    >
                      <span className="font-mono font-semibold text-textPrimary">{iface.name}</span>
                      <div className="flex items-center gap-4 font-mono">
                        <span className="text-emerald-400">
                          ↓ RX: {formatBytes(iface.rx_bytes)}
                        </span>
                        <span className="text-sky-400">
                          ↑ TX: {formatBytes(iface.tx_bytes)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!data.network_ifaces || data.network_ifaces.length === 0) && (
                    <p className="text-xs text-textMuted">No external network interfaces detected.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}

