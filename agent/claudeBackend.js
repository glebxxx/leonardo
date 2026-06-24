// Max-subscription backend: drive the installed `claude` CLI (Claude Code) which
// authenticates with the user's Claude Max subscription. Leonardo's tools are
// exposed to it via the stdio MCP proxy (mcp/leonardo_mcp.py -> mcpBridge).
// Streams assistant text/tool events back to the panel. Maintains a session id
// for multi-turn continuity (--resume).

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PY = fs.existsSync('/usr/local/bin/python3')
    ? '/usr/local/bin/python3'
    : fs.existsSync('/opt/homebrew/bin/python3')
    ? '/opt/homebrew/bin/python3'
    : 'python3';
const MCP_PY = path.join(__dirname, '..', 'mcp', 'leonardo_mcp.py');

function findClaude(configured) {
    const cands = [
        configured,
        path.join(os.homedir(), '.claude/local/claude'),
        '/opt/homebrew/bin/claude',
        '/usr/local/bin/claude',
        path.join(os.homedir(), '.local/bin/claude'),
    ].filter(Boolean);
    for (const c of cands) {
        try { if (fs.existsSync(c)) return c; } catch (e) { /* ignore */ }
    }
    return 'claude'; // hope it's on PATH
}

function richEnv(extra) {
    const env = { ...process.env, ...(extra || {}) };
    const dirs = ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local/bin'), path.join(os.homedir(), '.claude/local')];
    env.PATH = [...dirs, env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin'].join(':');
    return env;
}

// Runs one user turn through Claude Code. `session` is a mutable {id} carried
// across turns. Resolves when the CLI process exits.
function runClaudeTurn({ text, system, bridge, config, session, callbacks }) {
    return new Promise((resolve) => {
        const cb = callbacks || {};
        const claude = findClaude(config.claudePath);

        const mcpCfg = {
            mcpServers: {
                leonardo: {
                    command: PY,
                    args: [MCP_PY],
                    env: { MCP_BRIDGE_URL: bridge.url, MCP_BRIDGE_TOKEN: bridge.token },
                },
            },
        };
        const cfgPath = path.join(os.tmpdir(), 'leonardo-mcp-config.json');
        try { fs.writeFileSync(cfgPath, JSON.stringify(mcpCfg)); } catch (e) { /* ignore */ }

        const args = [
            '-p', String(text),
            '--output-format', 'stream-json',
            '--verbose',
            '--mcp-config', cfgPath,
            '--allowedTools', 'mcp__leonardo',
            '--append-system-prompt', system,
        ];
        if (config.model) args.push('--model', config.model);
        if (session.id) args.push('--resume', session.id);

        const env = richEnv();
        if (config.oauthToken) env.CLAUDE_CODE_OAUTH_TOKEN = config.oauthToken;

        let child;
        try {
            child = spawn(claude, args, { env, cwd: os.homedir() });
        } catch (e) {
            cb.onError && cb.onError('Failed to start the claude CLI: ' + e.message + '\nInstall Claude Code and/or set the path to claude in the settings.');
            return resolve();
        }

        let buf = '';
        let stderr = '';
        let gotText = false;

        function handleEvent(evt) {
            if (!evt || typeof evt !== 'object') return;
            if (evt.session_id) session.id = evt.session_id;
            if (evt.type === 'assistant' && evt.message && Array.isArray(evt.message.content)) {
                for (const b of evt.message.content) {
                    if (b.type === 'text' && b.text) {
                        gotText = true;
                        cb.onText && cb.onText(b.text);
                    } else if (b.type === 'tool_use') {
                        cb.onToolUse && cb.onToolUse({ name: String(b.name || '').replace(/^mcp__leonardo__/, ''), input: b.input || {} });
                    }
                }
            }
            if (evt.type === 'result' && !gotText && evt.result) {
                cb.onText && cb.onText(String(evt.result));
            }
        }

        child.stdout.on('data', (chunk) => {
            buf += chunk.toString();
            let nl;
            while ((nl = buf.indexOf('\n')) !== -1) {
                const line = buf.slice(0, nl).trim();
                buf = buf.slice(nl + 1);
                if (!line) continue;
                try { handleEvent(JSON.parse(line)); } catch (e) { /* non-json line */ }
            }
        });
        child.stderr.on('data', (c) => { stderr += c.toString(); });
        child.on('error', (e) => {
            cb.onError && cb.onError('claude CLI error: ' + e.message + '\nMake sure Claude Code is installed (claude) and `claude setup-token` has been run.');
            resolve();
        });
        child.on('close', (code) => {
            if (code !== 0 && !gotText) {
                cb.onError && cb.onError(
                    `claude CLI exited with code ${code}.\n` +
                    (stderr ? stderr.slice(0, 800) : 'Check: Claude Code is installed, `claude setup-token` has been run (or an OAuth token is set in the settings), and an active Max subscription is present.')
                );
            }
            resolve();
        });
    });
}

module.exports = { runClaudeTurn, findClaude };
