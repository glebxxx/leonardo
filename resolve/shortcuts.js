// DaVinci Resolve DEFAULT keyboard shortcuts (macOS default keymap), curated and
// cross-checked. Users can remap keys — if an action doesn't fire, fall back to
// run_menu_command (menu names are keymap-independent) or a precise API tool.
//
// `press` = params for uiAutomation.pressKey: { key? , special? , command?, shift?, option?, control? }
// `prefer:'api'` marks actions better done via a dedicated API tool (more precise).

const SHORTCUTS = [
    // --- Editing / cuts ---
    { action: 'Split Clip (blade at playhead)', keys: 'Cmd+\\', press: { key: '\\', command: true }, category: 'edit', aliases: ['разрезать', 'лезвие', 'razor', 'split', 'add edit', 'blade'], note: 'Or use the blade_at_playhead tool.' },
    { action: 'Add Transition (cross dissolve)', keys: 'Cmd+T', press: { key: 't', command: true }, category: 'edit', aliases: ['переход', 'кросс-диссолв', 'dissolve', 'transition'], note: 'Standard transition on the selected cut / under the playhead.' },
    { action: 'Insert edit', keys: 'F9', press: { special: 'f9' }, category: 'edit', aliases: ['вставить', 'insert'] },
    { action: 'Overwrite edit', keys: 'F10', press: { special: 'f10' }, category: 'edit', aliases: ['перезаписать', 'overwrite'] },
    { action: 'Replace edit', keys: 'F11', press: { special: 'f11' }, category: 'edit', aliases: ['заменить', 'replace'] },
    { action: 'Place on Top', keys: 'F12', press: { special: 'f12' }, category: 'edit', aliases: ['поверх', 'place on top'] },
    { action: 'Append at End', keys: 'Shift+F12', press: { special: 'f12', shift: true }, category: 'edit', aliases: ['в конец', 'append'] },
    { action: 'Ripple Delete', keys: 'Shift+Delete', press: { special: 'delete', shift: true }, category: 'edit', aliases: ['рипл удаление', 'ripple delete'], prefer: 'api', note: 'More precise via delete_clips({ripple:true}).' },
    { action: 'Delete (leave gap / lift)', keys: 'Delete', press: { special: 'delete' }, category: 'edit', aliases: ['удалить с зазором', 'lift'], prefer: 'api', note: 'More precise via delete_clips({ripple:false}).' },
    { action: 'Snapping toggle', keys: 'N', press: { key: 'n' }, category: 'edit', aliases: ['привязка', 'snap', 'snapping'] },
    { action: 'Nudge clip 1 frame right', keys: '.', press: { key: '.' }, category: 'edit', aliases: ['сдвинуть клип вправо'] },
    { action: 'Nudge clip 1 frame left', keys: ',', press: { key: ',' }, category: 'edit', aliases: ['сдвинуть клип влево'] },

    // --- Tools ---
    { action: 'Selection (arrow) tool', keys: 'A', press: { key: 'a' }, category: 'tools', aliases: ['стрелка', 'выбор', 'selection'] },
    { action: 'Blade (razor) tool', keys: 'B', press: { key: 'b' }, category: 'tools', aliases: ['лезвие инструмент', 'razor tool'] },
    { action: 'Trim Edit mode', keys: 'T', press: { key: 't' }, category: 'tools', aliases: ['трим режим', 'trim'] },
    { action: 'Dynamic Trim mode', keys: 'W', press: { key: 'w' }, category: 'tools', aliases: ['динамический трим', 'dynamic trim'] },

    // --- Markers / range ---
    { action: 'Mark In', keys: 'I', press: { key: 'i' }, category: 'marking', aliases: ['точка входа', 'mark in', 'in'] },
    { action: 'Mark Out', keys: 'O', press: { key: 'o' }, category: 'marking', aliases: ['точка выхода', 'mark out', 'out'] },
    { action: 'Clear In/Out', keys: 'Option+X', press: { key: 'x', option: true }, category: 'marking', aliases: ['сбросить in out', 'clear in out'] },
    { action: 'Add Marker', keys: 'M', press: { key: 'm' }, category: 'marking', aliases: ['маркер', 'marker'], prefer: 'api', note: 'More precise via add_timeline_marker.' },

    // --- Playback / navigation ---
    { action: 'Play / Stop', keys: 'Space', press: { special: 'space' }, category: 'playback', aliases: ['пуск', 'стоп', 'play', 'stop'] },
    { action: 'Play forward (JKL)', keys: 'L', press: { key: 'l' }, category: 'playback', aliases: ['вперёд'] },
    { action: 'Stop (JKL)', keys: 'K', press: { key: 'k' }, category: 'playback' },
    { action: 'Play reverse (JKL)', keys: 'J', press: { key: 'j' }, category: 'playback', aliases: ['назад'] },
    { action: 'Next edit', keys: 'Down', press: { special: 'down' }, category: 'playback', aliases: ['следующая склейка', 'next edit'] },
    { action: 'Previous edit', keys: 'Up', press: { special: 'up' }, category: 'playback', aliases: ['предыдущая склейка', 'previous edit'] },
    { action: 'One frame forward', keys: 'Right', press: { special: 'right' }, category: 'playback', aliases: ['кадр вперёд'] },
    { action: 'One frame back', keys: 'Left', press: { special: 'left' }, category: 'playback', aliases: ['кадр назад'] },

    // --- General / view ---
    { action: 'Undo', keys: 'Cmd+Z', press: { key: 'z', command: true }, category: 'general', aliases: ['отмена', 'назад undo'] },
    { action: 'Redo', keys: 'Cmd+Shift+Z', press: { key: 'z', command: true, shift: true }, category: 'general', aliases: ['повторить', 'redo'] },
    { action: 'Save Project', keys: 'Cmd+S', press: { key: 's', command: true }, category: 'general', aliases: ['сохранить', 'save'] },
    { action: 'Zoom to Fit timeline', keys: 'Shift+Z', press: { key: 'z', shift: true }, category: 'view', aliases: ['вписать таймлайн', 'zoom to fit', 'zoom fit'] },

    // --- Color page: nodes ---
    { action: 'Add Serial Node', keys: 'Option+S', press: { key: 's', option: true }, category: 'color', aliases: ['серийная нода', 'add serial node', 'нода'] },
    { action: 'Add Serial Node Before', keys: 'Shift+S', press: { key: 's', shift: true }, category: 'color', aliases: ['серийная нода до', 'serial before'] },
    { action: 'Add Parallel Node', keys: 'Option+P', press: { key: 'p', option: true }, category: 'color', aliases: ['параллельная нода', 'parallel node'] },
    { action: 'Add Layer Node', keys: 'Option+L', press: { key: 'l', option: true }, category: 'color', aliases: ['layer node', 'слой-нода'] },
    { action: 'Add Outside Node', keys: 'Option+O', press: { key: 'o', option: true }, category: 'color', aliases: ['outside node', 'внешняя нода', 'виньетка нода'] },
    { action: 'Grab Still', keys: 'Cmd+Option+G', press: { key: 'g', command: true, option: true }, category: 'color', aliases: ['взять стилл', 'grab still', 'снимок'] },
];

function norm(s) {
    return String(s || '').toLowerCase().trim();
}

function pub(s) {
    return { action: s.action, keys: s.keys, category: s.category, note: s.note, prefer: s.prefer };
}

// Search by free-text query over action / keys / aliases. Empty query → all.
function searchShortcuts(query) {
    const q = norm(query);
    if (!q) return SHORTCUTS.map(pub);
    return SHORTCUTS.filter(
        (s) => norm(s.action).includes(q) || norm(s.keys).includes(q) || (s.aliases || []).some((a) => norm(a).includes(q))
    ).map(pub);
}

// Resolve an action name/alias to its full entry (for press_shortcut by action).
function findShortcut(query) {
    const q = norm(query);
    let hit = SHORTCUTS.find((s) => norm(s.action) === q);
    if (!hit) hit = SHORTCUTS.find((s) => (s.aliases || []).some((a) => norm(a) === q));
    if (!hit) hit = SHORTCUTS.find((s) => norm(s.action).includes(q) || (s.aliases || []).some((a) => norm(a).includes(q)));
    return hit || null;
}

module.exports = { SHORTCUTS, searchShortcuts, findShortcut };
