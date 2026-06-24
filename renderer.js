// Renderer: chat UI. Talks to main only through window.claude (see preload.js).

const transcript = document.getElementById('transcript');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const statusEl = document.getElementById('status');
const settingsPanel = document.getElementById('settings');
const keyInput = document.getElementById('keyInput');
const oauthInput = document.getElementById('oauthInput');
const apiFields = document.getElementById('apiFields');
const maxFields = document.getElementById('maxFields');
const modeApiBtn = document.getElementById('modeApi');
const modeMaxBtn = document.getElementById('modeMax');
let currentMode = 'apikey';

function applyModeUI(mode) {
    currentMode = mode === 'max' ? 'max' : 'apikey';
    modeApiBtn.classList.toggle('active', currentMode === 'apikey');
    modeMaxBtn.classList.toggle('active', currentMode === 'max');
    apiFields.classList.toggle('hidden', currentMode !== 'apikey');
    maxFields.classList.toggle('hidden', currentMode !== 'max');
}

let currentAssistantEl = null; // the bubble currently receiving streamed text
let busy = false;

function scrollDown() {
    transcript.scrollTop = transcript.scrollHeight;
}

function addMessage(role, text) {
    const el = document.createElement('div');
    el.className = 'msg ' + role;
    el.textContent = text || '';
    transcript.appendChild(el);
    scrollDown();
    return el;
}

function addToolChip(name, inputObj) {
    const el = document.createElement('div');
    el.className = 'tool pending';

    const head = document.createElement('div');
    head.className = 'tool-head';
    head.textContent = '⚙ ' + name;
    el.appendChild(head);

    if (inputObj && Object.keys(inputObj).length) {
        const args = document.createElement('div');
        args.className = 'tool-args';
        args.textContent = JSON.stringify(inputObj);
        el.appendChild(args);
    }
    transcript.appendChild(el);
    scrollDown();
    return el;
}

function setBusy(b) {
    busy = b;
    sendBtn.disabled = b;
    statusEl.textContent = b ? 'Leonardo is thinking…' : '';
}

// ---- streamed events from main ----
window.claude.onDelta((t) => {
    if (!currentAssistantEl) currentAssistantEl = addMessage('assistant', '');
    currentAssistantEl.textContent += t;
    scrollDown();
});

window.claude.onTool((info) => {
    currentAssistantEl = null; // text after a tool starts a fresh bubble
    addToolChip(info.name, info.input);
});

window.claude.onToolResult((info) => {
    const chips = transcript.querySelectorAll('.tool.pending');
    const chip = chips[chips.length - 1];
    if (!chip) return;
    chip.classList.remove('pending');
    chip.classList.add(info.is_error ? 'err' : 'ok');
    if (info.is_error) {
        const e = document.createElement('div');
        e.className = 'tool-args';
        e.textContent = info.content;
        chip.appendChild(e);
    }
    scrollDown();
});

window.claude.onDone(() => {
    setBusy(false);
    currentAssistantEl = null;
});

window.claude.onError((m) => {
    addMessage('error', m);
    currentAssistantEl = null;
});

// ---- send ----
async function send() {
    const text = input.value.trim();
    if (!text || busy) return;
    addMessage('user', text);
    input.value = '';
    autoSize();
    currentAssistantEl = null;
    setBusy(true);
    await window.claude.send(text);
}

sendBtn.addEventListener('click', send);

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
    }
});

// textarea auto-grow
function autoSize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
}
input.addEventListener('input', autoSize);

// ---- settings ----
document.getElementById('gear').addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
    if (!settingsPanel.classList.contains('hidden')) (currentMode === 'max' ? oauthInput : keyInput).focus();
});

modeApiBtn.addEventListener('click', () => applyModeUI('apikey'));
modeMaxBtn.addEventListener('click', () => applyModeUI('max'));

document.getElementById('saveSettings').addEventListener('click', async () => {
    await window.claude.setMode(currentMode);
    if (currentMode === 'apikey') {
        const k = keyInput.value.trim();
        if (k) await window.claude.setKey(k);
        keyInput.value = '';
        addMessage('system', 'Mode: API key.' + (k ? ' Key saved.' : ''));
    } else {
        const t = oauthInput.value.trim();
        if (t) await window.claude.setOauth(t);
        oauthInput.value = '';
        addMessage('system', 'Mode: Max (subscription). ' + (t ? 'Token saved.' : 'Using current Claude Code login.'));
    }
    settingsPanel.classList.add('hidden');
});

document.getElementById('resetChat').addEventListener('click', async () => {
    await window.claude.reset();
    transcript.innerHTML = '';
    currentAssistantEl = null;
    addMessage('system', 'New conversation.');
});

// ---- boot ----
(async function boot() {
    addMessage(
        'system',
        'Hi! I am Leonardo — an assistant inside DaVinci Resolve. Type a task — for example: "switch to the Color page", ' +
        '"create a project Demo", "what is open right now?".'
    );
    const s = await window.claude.settingsStatus();
    applyModeUI(s.mode);
    if (s.mode === 'apikey' && !s.hasKey) {
        addMessage('system', 'Set an Anthropic API key (⚙), or switch to Max mode (Claude subscription).');
        settingsPanel.classList.remove('hidden');
    }
})();
