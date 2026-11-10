import React from 'react';
import {
  Server,
  LogOut,
  Settings,
  Lock,
  Plus,
  Trash2,
  HardDrive,
  Home,
  Globe,
  Sliders,
  FileText,
  Folder,
  ChevronRight,
  Bookmark,
  Activity,
} from 'lucide-react';

export default function Sidebar({
  activeSession,
  savedProfiles,
  onDisconnect,
  onConnectProfile,
  onNewConnection,
  onOpenSettings,
  onLockApp,
  onDeleteProfile,
  onNavigate,
  bookmarks = [],
  onRemoveBookmark,
  onOpenDiskUsage,
}) {
  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col h-full select-none shrink-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-card bg-accent flex items-center justify-center text-white shadow-md shadow-accent/20">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-textPrimary leading-none">
              Skydeck
            </div>
            <div className="text-[10px] text-accent font-mono leading-none mt-1">
              v3.0.0 • VPS Platform
            </div>
          </div>
        </div>

        <button
          onClick={onNewConnection}
          className="p-1.5 text-textMuted hover:text-textPrimary hover:bg-surface-2 rounded-btn transition-hover"
          title="New Connection"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Active Connection Status Card */}
      {activeSession ? (
        <div className="p-3 border-b border-border bg-surface-2/40">
          <div className="text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Connected Server</span>
            <span className="flex items-center gap-1.5 text-[11px] text-success font-medium lowercase">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              active
            </span>
          </div>

          <div className="bg-surface border border-border/60 rounded-card p-3">
            <div className="text-xs font-semibold text-textPrimary truncate">
              {activeSession.host}
            </div>
            <div className="text-[11px] text-textMuted truncate mt-0.5 font-mono">
              {activeSession.username} : {activeSession.port || 22}
            </div>

            <button
              onClick={onDisconnect}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-error hover:bg-error/10 border border-error/20 rounded-btn transition-hover"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 border-b border-border">
          <button
            onClick={onNewConnection}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-btn transition-hover shadow-sm"
          >
            <Server className="w-3.5 h-3.5" />
            <span>Connect to Server</span>
          </button>
        </div>
      )}

      {/* Quick Locations (When Connected) */}
      {activeSession && onNavigate && (
        <div className="p-3 border-b border-border bg-surface/30">
          <div className="flex items-center justify-between text-[10px] font-semibold text-textMuted uppercase tracking-wider mb-2 px-1">
            <span>Quick Locations</span>
            {onOpenDiskUsage && (
              <button
                onClick={onOpenDiskUsage}
                className="text-[10px] text-accent hover:underline lowercase font-normal flex items-center gap-1"
                title="Open Disk Usage Analyzer"
              >
                <Activity className="w-3 h-3" />
                <span>storage</span>
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <button
              onClick={() => onNavigate('/')}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-btn hover:bg-surface-2 text-textPrimary text-left transition-hover border border-transparent hover:border-border/50"
              title="Go to Root Directory (/)"
            >
              <HardDrive className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="truncate font-medium">Root (/)</span>
            </button>
            <button
              onClick={() => onNavigate(activeSession.initial_path || '/root')}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-btn hover:bg-surface-2 text-textPrimary text-left transition-hover border border-transparent hover:border-border/50"
              title="Go to User Home (~)"
            >
              <Home className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate font-medium">Home (~)</span>
            </button>
            <button
              onClick={() => onNavigate('/var/www')}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-btn hover:bg-surface-2 text-textPrimary text-left transition-hover border border-transparent hover:border-border/50"
              title="Go to /var/www"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate font-medium">/var/www</span>
            </button>
            <button
              onClick={() => onNavigate('/etc')}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-btn hover:bg-surface-2 text-textPrimary text-left transition-hover border border-transparent hover:border-border/50"
              title="Go to /etc"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate font-medium">/etc</span>
            </button>
            <button
              onClick={() => onNavigate('/var/log')}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-btn hover:bg-surface-2 text-textPrimary text-left transition-hover border border-transparent hover:border-border/50"
              title="Go to /var/log"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate font-medium">/var/log</span>
            </button>
            <button
              onClick={() => onNavigate('/tmp')}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-btn hover:bg-surface-2 text-textPrimary text-left transition-hover border border-transparent hover:border-border/50"
              title="Go to /tmp"
            >
              <Folder className="w-3.5 h-3.5 text-textMuted shrink-0" />
              <span className="truncate font-medium">/tmp</span>
            </button>
          </div>

          {/* Bookmarks */}
          {bookmarks.length > 0 && (
            <div className="mt-3 pt-2 border-t border-border/50">
              <div className="text-[10px] font-semibold text-textMuted uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1">
                <Bookmark className="w-3 h-3 text-amber-400" />
                <span>Bookmarks</span>
              </div>
              <div className="space-y-1">
                {bookmarks.map((bm, idx) => (
                  <div
                    key={idx}
                    className="group flex items-center justify-between px-2 py-1 rounded hover:bg-surface-2 cursor-pointer text-xs"
                    onClick={() => onNavigate(bm)}
                  >
                    <span className="truncate font-mono text-textPrimary/90 max-w-[170px]">{bm}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveBookmark(bm);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-textMuted hover:text-rose-400"
                      title="Remove bookmark"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saved Profiles Section */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-2 px-1">
          <span>Saved Servers ({savedProfiles.length})</span>
        </div>

        {savedProfiles.length === 0 ? (
          <div className="text-center py-6 px-2 text-textMuted">
            <p className="text-xs">No saved servers yet</p>
            <p className="text-[11px] text-textMuted/70 mt-1">
              Check "Save Profile" when connecting to save host credentials.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {savedProfiles.map((profile) => {
              const isCurrent =
                activeSession &&
                activeSession.host === profile.host &&
                activeSession.username === profile.username;

              return (
                <div
                  key={profile.id || profile.host + profile.username}
                  className={`group flex items-center justify-between p-2 rounded-card text-xs cursor-pointer border transition-hover ${
                    isCurrent
                      ? 'bg-accent/10 border-accent/40 text-textPrimary'
                      : 'border-transparent hover:bg-surface-2 hover:border-border/60 text-textPrimary/80'
                  }`}
                  onClick={() => onConnectProfile(profile)}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-medium truncate text-textPrimary">
                      {profile.name || profile.host}
                    </div>
                    <div className="text-[11px] text-textMuted truncate font-mono">
                      {profile.username}@{profile.host}:{profile.port || 22}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-hover">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProfile(profile);
                      }}
                      className="p-1 text-textMuted hover:text-error rounded hover:bg-surface"
                      title="Delete saved server"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-textMuted" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Toolbar: Settings & Lock */}
      <div className="p-3 border-t border-border bg-surface-2/30 flex items-center justify-between">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 text-xs text-textMuted hover:text-textPrimary px-2 py-1.5 rounded-btn hover:bg-surface-2 transition-hover"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>

        <button
          onClick={onLockApp}
          className="flex items-center gap-1.5 text-xs text-textMuted hover:text-warning px-2 py-1.5 rounded-btn hover:bg-surface-2 transition-hover"
          title="Lock App"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Lock</span>
        </button>
      </div>
    </aside>
  );
}
