let cachedToken = null;
let backendBaseUrl = 'http://127.0.0.1:48921';

export async function getBackendAuthToken() {
  if (cachedToken) return cachedToken;
  if (window.skydeck && window.skydeck.token) {
    try {
      const res = await window.skydeck.token.get();
      cachedToken = res.token;
      if (res.port) {
        backendBaseUrl = `http://127.0.0.1:${res.port}`;
      }
      return cachedToken;
    } catch (e) {
      console.error('Failed to get token from IPC:', e);
    }
  }
  return '';
}

async function request(endpoint, options = {}) {
  const token = await getBackendAuthToken();
  const url = `${backendBaseUrl}${endpoint}`;

  const headers = {
    'X-Skydeck-Token': token,
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    throw new Error('Unauthorized: Backend rejected security token.');
  }

  // Handle binary / stream responses (e.g. download)
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/octet-stream') || contentType.includes('application/zip')) {
    return response;
  }

  const result = await response.json();
  if (!response.ok || result.success === false) {
    throw new Error(result.error || `Request failed with status ${response.status}`);
  }

  return result.data !== undefined ? result.data : result;
}

export const api = {
  // Session / Connection
  connect: (payload) =>
    request('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  disconnect: (sessionId) =>
    request('/api/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    }),

  ping: (sessionId) => request(`/api/ping?session_id=${encodeURIComponent(sessionId || '')}`),

  // File Listing
  listFiles: (sessionId, path = '') =>
    request(`/api/files?session_id=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`),

  // File Upload (XMLHttpRequest for progress reporting)
  uploadFiles: (sessionId, remoteDir, files, onProgress) => {
    return new Promise(async (resolve, reject) => {
      try {
        const token = await getBackendAuthToken();
        const formData = new FormData();
        formData.append('session_id', sessionId);
        formData.append('remote_dir', remoteDir);

        for (let i = 0; i < files.length; i++) {
          formData.append('files', files[i]);
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${backendBaseUrl}/api/upload`, true);
        xhr.setRequestHeader('X-Skydeck-Token', token);

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              onProgress({
                loaded: event.loaded,
                total: event.total,
                percent,
              });
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.success) {
                resolve(res.data);
              } else {
                reject(new Error(res.error || 'Upload failed'));
              }
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      } catch (err) {
        reject(err);
      }
    });
  },

  // File Download
  downloadFile: async (sessionId, remotePath, filename) => {
    const token = await getBackendAuthToken();
    const url = `${backendBaseUrl}/api/download?session_id=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(remotePath)}&token=${encodeURIComponent(token)}`;

    // If running inside Electron, ask user for save destination
    if (window.skydeck && window.skydeck.dialog) {
      const saveRes = await window.skydeck.dialog.saveFileDialog(filename);
      if (saveRes.canceled || !saveRes.filePath) {
        return { canceled: true };
      }

      const response = await fetch(url, {
        headers: { 'X-Skydeck-Token': token },
      });
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();

      // Download can be written through browser a-tag or direct save
      const blobUrl = window.URL.createObjectURL(new Blob([buffer]));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      return { success: true, filePath: saveRes.filePath };
    } else {
      // Standard browser anchor download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return { success: true };
    }
  },

  // Delete
  deleteItem: (sessionId, path, isDir) =>
    request('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, path, is_dir: !!isDir }),
    }),

  // Rename
  renameItem: (sessionId, oldPath, newPath) =>
    request('/api/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, old_path: oldPath, new_path: newPath }),
    }),

  // Create Folder
  createFolder: (sessionId, path) =>
    request('/api/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, path }),
    }),

  // Read File Content
  readFile: (sessionId, path) =>
    request(`/api/read?session_id=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`),

  // Write File Content
  writeFile: (sessionId, path, content) =>
    request('/api/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, path, content }),
    }),

  // Stat
  stat: (sessionId, path) =>
    request(`/api/stat?session_id=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`),

  // Chmod
  chmod: (sessionId, path, mode) =>
    request('/api/chmod', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, path, mode }),
    }),

  // Terminal WebSocket URL
  getTerminalWsUrl: async (sessionId) => {
    const token = await getBackendAuthToken();
    const wsBase = backendBaseUrl.replace(/^http/, 'ws');
    return `${wsBase}/api/terminal/ws?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
  },

  // v2.5.0 Power Tools
  search: (sessionId, path, query, contentQuery = '', maxResults = 100) => {
    const params = new URLSearchParams({
      session_id: sessionId,
      path: path || '/',
      query: query || '',
      content_query: contentQuery || '',
      max_results: String(maxResults),
    });
    return request(`/api/search?${params.toString()}`);
  },

  extractArchive: (sessionId, archivePath, destDir = '') =>
    request('/api/archive/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, archive_path: archivePath, dest_dir: destDir }),
    }),

  createArchive: (sessionId, items, archivePath, format = 'zip') =>
    request('/api/archive/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, items, archive_path: archivePath, format }),
    }),

  getDiskUsage: (sessionId, path = '/') =>
    request(`/api/disk-usage?session_id=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`),

  copyItem: (sessionId, srcPath, destPath, move = false) =>
    request('/api/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, src_path: srcPath, dest_path: destPath, move }),
    }),
};

