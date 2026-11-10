import React, { useState } from 'react';
import {
  Rocket,
  GitBranch,
  Play,
  FileText,
  Wifi,
  RefreshCw,
  Terminal,
  Globe,
} from 'lucide-react';
import { api } from '../../utils/api';

export default function DeployUtilities({ session, onToast }) {
  const [subTab, setSubTab] = useState('deploy'); // 'deploy' | 'logs' | 'network'

  // Deploy state
  const [repoPath, setRepoPath] = useState('/var/www');
  const [gitInfo, setGitInfo] = useState(null);
  const [deployCmd, setDeployCmd] = useState('git pull');
  const [deployOut, setDeployOut] = useState('');
  const [deployLoading, setDeployLoading] = useState(false);

  // Logs state
  const [logPath, setLogPath] = useState('/var/log/syslog');
  const [logContent, setLogContent] = useState('');
  const [logLoading, setLogLoading] = useState(false);

  // Network state
  const [netTool, setNetTool] = useState('ping');
  const [netTarget, setNetTarget] = useState('1.1.1.1');
  const [netOutput, setNetOutput] = useState('');
  const [netLoading, setNetLoading] = useState(false);

  const inspectGitRepo = async () => {
    if (!session?.session_id || !repoPath.trim()) return;
    setDeployLoading(true);
    try {
      const res = await api.v3.getGitStatus(session.session_id, repoPath.trim());
      setGitInfo(res);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Git Inspect Error',
        message: err.message,
      });
    } finally {
      setDeployLoading(false);
    }
  };

  const runDeployCommand = async (cmdOverride) => {
    const cmd = cmdOverride || deployCmd;
    if (!session?.session_id || !repoPath.trim() || !cmd.trim()) return;
    setDeployLoading(true);
    setDeployOut(`$ cd ${repoPath} && ${cmd}\nRunning...\n`);
    try {
      const res = await api.v3.deployExec(session.session_id, repoPath.trim(), cmd.trim());
      setDeployOut(
        `$ cd ${repoPath} && ${cmd}\n[Completed in ${res.duration_ms}ms | status: ${
          res.cmd_success !== false ? 'SUCCESS' : 'FAILED'
        }]\n\n${res.output || '(No output)'}`
      );
      inspectGitRepo();
    } catch (err) {
      setDeployOut(`Error: ${err.message}`);
    } finally {
      setDeployLoading(false);
    }
  };

  const fetchSystemLog = async (targetPath) => {
    const path = targetPath || logPath;
    if (!session?.session_id || !path.trim()) return;
    setLogPath(path);
    setLogLoading(true);
    try {
      const res = await api.v3.getSystemLog(session.session_id, path.trim(), 200);
      setLogContent(res.content || '(Empty or inaccessible log file)');
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Log Fetch Error',
        message: err.message,
      });
    } finally {
      setLogLoading(false);
    }
  };

  const runNetworkTest = async (e) => {
    if (e) e.preventDefault();
    if (!session?.session_id || !netTarget.trim()) return;
    setNetLoading(true);
    try {
      const res = await api.v3.runNetworkDiag(session.session_id, netTool, netTarget.trim());
      setNetOutput(res.output || '(No output)');
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Network Test Error',
        message: err.message,
      });
    } finally {
      setNetLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-textPrimary flex items-center gap-2">
            <Rocket className="w-5 h-5 text-amber-400" />
            Deployments, System Logs & Network Tools
          </h1>
          <p className="text-xs text-textMuted mt-0.5">
            Pull Git updates, trigger builds, inspect central Linux logs, and run server-side network diagnostics
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-border">
          <button
            onClick={() => setSubTab('deploy')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              subTab === 'deploy' ? 'bg-accent text-white' : 'text-textMuted hover:text-textPrimary'
            }`}
          >
            Git & Deploy
          </button>
          <button
            onClick={() => {
              setSubTab('logs');
              if (!logContent) fetchSystemLog();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              subTab === 'logs' ? 'bg-accent text-white' : 'text-textMuted hover:text-textPrimary'
            }`}
          >
            System Log Hub
          </button>
          <button
            onClick={() => setSubTab('network')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              subTab === 'network' ? 'bg-accent text-white' : 'text-textMuted hover:text-textPrimary'
            }`}
          >
            Network Diagnostics
          </button>
        </div>
      </div>

      {/* Tab 1: Git & Deploy */}
      {subTab === 'deploy' && (
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-wrap items-center gap-3 shrink-0">
            <span className="text-xs font-medium text-textMuted">App Directory:</span>
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/var/www/my-app"
              className="flex-1 min-w-[240px] bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-textPrimary focus:outline-none focus:border-accent"
            />
            <button
              onClick={inspectGitRepo}
              disabled={deployLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Inspect Git Repo
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Git Status & Quick Actions */}
            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col space-y-4 overflow-y-auto">
              {gitInfo ? (
                gitInfo.is_git ? (
                  <>
                    <div className="space-y-1.5 border-b border-border pb-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-textMuted">Branch:</span>
                        <span className="font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {gitInfo.branch || 'detached'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-textMuted">Remote:</span>
                        <span className="font-mono text-textPrimary truncate max-w-xs">{gitInfo.remote || 'none'}</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-semibold text-textMuted uppercase mb-2">Recent Commits</h4>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {(gitInfo.commits || []).map((c) => (
                          <div key={c.hash} className="p-2 bg-surface-2/60 rounded border border-border/50 text-xs">
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <span className="text-accent font-semibold">{c.hash}</span>
                              <span className="text-textMuted">{c.date} by {c.author}</span>
                            </div>
                            <p className="text-textPrimary truncate mt-0.5">{c.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-surface-2 rounded-lg text-xs text-textMuted">
                    Directory <code className="font-mono text-textPrimary">{gitInfo.path}</code> is not a Git repository, but you can still run build commands below.
                  </div>
                )
              ) : (
                <div className="text-xs text-textMuted text-center py-6">
                  Enter an application directory above and click "Inspect Git Repo" to view branch & commits.
                </div>
              )}

              {/* Build / Deploy Triggers */}
              <div className="pt-2 border-t border-border space-y-2.5">
                <h4 className="text-[11px] font-semibold text-textMuted uppercase">Deploy & Build Runner</h4>
                <div className="flex flex-wrap gap-1.5">
                  {['git pull', 'npm install && npm run build', 'go build -o app .', 'pm2 restart all'].map((cmd) => (
                    <button
                      key={cmd}
                      onClick={() => runDeployCommand(cmd)}
                      disabled={deployLoading}
                      className="px-2.5 py-1 bg-surface-2 hover:bg-border border border-border rounded text-[11px] font-mono text-sky-400"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={deployCmd}
                    onChange={(e) => setDeployCmd(e.target.value)}
                    placeholder="Custom command..."
                    className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-textPrimary focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => runDeployCommand()}
                    disabled={deployLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Run
                  </button>
                </div>
              </div>
            </div>

            {/* Output Terminal */}
            <div className="bg-[#0a0c10] border border-border rounded-xl flex flex-col overflow-hidden">
              <div className="px-4 py-2 bg-surface border-b border-border text-xs font-semibold text-textPrimary flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                Deployment Execution Output
              </div>
              <pre className="flex-1 p-4 overflow-auto font-mono text-xs text-emerald-400 whitespace-pre-wrap">
                {deployOut || 'Deployment stdout / stderr logs will appear here...'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: System Log Hub */}
      {subTab === 'logs' && (
        <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 bg-surface border border-border rounded-xl p-3 shrink-0">
            <span className="text-xs text-textMuted">Presets:</span>
            {[
              '/var/log/syslog',
              '/var/log/auth.log',
              '/var/log/nginx/error.log',
              '/var/log/nginx/access.log',
              '/var/log/dmesg',
            ].map((p) => (
              <button
                key={p}
                onClick={() => fetchSystemLog(p)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono border ${
                  logPath === p
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-surface-2 border-border text-textMuted hover:text-textPrimary'
                }`}
              >
                {p}
              </button>
            ))}

            <div className="flex items-center gap-2 ml-auto flex-1 max-w-sm">
              <input
                type="text"
                value={logPath}
                onChange={(e) => setLogPath(e.target.value)}
                className="flex-1 bg-surface-2 border border-border rounded px-2.5 py-1 text-xs font-mono text-textPrimary focus:outline-none focus:border-accent"
              />
              <button
                onClick={() => fetchSystemLog(logPath)}
                disabled={logLoading}
                className="p-1.5 bg-accent text-white rounded hover:bg-accent-hover"
                title="Refresh log"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${logLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <pre className="flex-1 overflow-auto bg-[#0a0c10] border border-border rounded-xl p-4 font-mono text-xs text-textPrimary whitespace-pre-wrap leading-relaxed">
            {logContent || 'Select a log path to view latest 200 lines...'}
          </pre>
        </div>
      )}

      {/* Tab 3: Network Diagnostics */}
      {subTab === 'network' && (
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          <form onSubmit={runNetworkTest} className="bg-surface border border-border rounded-xl p-4 flex flex-wrap items-center gap-3 shrink-0">
            <select
              value={netTool}
              onChange={(e) => setNetTool(e.target.value)}
              className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs text-textPrimary focus:outline-none"
            >
              <option value="ping">Ping (4 packets)</option>
              <option value="dig">DNS Lookup (dig)</option>
              <option value="curl">HTTP Headers (curl -I)</option>
              <option value="traceroute">Traceroute</option>
            </select>

            <input
              type="text"
              value={netTarget}
              onChange={(e) => setNetTarget(e.target.value)}
              placeholder="1.1.1.1 or https://google.com"
              className="flex-1 min-w-[240px] bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-textPrimary focus:outline-none focus:border-accent"
            />

            <button
              type="submit"
              disabled={netLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg"
            >
              {netLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              Run Diagnostic
            </button>
          </form>

          <pre className="flex-1 overflow-auto bg-[#0a0c10] border border-border rounded-xl p-4 font-mono text-xs text-sky-400 whitespace-pre-wrap">
            {netOutput || 'Run Ping, DNS, Traceroute, or Curl checks directly from your remote VPS...'}
          </pre>
        </div>
      )}
    </div>
  );
}
