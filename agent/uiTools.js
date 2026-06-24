// Universal UI-control tools — give Leonardo human-level control over Resolve for
// anything the scripting API does NOT expose (blade, edge-trim, transitions,
// arbitrary menu commands, keyboard shortcuts). All drive Resolve via macOS System
// Events and require Accessibility permission for DaVinci Resolve.

const ui = require('../resolve/uiAutomation');
const shortcuts = require('../resolve/shortcuts');

async function run_menu_command({ menu_path }) {
    if (!Array.isArray(menu_path) || menu_path.length < 2) {
        throw new Error('menu_path — an array of at least 2 levels, e.g. ["Playback","Play"].');
    }
    await ui.clickMenu(menu_path);
    return { ok: true, menu: menu_path.join(' › ') };
}

async function press_shortcut({ action, key, special, command, shift, option, control }) {
    let press;
    if (action) {
        const hit = shortcuts.findShortcut(action);
        if (!hit || !hit.press) {
            throw new Error(`No known shortcut for "${action}". Call lookup_shortcuts or specify key/special manually.`);
        }
        press = { ...hit.press };
    } else if (key != null || special != null) {
        press = { key, special, command, shift, option, control };
    } else {
        throw new Error('Specify action (the action name), or key/special with modifiers.');
    }

    const modifiers = [];
    if (press.command) modifiers.push('command');
    if (press.shift) modifiers.push('shift');
    if (press.option) modifiers.push('option');
    if (press.control) modifiers.push('control');

    await ui.pressKey({ key: press.key, special: press.special, modifiers });

    const label = (modifiers.length ? modifiers.join('+') + '+' : '') + (press.special || press.key || '');
    return { ok: true, pressed: label, via: action ? `action "${action}"` : 'keys' };
}

async function lookup_shortcuts({ query }) {
    const results = shortcuts.searchShortcuts(query || '');
    return { count: results.length, shortcuts: results };
}

async function list_menus({ menu_path } = {}) {
    const path = Array.isArray(menu_path) ? menu_path : [];
    const items = await ui.listMenus(path);
    return { path, count: items.length, items };
}

async function type_text({ text }) {
    if (text == null) throw new Error('Specify text.');
    await ui.typeText(text);
    return { ok: true, typed: text };
}

module.exports = { run_menu_command, press_shortcut, lookup_shortcuts, list_menus, type_text };
