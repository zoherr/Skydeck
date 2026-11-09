const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skydeck', {
  auth: {
    isSetup: () => ipcRenderer.invoke('auth:is-setup'),
    setup: (password) => ipcRenderer.invoke('auth:setup', { password }),
    verify: (password) => ipcRenderer.invoke('auth:verify', { password }),
    reset: () => ipcRenderer.invoke('auth:reset'),
    changePassword: (currentPassword, newPassword) =>
      ipcRenderer.invoke('auth:change-password', { currentPassword, newPassword }),
    lock: () => ipcRenderer.invoke('auth:lock'),
  },

  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    save: (profiles) => ipcRenderer.invoke('profiles:save', { profiles }),
  },

  token: {
    get: () => ipcRenderer.invoke('token:get'),
  },

  dialog: {
    selectKeyFile: () => ipcRenderer.invoke('dialog:select-key-file'),
    saveFileDialog: (defaultFilename) => ipcRenderer.invoke('dialog:save-file', { defaultFilename }),
  },

  shell: {
    openLogs: () => ipcRenderer.invoke('shell:open-logs'),
  },

  app: {
    getInfo: () => ipcRenderer.invoke('app:get-info'),
  },

  clipboard: {
    writeText: (text) => ipcRenderer.invoke('clipboard:write-text', { text }),
  },
});

