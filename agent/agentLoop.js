// The Claude tool-use loop. Streams a turn; if Claude asks to use tools, run them
// against Resolve, feed the results back, and loop until stop_reason === 'end_turn'.
// Rules honored (per Anthropic tool-use docs):
//  - append the FULL assistant content (so tool_use blocks are preserved in history)
//  - every tool_result carries the matching tool_use_id
//  - all results from one assistant turn go back in a single user message

const { streamMessage } = require('../lib/anthropic');
const { tools } = require('./tools');
const resolveTools = require('./resolveTools');

const SYSTEM = [
    'You are Leonardo, an AI editing assistant built directly into DaVinci Resolve (running on the Claude model).',
    'Through tools you control Resolve: pages, projects, media pool, timelines, editing (cutting, ripple-delete, tracks, compound, titles), markers and rendering.',
    '',
    'Rules:',
    '- Work step by step and use tools instead of imagining the result.',
    '- If you are unsure of the current state, call get_status first.',
    '- Before actions by name (open a project/timeline), verify via list_projects / list_timelines when in doubt.',
    '- File paths must be absolute; if the user gave a relative path or a folder, ask for clarification.',
    '- Heavy/irreversible actions (render_current_timeline, create_project) should only be performed after the user explicitly agrees; briefly confirm the parameters before calling.',
    '- Editing: clip indices in list_timeline_clips are 1-based, frames/timecodes are relative to the timeline. To remove a piece: if needed, position the playhead (set_playhead) and cut (blade_at_playhead), then delete_clips — ripple=true shifts the tail and closes the gap, ripple=false leaves a gap. Before deleting, check against the clip list.',
    '- To place an already trimmed piece, use append_clip with source_start/source_end (trim by source frames) and recordFrame (where on the timeline). blade_at_playhead uses system keyboard shortcuts and requires macOS Accessibility permission for DaVinci Resolve; ripple-delete and assembly work directly through the API.',
    '- FULL control: if the action you need is not among the direct tools, use run_menu_command (any menu item by path, e.g. ["Timeline","Add Transition"]), press_shortcut (any shortcut: e.g. key "t" — add a transition at the selected cut; key "\\\\" with command — blade) or type_text. Through them, everything a human can do is available: transitions, trimming, any menu command.',
    '- Priority: prefer the direct API tools first (reliable and without permissions), and use run_menu_command/press_shortcut/type_text only for what the API lacks. They all require macOS Accessibility permission and Resolve to be focused; if it did not work, say so honestly.',
    '- Keyboard shortcuts are a powerful control channel. Call press_shortcut with action (the action name) and the keys are filled in automatically: e.g. action "Add Transition" (Cmd+T), "Split Clip" (Cmd+\\), "Insert edit" (F9), "Snapping toggle" (N), "Zoom to Fit timeline". If unsure about the action, run lookup_shortcuts first.',
    '- This is the DEFAULT Resolve layout. If the user changed shortcuts or a key did not work, switch to run_menu_command (independent of the layout). Ripple/lift-delete and markers are more accurate through the API (delete_clips, add_timeline_marker) than via keys.',
    '- Find the exact menu item names from Resolve itself via list_menus: without an argument — the top menus, list_menus(["Timeline"]) — the items of the Timeline menu. Do this before run_menu_command if you are unsure of a name (it accounts for the version and UI language) instead of guessing.',
    '- Color grading: for a request like "do a color grade / warm / teal&orange / vintage / b&w …" use grade_clip — it builds the node tree on the Color page itself and applies CDL/LUT per the recipe. If the footage is in LOG (S-Log3, V-Log, LogC, C-Log, Log3G10, BRAW, D-Log…), FIRST run detect_camera, then apply_log_profile (LOG→Rec.709 with the right conversion LUT/colorspace), and only then grade_clip.',
    '- After grading, ALWAYS pass the manual_steps from the grade_clip response to the user — what the API cannot do and needs manual finishing (curves/S-curve, HSL qualification and skin protection, power-window vignettes, layer-mixer composite). Fine work is done with primitives add_serial_node (UI, needs Accessibility), apply_cdl_to_node, apply_lut_to_node, get_node_info, reset_grade. list_grade_recipes — list of looks, list_luts — list of LUTs.',
    '- The system super-tools give access to the ENTIRE machine: run_shell (any command: ffmpeg, files, utilities), run_python (the FULL Python API of Resolve — resolve/project are already set up, any methods are available even without a wrapper), run_applescript, read_file/write_file/list_dir, http_request, open_path. Use them when the task goes beyond the ready-made tools (transcoding, organizing files, downloading, non-standard API calls).',
    '- SAFETY of the system tools: run read/listing/informational commands immediately. But before IRREVERSIBLE or DANGEROUS actions — deleting/overwriting files (rm, mv over, >), sudo, installing/uninstalling software, formatting, bulk changes, sending data out — FIRST show the user the exact command and wait for explicit consent. Never print or log ANTHROPIC_API_KEY and other secrets.',
    '- Answer briefly and to the point, in the user\'s language. After completing, report what exactly you did.',
    '- If a tool returned an error, explain it to the user and suggest how to fix it (often you need to enable External scripting = Local in Preferences).',
].join('\n');

const MAX_ITERATIONS = 12; // safety cap on tool round-trips per user message

// runTurn mutates `messages` in place (it is the persistent conversation history).
async function runTurn({ apiKey, model, messages, callbacks }) {
    const cb = callbacks || {};
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const assistant = await streamMessage({
            apiKey,
            model,
            system: SYSTEM,
            tools,
            messages,
            maxTokens: 8192,
            onText: cb.onText,
        });

        messages.push({ role: 'assistant', content: assistant.content });

        if (assistant.stop_reason !== 'tool_use') {
            return; // end_turn (or max_tokens / stop_sequence) — done
        }

        const toolUses = assistant.content.filter((b) => b.type === 'tool_use');
        const toolResults = [];
        for (const tu of toolUses) {
            if (cb.onToolUse) cb.onToolUse({ name: tu.name, input: tu.input });
            const res = await resolveTools.dispatch(tu.name, tu.input);
            if (cb.onToolResult) cb.onToolResult({ name: tu.name, is_error: res.is_error, content: res.content });
            toolResults.push({
                type: 'tool_result',
                tool_use_id: tu.id,
                content: res.content,
                is_error: res.is_error,
            });
        }

        messages.push({ role: 'user', content: toolResults });
        // loop: send tool results back to Claude
    }

    if (cb.onText) {
        cb.onText('\n\n(Reached the tool-step limit — stopping. Clarify the task if you want to continue.)');
    }
}

module.exports = { runTurn, SYSTEM };
