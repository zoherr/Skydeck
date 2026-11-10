import React, { useState, useEffect } from 'react';
import LockScreen from './screens/LockScreen';
import SetPasswordScreen from './screens/SetPasswordScreen';
import ConnectScreen from './screens/ConnectScreen';
import FileManager from './screens/FileManager';
import MonitorDashboard from './screens/v3/MonitorDashboard';
import ProcessManager from './screens/v3/ProcessManager';
import DockerManager from './screens/v3/DockerManager';
import ServiceManager from './screens/v3/ServiceManager';
import DatabaseExplorer from './screens/v3/DatabaseExplorer';
import SecurityCenter from './screens/v3/SecurityCenter';
import DeployUtilities from './screens/v3/DeployUtilities';
import SettingsModal from './screens/SettingsModal';
import Sidebar from './components/Sidebar';
import TerminalPanel from './components/TerminalPanel';
import Toast from './components/Toast';
import { auth } from './utils/auth';
import { profiles } from './utils/profiles';
import { api } from './utils/api';
import {
  FolderOpen,
  Activity,
  Cpu,
  Container,
  Cog,
  Database,
  Rocket,
  Shield,
  Terminal as TerminalIcon,
} from 'lucide-react';

export default function App() {
  const [authState, setAuthState] = useState('checking'); // 'checking' | 'need_setup' | 'locked' | 'unlocked'
  const [activeSession, setActiveSession] = useState(null);
  const [savedProfiles, setSavedProfiles] = useState([]);
  const [currentView, setCurrentView] = useState('connect'); // 'connect' | 'manager'
  const [selectedProfileForConnect, setSelectedProfileForConnect] = useState(null);
  const [navTarget, setNavTarget] = useState(null);

  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDiskUsageOpen, setIsDiskUsageOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [containerShellRequest, setContainerShellRequest] = useState(null);
  const [toast, setToast] = useState(null);

  // Global Ctrl+` shortcut for persistent SSH Terminal Drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeSession && e.ctrlKey && (e.key === '`' || e.key === '~')) {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSession]);

  const handleOpenContainerShell = (id, name) => {
    setIsTerminalOpen(true);
    setContainerShellRequest({ id, name, ts: Date.now() });
  };

  // Bookmarks
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const stored = localStorage.getItem('skydeck:bookmarks');
      return stored ? JSON.parse(stored) : ['/var/www', '/etc', '/var/log'];
    } catch {
      return ['/var/www', '/etc', '/var/log'];
    }
  });

  const handleAddBookmark = (path) => {
    if (!bookmarks.includes(path)) {
      const updated = [...bookmarks, path];
      setBookmarks(updated);
      localStorage.setItem('skydeck:bookmarks', JSON.stringify(updated));
      setToast({
        type: 'success',
        title: 'Bookmark added',
        message: `Saved ${path} to bookmarks`,
      });
    } else {
      setToast({
        type: 'info',
        title: 'Already bookmarked',
        message: `${path} is already in your bookmarks`,
      });
    }
  };

  const handleRemoveBookmark = (path) => {
    const updated = bookmarks.filter((b) => b !== path);
    setBookmarks(updated);
    localStorage.setItem('skydeck:bookmarks', JSON.stringify(updated));
    setToast({
      type: 'info',
      title: 'Bookmark removed',
      message: `Removed ${path} from bookmarks`,
    });
  };

  // Check initial master password configuration
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await auth.isSetup();
        if (!res.isSetup) {
          setAuthState('need_setup');
        } else {
          setAuthState('locked');
        }
      } catch (err) {
        console.error('Failed to check auth status:', err);
        setAuthState('need_setup');
      }
    }
    checkAuth();
  }, []);

  // Load profiles after unlocking
  const loadSavedProfiles = async () => {
    try {
      const list = await profiles.list();
      setSavedProfiles(list || []);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
  };

  const handleUnlocked = async () => {
    setAuthState('unlocked');
    await loadSavedProfiles();
  };

  const handlePasswordSet = async () => {
    setAuthState('unlocked');
    await loadSavedProfiles();
    setToast({
      type: 'success',
      title: 'Setup Complete',
      message: 'Master password configured. Welcome to Skydeck!',
    });
  };

  const handleLockApp = async () => {
    await auth.lock();
    setActiveSession(null);
    setCurrentView('connect');
    setAuthState('locked');
  };

  const handleResetApp = () => {
    setActiveSession(null);
    setSavedProfiles([]);
    setCurrentView('connect');
    setAuthState('need_setup');
  };

  // Connect to VPS
  const handleConnect = async (payload) => {
    setConnectLoading(true);
    setConnectError('');

    try {
      const data = await api.connect(payload);
      const sessionObj = {
        session_id: data.session_id,
        host: data.host,
        port: data.port,
        username: data.username,
        initial_path: data.initial_path || '/',
      };

      setActiveSession(sessionObj);
      setNavTarget(null);
      setCurrentView('manager');

      // Save profile if requested
      if (payload.save_profile) {
        const newProfile = {
          id: `${payload.host}_${payload.username}_${payload.port}`,
          name: payload.profile_name || payload.host,
          host: payload.host,
          port: payload.port,
          username: payload.username,
          auth_type: payload.auth_type,
          key_path: payload.key_path,
        };

        const existingIndex = savedProfiles.findIndex(
          (p) => p.host === newProfile.host && p.username === newProfile.username && p.port === newProfile.port
        );

        let updated;
        if (existingIndex >= 0) {
          updated = [...savedProfiles];
          updated[existingIndex] = newProfile;
        } else {
          updated = [...savedProfiles, newProfile];
        }

        await profiles.save(updated);
        setSavedProfiles(updated);
      }

      setToast({
        type: 'success',
        title: 'Connected',
        message: `Connected to ${payload.username}@${payload.host}`,
      });
    } catch (err) {
      setConnectError(err.message);
    } finally {
      setConnectLoading(false);
    }
  };

  // Disconnect from VPS
  const handleDisconnect = async () => {
    if (activeSession) {
      try {
        await api.disconnect(activeSession.session_id);
      } catch (e) {
        console.error('Error disconnecting:', e);
      }
    }
    setActiveSession(null);
    setNavTarget(null);
    setCurrentView('connect');
    setToast({
      type: 'info',
      title: 'Disconnected',
      message: 'Session closed.',
    });
  };

  // Delete saved profile
  const handleDeleteProfile = async (profile) => {
    const updated = savedProfiles.filter(
      (p) => !(p.host === profile.host && p.username === profile.username && p.port === profile.port)
    );
    await profiles.save(updated);
    setSavedProfiles(updated);
    setToast({
      type: 'info',
      title: 'Profile Removed',
      message: `Deleted server profile "${profile.name || profile.host}"`,
    });
  };

  // Session health ping
  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(async () => {
      try {
        await api.ping(activeSession.session_id);
      } catch (e) {
        console.warn('Session ping failed:', e);
      }
    }, 45000);
    return () => clearInterval(interval);
  }, [activeSession]);

  if (authState === 'checking') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-textMuted">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authState === 'need_setup') {
    return <SetPasswordScreen onPasswordSet={handlePasswordSet} />;
  }

  if (authState === 'locked') {
    return <LockScreen onUnlocked={handleUnlocked} onResetApp={handleResetApp} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Left Sidebar */}
      <Sidebar
        activeSession={activeSession}
        savedProfiles={savedProfiles}
        onDisconnect={handleDisconnect}
        onNavigate={(path) => {
          setNavTarget(path);
          setCurrentView('manager');
        }}
        onConnectProfile={(profile) => {
          setSelectedProfileForConnect(profile);
          setCurrentView('connect');
        }}
        onNewConnection={() => {
          setSelectedProfileForConnect(null);
          setCurrentView('connect');
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLockApp={handleLockApp}
        onDeleteProfile={handleDeleteProfile}
        bookmarks={bookmarks}
        onRemoveBookmark={handleRemoveBookmark}
        onOpenDiskUsage={() => setIsDiskUsageOpen(true)}
      />

      {/* Main Screen Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {currentView === 'connect' || !activeSession ? (
          <ConnectScreen
            initialProfile={selectedProfileForConnect}
            onConnect={handleConnect}
            loading={connectLoading}
            error={connectError}
            savedProfiles={savedProfiles}
          />
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* v3.0.0 Platform Workspace Mode Switcher */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-[#0f1117] border-b border-border select-none shrink-0 gap-2 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1">
                {[
                  { id: 'manager', label: 'Files', icon: FolderOpen, color: 'text-accent' },
                  { id: 'monitor', label: 'Monitor', icon: Activity, color: 'text-emerald-400' },
                  { id: 'processes', label: 'Processes', icon: Cpu, color: 'text-sky-400' },
                  { id: 'docker', label: 'Docker', icon: Container, color: 'text-sky-400' },
                  { id: 'services', label: 'Services & Cron', icon: Cog, color: 'text-purple-400' },
                  { id: 'database', label: 'Databases', icon: Database, color: 'text-emerald-400' },
                  { id: 'deploy', label: 'Deploy & Logs', icon: Rocket, color: 'text-amber-400' },
                  { id: 'security', label: 'Security', icon: Shield, color: 'text-rose-400' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentView(item.id)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-surface-2 text-textPrimary border border-border shadow-sm'
                          : 'text-textMuted hover:text-textPrimary hover:bg-surface/60'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? item.color : ''}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Persistent SSH Terminal Toggle */}
              <button
                onClick={() => setIsTerminalOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                  isTerminalOpen
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-surface border-border text-textMuted hover:text-textPrimary'
                }`}
                title="Toggle Persistent SSH Shell (Ctrl+`)"
              >
                <TerminalIcon className="w-3.5 h-3.5" />
                <span>Shell</span>
              </button>
            </div>

            {/* Active Platform View */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {currentView === 'manager' && (
                <FileManager
                  activeSession={activeSession}
                  navTarget={navTarget}
                  onToast={setToast}
                  bookmarks={bookmarks}
                  onBookmark={handleAddBookmark}
                  isDiskUsageOpen={isDiskUsageOpen}
                  setIsDiskUsageOpen={setIsDiskUsageOpen}
                  isTerminalOpen={isTerminalOpen}
                  onToggleTerminal={() => setIsTerminalOpen((prev) => !prev)}
                />
              )}
              {currentView === 'monitor' && (
                <MonitorDashboard session={activeSession} onToast={setToast} />
              )}
              {currentView === 'processes' && (
                <ProcessManager session={activeSession} onToast={setToast} />
              )}
              {currentView === 'docker' && (
                <DockerManager
                  session={activeSession}
                  onToast={setToast}
                  onOpenContainerShell={handleOpenContainerShell}
                />
              )}
              {currentView === 'services' && (
                <ServiceManager session={activeSession} onToast={setToast} />
              )}
              {currentView === 'database' && (
                <DatabaseExplorer session={activeSession} onToast={setToast} />
              )}
              {currentView === 'deploy' && (
                <DeployUtilities session={activeSession} onToast={setToast} />
              )}
              {currentView === 'security' && (
                <SecurityCenter session={activeSession} onToast={setToast} />
              )}
            </div>

            {/* Persistent Global SSH Terminal Drawer (available on all v3 views) */}
            <TerminalPanel
              session={activeSession}
              isOpen={isTerminalOpen}
              onClose={() => setIsTerminalOpen(false)}
              containerShellRequest={containerShellRequest}
            />
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          loadSavedProfiles();
        }}
        onResetApp={handleResetApp}
        onToast={setToast}
      />

      {/* Toast notifications */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
