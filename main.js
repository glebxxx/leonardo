// Electron main process. Resolve Studio launches this via manifest <FilePath>.
//   - creates the sandboxed chat window
//   - holds conversation state + secrets (never in renderer)
//   - two "brain" modes:
//       'apikey' -> direct Anthropic Messages API (pay-per-token) via agentLoop
//       'max'    -> the local `claude` CLI on the user's Max subscription, with
//                   our tools exposed over the MCP bridge (claudeBackend)

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { DEFAULT_MODEL } = require('./pluginConfig');
const resolveClient = require('./resolve/resolveClient');
const { runTurn, SYSTEM } = require('./agent/agentLoop');
const mcpBridge = require('./agent/mcpBridge');
const { runClaudeTurn } = require('./agent/claudeBackend');

let mainWindow = null;
let bridgeInfo = null; // { url, token } once the MCP bridge is listening

const CONFIG_PATH = path.join(os.homedir(), '.leonardo.json');

function loadConfig() {
    try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (e) { return {}; }
}
function saveConfig(patch) {
    try {
        const cfg = { ...loadConfig(), ...patch };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
        return true;
    } catch (e) {
        return false;
    }
}

function getMode() { return loadConfig().mode === 'max' ? 'max' : 'apikey'; }
function getApiKey() { return process.env.ANTHROPIC_API_KEY || loadConfig().apiKey || null; }
function getOauth() { return process.env.CLAUDE_CODE_OAUTH_TOKEN || loadConfig().oauthToken || null; }
function getModel() { return loadConfig().model || DEFAULT_MODEL; }

// Per-window state.
let messages = [];           // apikey mode: full message history
const session = { id: null }; // max mode: Claude Code session id for --resume

// ---- IPC: settings ----
ipcMain.handle('settings:status', () => ({
    mode: getMode(),
    hasKey: !!getApiKey(),
    hasOauth: !!getOauth(),
    model: getModel(),
}));
ipcMain.handle('settings:setMode', (e, mode) => saveConfig({ mode: mode === 'max' ? 'max' : 'apikey' }));
ipcMain.handle('settings:setKey', (e, key) => saveConfig({ apiKey: String(key || '').trim() }));
ipcMain.handle('settings:setOauth', (e, tok) => saveConfig({ oauthToken: String(tok || '').trim() }));

ipcMain.handle('chat:reset', () => {
    messages = [];
    session.id = null;
    return true;
});

// ---- IPC: chat turn ----
ipcMain.handle('chat:send', async (event, userText) => {
    const sender = event.sender;
    const callbacks = {
        onText: (t) => sender.send('chat:delta', t),
        onToolUse: (info) => sender.send('chat:tool', info),
        onToolResult: (info) => sender.send('chat:toolResult', info),
        onError: (m) => sender.send('chat:error', m),
    };
    const mode = getMode();
    try {
        if (mode === 'max') {
            if (!bridgeInfo) {
                sender.send('chat:error', 'The tools bridge is not ready yet — try again in a moment.');
                return;
            }
            await runClaudeTurn({
                text: String(userText),
                system: SYSTEM,
                bridge: bridgeInfo,
                config: { oauthToken: getOauth(), claudePath: loadConfig().claudePath, model: loadConfig().model },
                session,
                callbacks,
            });
        } else {
            const apiKey = getApiKey();
            if (!apiKey) {
                sender.send('chat:error', 'Anthropic API key is not set. Click ⚙ and paste your key (or switch to Max mode).');
                return;
            }
            messages.push({ role: 'user', content: String(userText) });
            await runTurn({ apiKey, model: getModel(), messages, callbacks });
        }
    } catch (e) {
        sender.send('chat:error', e && e.message ? e.message : String(e));
    } finally {
        sender.send('chat:done');
    }
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 460,
        height: 780,
        minWidth: 360,
        minHeight: 480,
        useContentSize: true,
        title: 'Leonardo DaVinci',
        webPreferences: { preload: path.join(__dirname, 'preload.js') },
    });
    mainWindow.on('close', () => app.quit());
    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(async () => {
    // Start the local MCP bridge so Max mode can reach our tools (in-process,
    // with the live Resolve handle). Cheap; harmless in apikey mode.
    try { bridgeInfo = await mcpBridge.start(); } catch (e) { bridgeInfo = null; }
    createWindow();
});

app.on('window-all-closed', async () => {
    await resolveClient.cleanup();
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
