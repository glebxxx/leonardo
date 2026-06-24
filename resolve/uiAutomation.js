// Best-effort UI automation for operations the Resolve scripting API does NOT
// expose (notably blade/split at the playhead). Drives Resolve via AppleScript
// System Events keystrokes. Requires macOS Accessibility permission for DaVinci
// Resolve (System Settings → Privacy & Security → Accessibility).

const { exec } = require('child_process');

function runOsa(appleScript) {
    return new Promise((resolve, reject) => {
        const child = exec('osascript', { timeout: 9000 }, (err, stdout, stderr) => {
            if (err) {
                const msg = (stderr || err.message || '').trim();
                if (/assistive|accessibility|-?25211|1002/i.test(msg)) {
                    return reject(
                        new Error(
                            'No permission to control the keyboard. System Settings → Privacy & Security → ' +
                                'Accessibility → enable DaVinci Resolve, then try again.'
                        )
                    );
                }
                return reject(new Error(msg || 'osascript error'));
            }
            resolve((stdout || '').trim());
        });
        child.stdin.write(appleScript);
        child.stdin.end();
    });
}

// Send a single-character keystroke with optional modifiers to Resolve.
// modifiers: subset of ['command', 'shift', 'option', 'control'].
async function sendResolveKey(key, modifiers = []) {
    const using = modifiers.length
        ? ' using {' + modifiers.map((m) => m + ' down').join(', ') + '}'
        : '';
    const k = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = [
        'tell application "DaVinci Resolve" to activate',
        'delay 0.25',
        'tell application "System Events"',
        '    keystroke "' + k + '"' + using,
        'end tell',
    ].join('\n');
    return runOsa(script);
}

function asStr(s) {
    return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// Click any menu item by path, e.g. ["Timeline", "Add Transition", "Cross Dissolve"].
// System Events opens each submenu as needed; gives access to anything in the menu bar.
async function clickMenu(path) {
    if (!Array.isArray(path) || path.length < 2) {
        throw new Error('menu_path must contain at least 2 levels, for example ["Playback","Play"].');
    }
    const L = path.length;
    let expr = 'menu item ' + asStr(path[L - 1]);
    for (let j = L - 2; j >= 1; j--) {
        expr += ' of menu ' + asStr(path[j]) + ' of menu item ' + asStr(path[j]);
    }
    expr += ' of menu ' + asStr(path[0]) + ' of menu bar item ' + asStr(path[0]) + ' of menu bar 1';
    const script = [
        'tell application "DaVinci Resolve" to activate',
        'delay 0.2',
        'tell application "System Events"',
        '    tell (first application process whose frontmost is true)',
        '        click ' + expr,
        '    end tell',
        'end tell',
    ].join('\n');
    return runOsa(script);
}

const KEYCODES = {
    delete: 51, backspace: 51, forwarddelete: 117, return: 36, enter: 36,
    escape: 53, esc: 53, space: 49, tab: 48, left: 123, right: 124, up: 126,
    down: 125, home: 115, end: 119, pageup: 116, pagedown: 121,
    f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100,
    f9: 101, f10: 109, f11: 103, f12: 111,
};

// Press an arbitrary shortcut: a character `key` or a named `special` key,
// with any modifiers (subset of command/shift/option/control).
async function pressKey({ key, special, modifiers = [] }) {
    const using = modifiers.length ? ' using {' + modifiers.map((m) => m + ' down').join(', ') + '}' : '';
    let action;
    if (special) {
        const code = KEYCODES[String(special).toLowerCase()];
        if (code == null) throw new Error('Unknown special key: ' + special);
        action = 'key code ' + code + using;
    } else if (key != null && String(key).length) {
        action = 'keystroke "' + String(key).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' + using;
    } else {
        throw new Error('You must specify key or special.');
    }
    const script = [
        'tell application "DaVinci Resolve" to activate',
        'delay 0.2',
        'tell application "System Events"',
        '    ' + action,
        'end tell',
    ].join('\n');
    return runOsa(script);
}

// Type a string of text (e.g. into a focused field, search box, or rename).
async function typeText(text) {
    const t = String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = [
        'tell application "DaVinci Resolve" to activate',
        'delay 0.2',
        'tell application "System Events" to keystroke "' + t + '"',
    ].join('\n');
    return runOsa(script);
}

// Read the LIVE menu structure of the running Resolve (accurate to the installed
// version and UI language). path=[] -> top menu bar names; path=["Timeline"] ->
// items of the Timeline menu; path=["Timeline","Add Transition"] -> its submenu.
async function listMenus(path = []) {
    let collection;
    if (!path.length) {
        collection = 'name of every menu bar item of menu bar 1';
    } else {
        let expr = 'menu ' + asStr(path[0]) + ' of menu bar item ' + asStr(path[0]) + ' of menu bar 1';
        for (let j = 1; j < path.length; j++) {
            expr = 'menu ' + asStr(path[j]) + ' of menu item ' + asStr(path[j]) + ' of ' + expr;
        }
        collection = 'name of every menu item of ' + expr;
    }
    const script = [
        'tell application "DaVinci Resolve" to activate',
        'delay 0.2',
        'tell application "System Events"',
        '    tell (first application process whose frontmost is true)',
        '        set theNames to ' + collection,
        '    end tell',
        'end tell',
        'set outNames to {}',
        'repeat with n in theNames',
        '    if n is not missing value then set end of outNames to (n as text)',
        'end repeat',
        "set AppleScript's text item delimiters to linefeed",
        'return outNames as text',
    ].join('\n');
    const out = await runOsa(script);
    return out
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
}

module.exports = { runOsa, sendResolveKey, clickMenu, pressKey, typeText, listMenus };
