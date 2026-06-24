// System "super-tools" — maximum reach beyond the Resolve API: arbitrary shell,
// full Resolve Python API, AppleScript, filesystem, HTTP, open-in-default-app.
// These run in the Electron MAIN process (full Node), so they can do almost
// anything on the machine. Destructive/irreversible actions must be confirmed
// with the user first (enforced via the system prompt). Outputs are capped.

const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_OUT = 100 * 1024; // cap tool_result payloads
const cap = (s) => {
    s = String(s == null ? '' : s);
    return s.length > MAX_OUT ? s.slice(0, MAX_OUT) + `\n…[truncated, ${s.length} chars total]` : s;
};

const RESOLVE_SCRIPT_API = '/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting';
const RESOLVE_SCRIPT_LIB = '/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so';
const PY = fs.existsSync('/usr/local/bin/python3') ? '/usr/local/bin/python3' : (fs.existsSync('/opt/homebrew/bin/python3') ? '/opt/homebrew/bin/python3' : 'python3');

// GUI apps (Resolve) launch with a minimal PATH; enrich it so ffmpeg/brew/etc resolve.
function richEnv(extra) {
    const env = { ...process.env, ...(extra || {}) };
    const dirs = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/local/sbin', (process.env.HOME || '') + '/.local/bin'];
    const cur = env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin';
    env.PATH = [...dirs, cur].filter(Boolean).join(':');
    return env;
}

async function run_shell({ command, cwd, timeout }) {
    if (!command) throw new Error('command is required.');
    return new Promise((res) => {
        exec(command, { cwd: cwd || process.env.HOME, timeout: timeout || 120000, maxBuffer: 16 * 1024 * 1024, env: richEnv() }, (err, stdout, stderr) => {
            res({
                ok: !err,
                exit_code: err && typeof err.code === 'number' ? err.code : err ? 1 : 0,
                stdout: cap(stdout),
                stderr: cap(stderr),
                error: err ? (err.killed ? `timeout exceeded (${timeout || 120000}ms)` : err.message) : null,
            });
        });
    });
}

async function run_python({ code, cwd, timeout, connect_resolve }) {
    if (!code) throw new Error('code is required.');
    const env = richEnv();
    let full = code;
    if (connect_resolve !== false) {
        env.RESOLVE_SCRIPT_API = RESOLVE_SCRIPT_API;
        env.RESOLVE_SCRIPT_LIB = RESOLVE_SCRIPT_LIB;
        env.PYTHONPATH = `${RESOLVE_SCRIPT_API}/Modules/` + (env.PYTHONPATH ? `:${env.PYTHONPATH}` : '');
        // Bootstrap: `resolve`, `projectManager`, `project` ready to use.
        full = [
            'import DaVinciResolveScript as dvr',
            'resolve = dvr.scriptapp("Resolve")',
            'projectManager = resolve.GetProjectManager() if resolve else None',
            'project = projectManager.GetCurrentProject() if projectManager else None',
            '',
        ].join('\n') + code;
    }
    return new Promise((res) => {
        execFile(PY, ['-c', full], { cwd: cwd || process.env.HOME, timeout: timeout || 120000, maxBuffer: 16 * 1024 * 1024, env }, (err, stdout, stderr) => {
            res({
                ok: !err,
                exit_code: err && typeof err.code === 'number' ? err.code : err ? 1 : 0,
                stdout: cap(stdout),
                stderr: cap(stderr),
                error: err ? (err.killed ? 'timeout' : err.message) : null,
                connected_resolve: connect_resolve !== false,
            });
        });
    });
}

async function run_applescript({ script }) {
    if (!script) throw new Error('script is required.');
    return new Promise((res) => {
        const child = execFile('osascript', ['-'], { timeout: 60000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
            res({ ok: !err, stdout: cap(stdout), stderr: cap(stderr), error: err ? err.message : null });
        });
        child.stdin.write(script);
        child.stdin.end();
    });
}

async function read_file({ path: p, max_bytes }) {
    if (!p) throw new Error('path is required.');
    const max = max_bytes || MAX_OUT;
    const buf = fs.readFileSync(p);
    return { path: p, bytes: buf.length, truncated: buf.length > max, content: buf.slice(0, max).toString('utf8') };
}

async function write_file({ path: p, content, append }) {
    if (!p) throw new Error('path is required.');
    const data = content == null ? '' : String(content);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data, { flag: append ? 'a' : 'w' });
    return { ok: true, path: p, bytes: Buffer.byteLength(data), mode: append ? 'append' : 'overwrite' };
}

async function list_dir({ path: p }) {
    const dir = p || process.env.HOME;
    const entries = fs.readdirSync(dir, { withFileTypes: true }).map((e) => {
        let size = null;
        let mtime = null;
        try {
            const st = fs.statSync(path.join(dir, e.name));
            size = st.size;
            mtime = Math.round(st.mtimeMs);
        } catch (err) {
            /* ignore */
        }
        return { name: e.name, type: e.isDirectory() ? 'dir' : e.isSymbolicLink() ? 'link' : 'file', size, mtime };
    });
    return { dir, count: entries.length, entries: entries.slice(0, 500) };
}

async function http_request({ url, method, headers, body, max_bytes }) {
    if (!url) throw new Error('url is required.');
    const r = await fetch(url, { method: method || 'GET', headers: headers || {}, body: body || undefined });
    const text = await r.text();
    const max = max_bytes || MAX_OUT;
    return {
        status: r.status,
        ok: r.ok,
        headers: Object.fromEntries(r.headers.entries()),
        body: text.length > max ? text.slice(0, max) + '…[truncated]' : text,
    };
}

async function open_path({ path: p }) {
    if (!p) throw new Error('path is required (file/folder/URL).');
    return new Promise((res) => {
        execFile('open', [p], { timeout: 15000 }, (err) => res({ ok: !err, opened: p, error: err ? err.message : null }));
    });
}

module.exports = { run_shell, run_python, run_applescript, read_file, write_file, list_dir, http_request, open_path };
