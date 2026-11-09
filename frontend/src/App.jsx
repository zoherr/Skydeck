import React, { useState, useEffect } from 'react';
import LockScreen from './screens/LockScreen';
import SetPasswordScreen from './screens/SetPasswordScreen';
import ConnectScreen from './screens/ConnectScreen';
import FileManager from './screens/FileManager';
import SettingsModal from './screens/SettingsModal';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import { auth } from './utils/auth';
import { profiles } from './utils/profiles';
import { api } from './utils/api';

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
  const [toast, setToast] = useState(null);

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
          <FileManager
            activeSession={activeSession}
            navTarget={navTarget}
            onToast={setToast}
          />
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
