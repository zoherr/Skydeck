import React, { useState } from 'react';
import {
  Database,
  Play,
  Terminal,
  Table,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../utils/api';

export default function DatabaseExplorer({ session, onToast }) {
  const [engine, setEngine] = useState('mysql'); // mysql, postgres, sqlite, redis
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('3306');
  const [user, setUser] = useState('root');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [query, setQuery] = useState('SHOW DATABASES;');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'raw'

  const handleEngineChange = (newEngine) => {
    setEngine(newEngine);
    setResult(null);
    if (newEngine === 'mysql') {
      setPort('3306');
      setUser('root');
      setQuery('SHOW DATABASES;');
    } else if (newEngine === 'postgres') {
      setPort('5432');
      setUser('postgres');
      setDatabase('postgres');
      setQuery('\\l');
    } else if (newEngine === 'sqlite') {
      setPort('');
      setUser('');
      setDatabase('/var/www/app/database.sqlite');
      setQuery("SELECT name FROM sqlite_master WHERE type='table';");
    } else if (newEngine === 'redis') {
      setPort('6379');
      setUser('');
      setDatabase('');
      setQuery('KEYS *');
    }
  };

  const handleRunQuery = async (e) => {
    if (e) e.preventDefault();
    if (!session?.session_id || !query.trim()) return;

    setLoading(true);
    try {
      const res = await api.v3.databaseQuery({
        session_id: session.session_id,
        engine,
        host,
        port,
        user,
        password,
        database,
        query: query.trim(),
      });
      setResult(res);
      if (res.columns && res.columns.length > 0) {
        setViewMode('table');
      } else {
        setViewMode('raw');
      }
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Query Error',
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const presets = {
    mysql: ['SHOW DATABASES;', 'SHOW TABLES;', 'SHOW PROCESSLIST;', 'SELECT VERSION();'],
    postgres: ['\\l', '\\dt', 'SELECT version();', 'SELECT * FROM pg_stat_activity;'],
    sqlite: ["SELECT name FROM sqlite_master WHERE type='table';", 'PRAGMA database_list;'],
    redis: ['PING', 'KEYS *', 'DBSIZE', 'INFO server'],
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-textPrimary flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            Database Explorer & Query Runner
          </h1>
          <p className="text-xs text-textMuted mt-0.5">
            Run queries against MySQL, PostgreSQL, SQLite, or Redis on your VPS over secure SSH without opening DB ports
          </p>
        </div>

        {/* Engine Switcher */}
        <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-border">
          {[
            { id: 'mysql', label: 'MySQL / MariaDB' },
            { id: 'postgres', label: 'PostgreSQL' },
            { id: 'sqlite', label: 'SQLite' },
            { id: 'redis', label: 'Redis' },
          ].map((eng) => (
            <button
              key={eng.id}
              onClick={() => handleEngineChange(eng.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                engine === eng.id
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-textMuted hover:text-textPrimary'
              }`}
            >
              {eng.label}
            </button>
          ))}
        </div>
      </div>

      {/* Connection Credentials Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 bg-surface border border-border rounded-xl p-3 text-xs shrink-0">
        {engine !== 'sqlite' && (
          <>
            <div>
              <label className="text-[10px] text-textMuted uppercase font-semibold">Host</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full mt-1 bg-surface-2 border border-border rounded px-2.5 py-1 text-textPrimary font-mono focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[10px] text-textMuted uppercase font-semibold">Port</label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full mt-1 bg-surface-2 border border-border rounded px-2.5 py-1 text-textPrimary font-mono focus:outline-none focus:border-accent"
              />
            </div>
          </>
        )}

        {(engine === 'mysql' || engine === 'postgres') && (
          <div>
            <label className="text-[10px] text-textMuted uppercase font-semibold">Username</label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full mt-1 bg-surface-2 border border-border rounded px-2.5 py-1 text-textPrimary font-mono focus:outline-none focus:border-accent"
            />
          </div>
        )}

        {engine !== 'sqlite' && (
          <div>
            <label className="text-[10px] text-textMuted uppercase font-semibold">Password (Optional)</label>
            <input
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 bg-surface-2 border border-border rounded px-2.5 py-1 text-textPrimary font-mono focus:outline-none focus:border-accent"
            />
          </div>
        )}

        <div className={engine === 'sqlite' ? 'col-span-5' : ''}>
          <label className="text-[10px] text-textMuted uppercase font-semibold">
            {engine === 'sqlite' ? 'Remote SQLite File Path' : 'Database Name'}
          </label>
          <input
            type="text"
            placeholder={engine === 'sqlite' ? '/var/www/data.db' : 'app_db'}
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            className="w-full mt-1 bg-surface-2 border border-border rounded px-2.5 py-1 text-textPrimary font-mono focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Query Editor */}
      <form onSubmit={handleRunQuery} className="bg-surface border border-border rounded-xl p-3 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-textMuted mr-1">Quick Presets:</span>
            {presets[engine].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuery(q)}
                className="px-2 py-0.5 bg-surface-2 hover:bg-border text-[11px] font-mono text-sky-400 rounded border border-border/60 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg shadow-sm disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Execute Query</span>
          </button>
        </div>

        <textarea
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === 'Enter') {
              handleRunQuery();
            }
          }}
          placeholder="Enter SQL query or Redis command... (Ctrl+Enter to run)"
          className="w-full bg-[#0a0c10] border border-border rounded-lg p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:border-accent resize-none"
        />
      </form>

      {/* Output Area */}
      <div className="flex-1 flex flex-col border border-border rounded-xl bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-surface-2 border-b border-border text-xs shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-textPrimary">Query Results</span>
            {result && (
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    result.query_success !== false
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {result.query_success !== false ? 'OK' : 'ERROR'}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                  <Clock className="w-3 h-3" />
                  {result.duration_ms} ms
                </span>
              </div>
            )}
          </div>

          {result && (
            <div className="flex items-center gap-1">
              {result.columns?.length > 0 && (
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] ${
                    viewMode === 'table'
                      ? 'bg-accent text-white'
                      : 'text-textMuted hover:text-textPrimary'
                  }`}
                >
                  <Table className="w-3 h-3" />
                  Table
                </button>
              )}
              <button
                onClick={() => setViewMode('raw')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] ${
                  viewMode === 'raw'
                    ? 'bg-accent text-white'
                    : 'text-textMuted hover:text-textPrimary'
                }`}
              >
                <Terminal className="w-3 h-3" />
                Raw Output
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-3">
          {!result ? (
            <div className="h-full flex items-center justify-center text-xs text-textMuted">
              Execute a query above to inspect remote database records.
            </div>
          ) : viewMode === 'table' && result.columns?.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead className="bg-surface-2 text-textMuted border-b border-border">
                <tr>
                  {result.columns.map((col, idx) => (
                    <th key={idx} className="py-2 px-3 font-semibold border-r border-border/30 last:border-r-0">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(result.rows || []).map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-surface-2/60">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 text-textPrimary border-r border-border/20 last:border-r-0">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre className="text-xs font-mono text-textPrimary whitespace-pre-wrap p-2">
              {result.raw_output || '(Empty response)'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
