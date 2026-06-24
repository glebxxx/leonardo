#!/usr/bin/env python3
# Minimal stdio MCP server (stdlib only) that proxies tool calls to Leonardo's
# in-process HTTP bridge (which holds the live DaVinci Resolve handle). Spawned by
# the `claude` CLI in Max mode. Exposes all of Leonardo's tools to Claude Code.
#
# Env: MCP_BRIDGE_URL, MCP_BRIDGE_TOKEN (set by the plugin when launching claude).

import sys
import json
import os
import urllib.request

BRIDGE = os.environ.get("MCP_BRIDGE_URL", "")
TOKEN = os.environ.get("MCP_BRIDGE_TOKEN", "")
PROTOCOL = "2024-11-05"
SERVER_INFO = {"name": "leonardo", "version": "1.0.0"}


def bridge(method, path, data=None):
    req = urllib.request.Request(
        BRIDGE + path,
        method=method,
        headers={"x-bridge-token": TOKEN, "content-type": "application/json"},
    )
    body = json.dumps(data).encode() if data is not None else None
    with urllib.request.urlopen(req, body, timeout=600) as r:
        return json.loads(r.read().decode())


def get_tools():
    try:
        data = bridge("GET", "/tools")
    except Exception:
        return []
    out = []
    for t in data.get("tools", []):
        out.append({
            "name": t["name"],
            "description": t.get("description", ""),
            "inputSchema": t.get("input_schema", {"type": "object", "properties": {}}),
        })
    return out


def send(msg):
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def reply(mid, result=None, error=None):
    m = {"jsonrpc": "2.0", "id": mid}
    if error is not None:
        m["error"] = error
    else:
        m["result"] = result
    send(m)


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception:
            continue
        method = msg.get("method")
        mid = msg.get("id")

        if method == "initialize":
            reply(mid, {"protocolVersion": PROTOCOL, "capabilities": {"tools": {}}, "serverInfo": SERVER_INFO})
        elif method == "notifications/initialized":
            pass
        elif method == "ping":
            reply(mid, {})
        elif method == "tools/list":
            reply(mid, {"tools": get_tools()})
        elif method == "tools/call":
            params = msg.get("params", {})
            name = params.get("name")
            args = params.get("arguments", {})
            try:
                res = bridge("POST", "/call", {"name": name, "input": args})
                text = str(res.get("content", ""))
                is_err = bool(res.get("is_error"))
                reply(mid, {"content": [{"type": "text", "text": text}], "isError": is_err})
            except Exception as e:
                reply(mid, {"content": [{"type": "text", "text": "bridge error: " + str(e)}], "isError": True})
        else:
            if mid is not None:
                reply(mid, error={"code": -32601, "message": "method not found: " + str(method)})


if __name__ == "__main__":
    main()
