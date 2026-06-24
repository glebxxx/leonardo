// Local HTTP bridge so an external MCP server (driven by the `claude` CLI in Max
// mode) can call our in-process tool dispatch — which holds the live Resolve
// handle. Bound to 127.0.0.1 on a random port, guarded by a per-session token.
//   GET  /tools  -> { tools: [...schemas...] }
//   POST /call   -> body {name, input} -> { is_error, content }

const http = require('http');
const { dispatch } = require('./resolveTools');
const { tools } = require('./tools');

let server = null;
let port = 0;
let token = '';

function start() {
    if (server) return Promise.resolve(info());
    token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
        server = http.createServer((req, res) => {
            if (req.headers['x-bridge-token'] !== token) {
                res.writeHead(403);
                res.end('forbidden');
                return;
            }
            if (req.method === 'GET' && req.url === '/tools') {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ tools }));
                return;
            }
            if (req.method === 'POST' && req.url === '/call') {
                let body = '';
                req.on('data', (c) => { body += c; });
                req.on('end', async () => {
                    let payload;
                    try { payload = JSON.parse(body); } catch (e) { res.writeHead(400); res.end('{"is_error":true,"content":"bad json"}'); return; }
                    let result;
                    try { result = await dispatch(payload.name, payload.input || {}); }
                    catch (e) { result = { is_error: true, content: String(e && e.message ? e.message : e) }; }
                    res.writeHead(200, { 'content-type': 'application/json' });
                    res.end(JSON.stringify(result));
                });
                return;
            }
            res.writeHead(404);
            res.end('not found');
        });
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            port = server.address().port;
            resolve(info());
        });
    });
}

function info() {
    return { port, token, url: `http://127.0.0.1:${port}` };
}

module.exports = { start, info };
