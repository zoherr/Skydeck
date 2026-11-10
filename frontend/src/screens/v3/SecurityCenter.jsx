import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Plus,
  Trash2,
  Radio,
  Users,
  Lock,
} from 'lucide-react';
import { api } from '../../utils/api';

export default function SecurityCenter({ session, onToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portInput, setPortInput] = useState('');
  const [ruleAction, setRuleAction] = useState('allow'); // 'allow' | 'deny'

  const fetchSecurity = async () => {
    if (!session?.session_id) return;
    setLoading(true);
    try {
      const res = await api.v3.getSecurityOverview(session.session_id);
      setData(res);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Security Audit Error',
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurity();
  }, [session?.session_id]);

  const handleUFW = async (action, target = '') => {
    try {
      const res = await api.v3.ufwAction(session.session_id, action, target);
      onToast({
        type: 'success',
        title: 'Firewall Updated',
        message: res.message || `UFW ${action} applied.`,
      });
      setPortInput('');
      fetchSecurity();
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Firewall Action Failed',
        message: err.message,
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-textPrimary flex items-center gap-2">
            <Shield className="w-5 h-5 text-rose-400" />
            Security Center & Server Auditing
          </h1>
          <p className="text-xs text-textMuted mt-0.5">
            Monitor UFW firewall rules, inspect open listening ports, and review SSH authentication attempts
          </p>
        </div>

        <button
          onClick={fetchSecurity}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-medium transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Run Audit</span>
        </button>
      </div>

      {!data && loading ? (
        <div className="flex-1 flex items-center justify-center py-20 text-textMuted text-xs gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-accent" />
          <span>Auditing firewall, ports, and auth logs...</span>
        </div>
      ) : (
        data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* UFW Firewall Panel */}
            <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {data.ufw_active ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-textPrimary">UFW Firewall</h3>
                    <span
                      className={`text-[11px] font-mono ${
                        data.ufw_active ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {data.ufw_available
                        ? data.ufw_active
                          ? 'ACTIVE & ENFORCING'
                          : 'INACTIVE'
                        : 'UFW Not Installed'}
                    </span>
                  </div>
                </div>

                {data.ufw_available && (
                  <button
                    onClick={() => handleUFW(data.ufw_active ? 'disable' : 'enable')}
                    className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                      data.ufw_active
                        ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {data.ufw_active ? 'Disable Firewall' : 'Enable Firewall'}
                  </button>
                )}
              </div>

              {data.ufw_available && (
                <>
                  {/* Add Rule Bar */}
                  <div className="flex items-center gap-2">
                    <select
                      value={ruleAction}
                      onChange={(e) => setRuleAction(e.target.value)}
                      className="bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs text-textPrimary focus:outline-none"
                    >
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Port/proto e.g. 443/tcp or 8080"
                      value={portInput}
                      onChange={(e) => setPortInput(e.target.value)}
                      className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-textPrimary focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => handleUFW(ruleAction, portInput.trim())}
                      disabled={!portInput.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>

                  {/* Active Rules List */}
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {(data.ufw_rules || []).map((r) => (
                      <div
                        key={r.number}
                        className="flex items-center justify-between px-3 py-2 bg-surface-2/60 rounded-lg border border-border/50 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-textMuted">[{r.number}]</span>
                          <span className="font-semibold text-textPrimary">{r.to}</span>
                          <span
                            className={`text-[11px] px-1.5 py-0.2 rounded ${
                              r.action.includes('ALLOW')
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {r.action}
                          </span>
                          <span className="text-textMuted truncate">{r.from}</span>
                        </div>
                        <button
                          onClick={() => handleUFW('delete', r.number)}
                          className="p-1 text-textMuted hover:text-rose-400 rounded"
                          title="Delete firewall rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {(!data.ufw_rules || data.ufw_rules.length === 0) && (
                      <p className="text-xs text-textMuted py-3 text-center">No UFW rules configured.</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Open Listening Ports Panel */}
            <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-textPrimary flex items-center gap-2">
                  <Radio className="w-4 h-4 text-sky-400" />
                  Listening Network Ports (`ss -tulpn`)
                </h3>
                <span className="text-[11px] font-mono text-textMuted">
                  {(data.listening_ports || []).length} open listeners
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto border border-border/60 rounded-lg">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-surface-2 text-textMuted border-b border-border sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Proto</th>
                      <th className="py-2 px-3">Local Address</th>
                      <th className="py-2 px-3">Process</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {(data.listening_ports || []).map((p, idx) => (
                      <tr key={idx} className="hover:bg-surface-2/40">
                        <td className="py-1.5 px-3 text-accent uppercase">{p.proto}</td>
                        <td className="py-1.5 px-3 text-textPrimary">{p.local}</td>
                        <td className="py-1.5 px-3 text-textMuted truncate max-w-[180px]" title={p.process}>
                          {p.process || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SSH Auth Audit Logs */}
            <div className="bg-surface border border-border rounded-xl p-5 space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-textPrimary flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Recent SSH Authentication Audit
                </h3>
                {data.failed_ssh_count > 0 && (
                  <span className="px-2.5 py-0.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[11px] font-semibold rounded-full">
                    ⚠ {data.failed_ssh_count} Failed / Brute-force Attempts Detected
                  </span>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto bg-[#0a0c10] border border-border rounded-lg p-3 space-y-1 font-mono text-[11px]">
                {(data.auth_logs || []).map((entry, idx) => (
                  <div
                    key={idx}
                    className={`px-2 py-1 rounded ${
                      entry.status === 'accepted'
                        ? 'text-emerald-400 bg-emerald-500/5'
                        : entry.status === 'failed'
                        ? 'text-rose-400 bg-rose-500/10'
                        : 'text-textMuted'
                    }`}
                  >
                    {entry.line}
                  </div>
                ))}
                {(!data.auth_logs || data.auth_logs.length === 0) && (
                  <p className="text-textMuted text-center py-4">No recent SSH auth log entries available.</p>
                )}
              </div>
            </div>

            {/* Interactive Linux Accounts */}
            <div className="bg-surface border border-border rounded-xl p-5 space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-textPrimary flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  Shell-Enabled System Users
                </h3>
                {data.active_sessions && (
                  <span className="text-xs font-mono text-emerald-400">
                    Active Sessions: {data.active_sessions.split('\n').length}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {(data.users || []).map((u) => (
                  <div
                    key={u.username}
                    className="p-2.5 bg-surface-2/60 border border-border/50 rounded-lg text-xs font-mono flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-textPrimary">{u.username}</div>
                      <div className="text-[11px] text-textMuted">{u.home}</div>
                    </div>
                    <div className="text-right text-[11px]">
                      <div className="text-accent">UID: {u.uid}</div>
                      <div className="text-textMuted">{u.shell}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

