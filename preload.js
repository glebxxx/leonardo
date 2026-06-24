// Bridge between the sandboxed renderer and the main process.
// Secrets (API key, OAuth token) and the Resolve handle stay in main.

const { contextBridge, ipcRenderer } = require('electron/renderer');

contextBridge.exposeInMainWorld('claude', {
    // actions
    send: (text) => ipcRenderer.invoke('chat:send', text),
    reset: () => ipcRenderer.invoke('chat:reset'),
    settingsStatus: () => ipcRenderer.invoke('settings:status'),
    setMode: (mode) => ipcRenderer.invoke('settings:setMode', mode),
    setKey: (key) => ipcRenderer.invoke('settings:setKey', key),
    setOauth: (tok) => ipcRenderer.invoke('settings:setOauth', tok),

    // streamed events (main -> renderer)
    onDelta: (cb) => ipcRenderer.on('chat:delta', (_e, t) => cb(t)),
    onTool: (cb) => ipcRenderer.on('chat:tool', (_e, info) => cb(info)),
    onToolResult: (cb) => ipcRenderer.on('chat:toolResult', (_e, info) => cb(info)),
    onDone: (cb) => ipcRenderer.on('chat:done', () => cb()),
    onError: (cb) => ipcRenderer.on('chat:error', (_e, m) => cb(m)),
});
