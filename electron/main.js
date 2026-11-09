const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, exec } = require('child_process');
const bcrypt = require('bcryptjs');

let mainWindow = null;
let backendProcess = null;
let backendToken = crypto.randomBytes(24).toString('hex');
let sessionMasterPassword = null;

// Lockout tracking (Main process enforced - cannot be bypassed by renderer)
let failedAttempts = 0;
let lockedUntil = 0;

const BACKEND_PORT = 48921;
const userDataPath = app.getPath('userData');
const authFilePath = path.join(userDataPath, 'auth.json');
const profilesEncPath = path.join(userDataPath, 'profiles.enc');
const logsDirPath = path.join(userDataPath, 'logs');

if (!fs.existsSync(logsDirPath)) {
  fs.mkdirSync(logsDirPath, { recursive: true });
}

// -------------------------------------------------------------
// AES-256-GCM Encryption / Decryption Utilities
// -------------------------------------------------------------
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

function encryptProfiles(profiles, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(profiles);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  });
}

function decryptProfiles(encryptedRaw, password) {
  try {
    const data = JSON.parse(encryptedRaw);
    const salt = Buffer.from(data.salt, 'hex');
    const iv = Buffer.from(data.iv, 'hex');
    const tag = Buffer.from(data.tag, 'hex');
    const ciphertext = Buffer.from(data.ciphertext, 'hex');

    const key = deriveKey(password, salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch (err) {
    throw new Error('Failed to decrypt profiles: invalid key or corrupted data');
  }
}

// -------------------------------------------------------------
// Backend Lifecycle Management
// -------------------------------------------------------------
function getBackendBinaryPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'skydeck-backend.exe');
  }
  return path.join(__dirname, 'bin', 'skydeck-backend.exe');
}

function startBackend() {
  const binaryPath = getBackendBinaryPath();
  console.log(`[Main] Launching backend from: ${binaryPath}`);

  if (!fs.existsSync(binaryPath)) {
    console.error(`[Main] Backend executable not found at: ${binaryPath}`);
    return;
  }

  const args = [
    `-port=${BACKEND_PORT}`,
    `-token=${backendToken}`,
    `-log-dir=${logsDirPath}`,
  ];

  backendProcess = spawn(binaryPath, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', (data) => {
    const out = data.toString().trim();
    console.log(`[Backend stdout] ${out}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend stderr] ${data.toString().trim()}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`[Backend] Process exited with code ${code}`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (backendProcess && backendProcess.pid) {
    console.log(`[Main] Terminating backend process PID ${backendProcess.pid}`);
    try {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${backendProcess.pid} /t /f`);
      } else {
        backendProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error(`[Main] Error stopping backend:`, e);
    }
    backendProcess = null;
  }
}

// -------------------------------------------------------------
// Window Creation
// -------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0a0c10',
    show: false,
    title: 'Skydeck — VPS File Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Determine frontend URL
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const distIndexPath = path.join(__dirname, '../frontend/dist/index.html');

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else if (fs.existsSync(distIndexPath)) {
    mainWindow.loadFile(distIndexPath);
  } else {
    // Attempt local Vite dev port or fallback to file
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow.loadFile(distIndexPath);
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------
// IPC Handlers
// -------------------------------------------------------------

// Master Password Auth Handlers
ipcMain.handle('auth:is-setup', async () => {
  return { isSetup: fs.existsSync(authFilePath) };
});

ipcMain.handle('auth:setup', async (event, { password }) => {
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long' };
  }

  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(password, salt);
  fs.writeFileSync(authFilePath, JSON.stringify({ hash }), 'utf8');

  sessionMasterPassword = password;
  failedAttempts = 0;
  lockedUntil = 0;
  return { success: true };
});

