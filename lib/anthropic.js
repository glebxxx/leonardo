// Minimal Anthropic Messages API client using the runtime's built-in fetch
// (Electron 36 / Node 20 ships global fetch + web streams), so the plugin needs
// ZERO npm dependencies. Implements streaming (SSE) and reconstructs the full
// assistant message (text + tool_use blocks) so the caller can run the tool loop.

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

// streamMessage(opts) -> { role:'assistant', content:[...blocks], stop_reason }
// Calls onText(deltaString) live as text arrives. tool_use input is reassembled
// from input_json_delta fragments and parsed at content_block_stop.
async function streamMessage({ apiKey, model, system, tools, messages, maxTokens, onText }) {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
            model,
            max_tokens: maxTokens || 8192,
            system,
            tools,
            messages,
            stream: true,
        }),
    });

    if (!res.ok || !res.body) {
        let detail = '';
        try {
            detail = await res.text();
        } catch (e) {
            /* ignore */
        }
        throw new Error(formatApiError(res.status, detail));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const content = []; // reconstructed content blocks, indexed by block index
    const partialJson = {}; // block index -> accumulated tool_use input JSON
    let stopReason = null;

    function handleEvent(data) {
        if (!data || data === '[DONE]') return;
        let evt;
        try {
            evt = JSON.parse(data);
        } catch (e) {
            return;
        }

        switch (evt.type) {
            case 'content_block_start': {
                content[evt.index] = evt.content_block;
                if (evt.content_block.type === 'tool_use') partialJson[evt.index] = '';
                if (evt.content_block.type === 'text' && evt.content_block.text && onText) {
                    onText(evt.content_block.text);
                }
                break;
            }
            case 'content_block_delta': {
                const d = evt.delta || {};
                if (d.type === 'text_delta') {
                    const blk = content[evt.index] || (content[evt.index] = { type: 'text', text: '' });
                    blk.text = (blk.text || '') + d.text;
                    if (onText) onText(d.text);
                } else if (d.type === 'input_json_delta') {
                    partialJson[evt.index] = (partialJson[evt.index] || '') + d.partial_json;
                }
                break;
            }
            case 'content_block_stop': {
                const blk = content[evt.index];
                if (blk && blk.type === 'tool_use') {
                    const raw = partialJson[evt.index];
                    try {
                        blk.input = raw ? JSON.parse(raw) : {};
                    } catch (e) {
                        blk.input = {};
                    }
                }
                break;
            }
            case 'message_delta': {
                if (evt.delta && evt.delta.stop_reason) stopReason = evt.delta.stop_reason;
                break;
            }
            case 'error': {
                throw new Error('Anthropic stream error: ' + JSON.stringify(evt.error || evt));
            }
            default:
                break; // ping, message_start, message_stop
        }
    }

    // Read the SSE stream, splitting on blank lines between events.
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);

            const dataLines = [];
            for (const line of chunk.split('\n')) {
                if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
                // "event:" lines are informational; type is in the JSON payload
            }
            if (dataLines.length) handleEvent(dataLines.join('\n'));
        }
    }

    return {
        role: 'assistant',
        content: content.filter(Boolean),
        stop_reason: stopReason || 'end_turn',
    };
}

function formatApiError(status, detail) {
    let parsed;
    try {
        parsed = JSON.parse(detail);
    } catch (e) {
        /* ignore */
    }
    const msg = parsed && parsed.error && parsed.error.message ? parsed.error.message : detail;
    if (status === 401) return 'Anthropic API: invalid API key (401). Check the key in settings (⚙).';
    if (status === 429) return 'Anthropic API: rate limit exceeded (429). Try again later.';
    if (status === 400 && /model/i.test(msg || '')) {
        return `Anthropic API (400): ${msg}. The model id may be invalid — change "model" in ~/.leonardo.json.`;
    }
    return `Anthropic API error ${status}: ${msg || 'no details'}`;
}

module.exports = { streamMessage };