ipcMain.handle('auth:verify', async (event, { password }) => {
  const now = Date.now();
  if (now < lockedUntil) {
    const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
    return {
      success: false,
      locked: true,
      remainingSeconds,
      error: `Too many failed attempts. App is locked for ${remainingSeconds} seconds.`,
    };
  }

  if (!fs.existsSync(authFilePath)) {
    return { success: false, error: 'No master password set. Please configure password first.' };
  }

  let authData;
  try {
    authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
  } catch (err) {
    return { success: false, error: 'Auth storage corrupted.' };
  }

  const matches = bcrypt.compareSync(password, authData.hash);
  if (!matches) {
    failedAttempts += 1;
    if (failedAttempts >= 5) {
      lockedUntil = Date.now() + 30000; // 30 second lockout
      const remaining = 30;
      return {
        success: false,
        locked: true,
        remainingSeconds: remaining,
        attempts: failedAttempts,
        error: 'Too many incorrect attempts. App locked for 30 seconds.',
      };
    }
    return {
      success: false,
      locked: false,
      attempts: failedAttempts,
      error: `Incorrect password. Attempt ${failedAttempts} of 5.`,
    };
  }

  // Success
  failedAttempts = 0;
  lockedUntil = 0;
  sessionMasterPassword = password;
  return { success: true };
});

ipcMain.handle('auth:lock', async () => {
  sessionMasterPassword = null;
  return { success: true };
});

ipcMain.handle('auth:reset', async () => {
  try {
    if (fs.existsSync(authFilePath)) fs.unlinkSync(authFilePath);
    if (fs.existsSync(profilesEncPath)) fs.unlinkSync(profilesEncPath);
    sessionMasterPassword = null;
    failedAttempts = 0;
    lockedUntil = 0;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('auth:change-password', async (event, { currentPassword, newPassword }) => {
  if (!fs.existsSync(authFilePath)) {
    return { success: false, error: 'No master password currently set.' };
  }
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters.' };
  }

  let authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
  if (!bcrypt.compareSync(currentPassword, authData.hash)) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  // Re-encrypt profiles if profiles exist
  if (fs.existsSync(profilesEncPath)) {
    try {
      const rawEnc = fs.readFileSync(profilesEncPath, 'utf8');
      const profiles = decryptProfiles(rawEnc, currentPassword);
      const newEnc = encryptProfiles(profiles, newPassword);
      fs.writeFileSync(profilesEncPath, newEnc, 'utf8');
    } catch (e) {
      return { success: false, error: 'Failed to re-encrypt profiles with new password.' };
    }
  }

  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(newPassword, salt);
  fs.writeFileSync(authFilePath, JSON.stringify({ hash }), 'utf8');
  sessionMasterPassword = newPassword;

  return { success: true };
});

// Profile Storage Handlers (AES-256-GCM)
ipcMain.handle('profiles:list', async () => {
  if (!sessionMasterPassword) {
    return { success: false, error: 'App is locked. Unlock to access saved profiles.' };
  }

  if (!fs.existsSync(profilesEncPath)) {
    return { success: true, data: [] };
  }

  try {
    const raw = fs.readFileSync(profilesEncPath, 'utf8');
    const profiles = decryptProfiles(raw, sessionMasterPassword);
    return { success: true, data: profiles };
  } catch (err) {
    return { success: false, error: err.message, data: [] };
  }
});

ipcMain.handle('profiles:save', async (event, { profiles }) => {
  if (!sessionMasterPassword) {
    return { success: false, error: 'App is locked.' };
  }

  // Enforce security: passwords are NEVER saved in profiles
  const sanitizedProfiles = (profiles || []).map((p) => {
    const { password, ...safeFields } = p;
    return safeFields;
  });

  try {
    const encrypted = encryptProfiles(sanitizedProfiles, sessionMasterPassword);
    fs.writeFileSync(profilesEncPath, encrypted, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Dialog & Utility Handlers
ipcMain.handle('token:get', async () => {
  return { token: backendToken, port: BACKEND_PORT };
});

ipcMain.handle('dialog:select-key-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select SSH Private Key',
    properties: ['openFile'],
    filters: [
      { name: 'SSH Keys', extensions: ['pem', 'key', 'id_rsa', 'id_ed25519', '*'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, filePath: null };
  }
  return { canceled: false, filePath: result.filePaths[0] };
});

ipcMain.handle('dialog:save-file', async (event, { defaultFilename }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Downloaded File',
    defaultPath: defaultFilename || 'download',
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true, filePath: null };
  }
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('shell:open-logs', async () => {
  await shell.openPath(logsDirPath);
  return { success: true };
});

ipcMain.handle('app:get-info', async () => {
  return {
    name: 'Skydeck',
    version: '2.0.0',
    platform: process.platform,
    userData: userDataPath,
    logsDir: logsDirPath,
  };
});

ipcMain.handle('clipboard:write-text', async (event, { text }) => {
  clipboard.writeText(text || '');
  return { success: true };
});

// App Lifecycle
app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
