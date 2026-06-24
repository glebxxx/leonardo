// Color & grading tools: ASC-CDL/LUT node primitives, UI node creation, a recipe
// orchestrator (grade_clip), color versions/groups/grade-copy, stills, stabilize,
// camera LOG detection + profile application. Verified against the Resolve 21
// Scripting README. Node CREATION is UI-only (API can't add nodes); grade VALUES
// go through SetCDL/SetLUT (API). Serializable returns only.

const fs = require('fs');
const path = require('path');
const R = require('../resolve/resolveClient');
const ui = require('../resolve/uiAutomation');
const C = require('../resolve/colorData');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const triple = (a, def) => (Array.isArray(a) ? a : a == null ? def : [a, a, a]).map((n) => Number(n).toFixed(4)).join(' ');

// ---------- grading primitives (API) ----------

async function apply_cdl_to_node({ node_index, slope, offset, power, saturation }) {
    const item = await R.getCurrentVideoItem();
    const num = await item.GetNumNodes();
    const idx = node_index || 1;
    if (idx < 1 || idx > num) throw new Error(`node_index ${idx} is out of range 1..${num}.`);
    const cdl = {
        NodeIndex: String(idx),
        Slope: triple(slope, [1, 1, 1]),
        Offset: triple(offset, [0, 0, 0]),
        Power: triple(power, [1, 1, 1]),
        Saturation: String(saturation == null ? 1 : saturation),
    };
    const ok = await item.SetCDL(cdl);
    return { ok: !!ok, node_index: idx, applied: { slope, offset, power, saturation } };
}

async function apply_lut_to_node({ node_index, lut_path, layer_index, refresh_lut }) {
    if (!lut_path) throw new Error('lut_path is required.');
    const project = await R.getCurrentProject();
    const item = await R.getCurrentVideoItem();
    if (refresh_lut) await project.RefreshLUTList();
    const graph = layer_index ? await item.GetNodeGraph(layer_index) : await item.GetNodeGraph();
    const num = await graph.GetNumNodes();
    const idx = node_index || 1;
    if (idx < 1 || idx > num) throw new Error(`node_index ${idx} is out of range 1..${num}.`);
    const ok = await graph.SetLUT(idx, lut_path);
    const applied = await graph.GetLUT(idx);
    return { ok: !!ok, node_index: idx, num_nodes: num, lut_path, applied_lut: applied || '' };
}

async function reset_grade() {
    const item = await R.getCurrentVideoItem();
    return { ok: !!(await item.ResetAllNodeColors()) };
}

async function set_node_enabled({ node_index, enabled }) {
    const item = await R.getCurrentVideoItem();
    const num = await item.GetNumNodes();
    const idx = node_index || 1;
    if (idx < 1 || idx > num) throw new Error(`node_index ${idx} is out of range 1..${num}.`);
    const on = enabled !== false;
    return { ok: !!(await item.SetNodeEnabled(idx, on)), node_index: idx, enabled: on };
}

async function get_node_info() {
    const item = await R.getCurrentVideoItem();
    const graph = await item.GetNodeGraph();
    const n = await graph.GetNumNodes();
    const nodes = [];
    for (let i = 1; i <= n; i++) {
        let label = '';
        let tools = [];
        try { label = await graph.GetNodeLabel(i); } catch (e) { /* ignore */ }
        try { tools = (await graph.GetToolsInNode(i)) || []; } catch (e) { /* ignore */ }
        nodes.push({ index: i, label, tools });
    }
    return { num_nodes: n, nodes };
}

function walkLuts(dir, base, out) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walkLuts(full, base, out);
        else if (/\.(cube|ilut|olut|dat|vlt)$/i.test(e.name)) out.push(path.relative(base, full));
    }
}

async function list_luts({ filter }) {
    const all = [];
    walkLuts(C.LUT_DIR, C.LUT_DIR, all);
    let luts = all.sort();
    if (filter) {
        const f = String(filter).toLowerCase();
        luts = luts.filter((l) => l.toLowerCase().includes(f));
    }
    return { count: luts.length, luts: luts.slice(0, 400) };
}

async function apply_powergrade({ drx_path, grade_mode }) {
    if (!drx_path) throw new Error('drx_path is required.');
    const item = await R.getCurrentVideoItem();
    const mode = grade_mode == null ? 0 : grade_mode;
    let ok;
    try {
        const graph = await item.GetNodeGraph();
        ok = await graph.ApplyGradeFromDRX(drx_path, mode);
    } catch (e) {
        try { ok = await item.ApplyGradeFromDRX(drx_path, mode, item); } catch (e2) { ok = await item.ApplyGradeFromDRX(drx_path, mode, [item]); }
    }
    return { ok: !!ok, drx_path, grade_mode: mode };
}

// ---------- node creation (UI automation) ----------

async function add_serial_node({ variant }) {
    const resolve = await R.getResolve();
    if ((await resolve.GetCurrentPage()) !== 'color') await resolve.OpenPage('color');
    const v = C.NODE_VARIANTS[variant || 'serial'] || C.NODE_VARIANTS.serial;
    const item = await R.getCurrentVideoItem();
    const before = await item.GetNumNodes();

    let method = 'shortcut';
    try { await ui.pressKey({ key: v.key, modifiers: v.modifiers }); } catch (e) { /* fall through */ }
    await sleep(350);
    let after = await item.GetNumNodes();
    if (after <= before) {
        try { await ui.clickMenu(v.menu); method = 'menu'; } catch (e) { /* ignore */ }
        await sleep(350);
        after = await item.GetNumNodes();
    }
    return { ok: after > before, variant: variant || 'serial', num_nodes: after, new_node_index: after, method };
}

// ---------- recipe orchestrator ----------

async function grade_clip({ look, intent, reset_first, strength }) {
    const resolve = await R.getResolve();
    if ((await resolve.GetCurrentPage()) !== 'color') await resolve.OpenPage('color');
    const recipe = C.findRecipe(look || intent || '') || C.findRecipe('clean');
    const s = strength == null ? 1 : Math.max(0, Math.min(2, strength));
    const item = await R.getCurrentVideoItem();
    if (reset_first) { try { await item.ResetAllNodeColors(); } catch (e) { /* ignore */ } }

    const scaleArr = (arr, neutral) => arr.map((v) => neutral + (v - neutral) * s);
    const scaleCdl = (c) => ({
        slope: scaleArr(c.slope, 1),
        offset: c.offset.map((o) => o * s),
        power: scaleArr(c.power, 1),
        saturation: 1 + (c.saturation - 1) * s,
    });

    let built = await item.GetNumNodes();
    let addFailed = false;
    const applied = [];
    for (let i = 0; i < recipe.nodes.length; i++) {
        const node = recipe.nodes[i];
        let idx;
        if (i < built) {
            idx = i + 1;
        } else {
            const r = await add_serial_node({ variant: node.variant || 'serial' });
            if (r.ok && r.num_nodes > built) {
                built = r.num_nodes;
                idx = built;
            } else {
                addFailed = true;
                idx = built;
            }
        }
        const cdl = scaleCdl(node.cdl);
        try { await apply_cdl_to_node({ node_index: idx, ...cdl }); } catch (e) { /* ignore */ }
        if (node.lut) { try { await apply_lut_to_node({ node_index: idx, lut_path: node.lut }); } catch (e) { /* ignore */ } }
        applied.push({ index: idx, label: node.label, lut: node.lut || null });
    }

    const manual_steps = recipe.nodes.filter((n) => n.manual_note).map((n) => `[${n.label}] ${n.manual_note}`);
    if (addFailed) {
        manual_steps.unshift('Not all nodes could be created automatically (requires focus on the Color page + Accessibility permission). Create the missing nodes manually (Option+S) and retry if needed.');
    }
    return { ok: true, look: recipe.look, summary: recipe.summary, strength: s, nodes_built: applied.length, applied, manual_steps };
}

async function list_grade_recipes() {
    return {
        count: C.RECIPES.length,
        recipes: C.RECIPES.map((r) => ({ look: r.look, aliases: r.aliases, summary: r.summary, nodes: r.nodes.length })),
    };
}

// ---------- color versions / groups / grade copy (API-expansion) ----------

async function manage_color_versions({ action, version_name, new_name, version_type }) {
    const item = await R.getCurrentVideoItem();
    const vt = version_type == null ? 0 : version_type;
    switch (action) {
        case 'list':
            return { versions: (await item.GetVersionNameList(vt)) || [], version_type: vt };
        case 'current':
            return { current: await item.GetCurrentVersion() };
        case 'add':
            if (!version_name) throw new Error('version_name is required.');
            return { ok: !!(await item.AddVersion(version_name, vt)), versions: (await item.GetVersionNameList(vt)) || [] };
        case 'load':
            if (!version_name) throw new Error('version_name is required.');
            return { ok: !!(await item.LoadVersionByName(version_name, vt)), current: await item.GetCurrentVersion() };
        case 'rename':
            if (!version_name || !new_name) throw new Error('version_name and new_name are required.');
            return { ok: !!(await item.RenameVersionByName(version_name, new_name, vt)), versions: (await item.GetVersionNameList(vt)) || [] };
        case 'delete':
            if (!version_name) throw new Error('version_name is required.');
            return { ok: !!(await item.DeleteVersionByName(version_name, vt)), versions: (await item.GetVersionNameList(vt)) || [] };
        default:
            throw new Error(`Unknown action: ${action}.`);
    }
}

async function manage_color_group({ action, group_name, new_name, assign_scope, track_index }) {
    const tl = await R.getCurrentTimeline();
    const groups = async () => (await tl.GetColorGroupsList()) || [];
    const findGroup = async (name) => {
        for (const g of await groups()) if ((await g.GetName()) === name) return g;
        return null;
    };
    const listNames = async () => {
        const out = [];
        for (const g of await groups()) out.push({ name: await g.GetName(), clip_count: ((await g.GetClipsInTimeline()) || []).length });
        return out;
    };
    switch (action) {
        case 'list':
            return { groups: await listNames() };
        case 'create':
            if (!group_name) throw new Error('group_name is required.');
            return { ok: !!(await tl.AddColorGroup(group_name)), groups: await listNames() };
        case 'assign': {
            const g = await findGroup(group_name);
            if (!g) throw new Error(`Group "${group_name}" not found.`);
            const items = (assign_scope || 'current') === 'track' ? (await tl.GetItemListInTrack('video', track_index || 1)) || [] : [await tl.GetCurrentVideoItem()];
            let n = 0;
            for (const it of items) if (it && (await it.AssignToColorGroup(g))) n++;
            return { ok: n > 0, assigned: n };
        }
        case 'remove': {
            const it = await tl.GetCurrentVideoItem();
            return { ok: !!(await it.RemoveFromColorGroup()) };
        }
        case 'rename': {
            const g = await findGroup(group_name);
            if (!g) throw new Error('Group not found.');
            return { ok: !!(await g.SetName(new_name)), groups: await listNames() };
        }
        case 'delete': {
            const g = await findGroup(group_name);
            if (!g) throw new Error('Group not found.');
            return { ok: !!(await tl.DeleteColorGroup(g)), groups: await listNames() };
        }
        default:
            throw new Error(`Unknown action: ${action}.`);
    }
}

async function copy_grade_to_clips({ scope, track_index, clip_names, include_source }) {
    const tl = await R.getCurrentTimeline();
    const src = await tl.GetCurrentVideoItem();
    const srcId = await src.GetUniqueId();
    let targets;
    if (scope === 'track') {
        targets = (await tl.GetItemListInTrack('video', track_index || 1)) || [];
    } else {
        const wanted = new Set(clip_names || []);
        targets = [];
        const tc = await tl.GetTrackCount('video');
        for (let i = 1; i <= tc; i++) {
            for (const it of (await tl.GetItemListInTrack('video', i)) || []) {
                if (wanted.has(await it.GetName())) targets.push(it);
            }
        }
    }
    if (!include_source) {
        const filtered = [];
        for (const it of targets) if ((await it.GetUniqueId()) !== srcId) filtered.push(it);
        targets = filtered;
    }
    if (!targets.length) throw new Error('No target clips.');
    const ok = await src.CopyGrades(targets);
    const names = [];
    for (const t of targets) names.push(await t.GetName());
    return { ok: !!ok, copied_count: ok ? targets.length : 0, target_names: names };
}

async function export_clip_lut({ path: outPath, size }) {
    if (!outPath) throw new Error('path is required.');
    const resolve = await R.getResolve();
    const item = await R.getCurrentVideoItem();
    const map = { '17': resolve.EXPORT_LUT_17PTCUBE, '33': resolve.EXPORT_LUT_33PTCUBE, '65': resolve.EXPORT_LUT_65PTCUBE, vlut: resolve.EXPORT_LUT_PANASONICVLUT };
    const exportType = map[String(size || '33').toLowerCase()];
    if (exportType === undefined) throw new Error(`Invalid size "${size}" (17|33|65|vlut).`);
    const ok = await item.ExportLUT(exportType, outPath);
    return { ok: !!ok, path: outPath, size: size || '33' };
}

async function stabilize_clip({ smart_reframe }) {
    const item = await R.getCurrentVideoItem();
    const stabilized = await item.Stabilize();
    let reframed;
    if (smart_reframe) {
        reframed = await item.SmartReframe();
        if (!reframed) {
            return { ok: false, stabilized: !!stabilized, smart_reframe: false, clip: await item.GetName(), error: 'SmartReframe returned False — requires DaVinci Resolve Studio with the AI Extras loaded.' };
        }
    }
    return { ok: !!stabilized, stabilized: !!stabilized, smart_reframe: smart_reframe ? !!reframed : undefined, clip: await item.GetName() };
}

async function grab_timeline_stills({ scope, still_frame_source, export_folder, file_prefix, format }) {
    const tl = await R.getCurrentTimeline();
    let stills;
    if (scope === 'current') {
        const s = await tl.GrabStill();
        stills = s ? [s] : [];
    } else {
        const src = still_frame_source === 'middle' ? 2 : 1;
        stills = (await tl.GrabAllStills(src)) || [];
    }
    let exported = false;
    const fmt = format || 'png';
    const ALLOWED = ['dpx', 'cin', 'tif', 'jpg', 'png', 'ppm', 'bmp', 'xpm', 'drx'];
    if (export_folder && stills.length) {
        if (!ALLOWED.includes(fmt)) throw new Error(`Unsupported format "${fmt}".`);
        const gallery = await R.getGallery();
        const album = await gallery.GetCurrentStillAlbum();
        exported = !!(await album.ExportStills(stills, export_folder, file_prefix || 'still', fmt));
    }
    return { scope, grabbed_count: stills.length, exported, export_folder: export_folder || null, format: export_folder ? fmt : null };
}

// ---------- camera detection + LOG profile ----------

async function detect_camera({ clip_name }) {
    let mp;
    if (clip_name) {
        mp = await R.getCurrentFolderClipByName(clip_name);
        if (!mp) throw new Error(`Clip "${clip_name}" not found in the current bin.`);
    } else {
        const ti = await R.getCurrentVideoItem();
        mp = await ti.GetMediaPoolItem();
        if (!mp) throw new Error('No media pool item for the current clip.');
    }
    const name = await mp.GetName();
    const meta = (await mp.GetMetadata()) || {};
    const props = (await mp.GetClipProperty()) || {};
    const camera_fields = {};
    for (const k of Object.keys(meta)) {
        if (/camera|make|model|manufact|gamma|gamut|color|lens|notes/i.test(k)) camera_fields[k] = meta[k];
    }
    const file = props['File Name'] || props['Clip Name'] || name || '';
    const filePath = props['File Path'] || file;
    const codec = props['Video Codec'] || props['Format'] || null;
    const blob = [name, file, filePath, codec, ...Object.values(camera_fields)].join(' ');
    const ext = String(filePath).slice(String(filePath).lastIndexOf('.')).toLowerCase();
    const detected = C.detectProfile(blob, ext);
    return { clip: name, file, codec, camera_fields, detected };
}

async function apply_log_profile({ clip_name, profile, method, node_index }) {
    const ti = await R.getCurrentVideoItem();
    let prof = profile ? C.getProfile(profile) : null;
    if (!prof) {
        const det = await detect_camera({ clip_name });
        if (det.detected) prof = C.getProfile(det.detected.key);
    }
    if (!prof) {
        throw new Error('Could not determine the camera/profile. Specify a profile (sony_slog3, sony_slog2, panasonic_vlog, arri_logc, canon_clog, red_log3g10, bmd_film_gen5, dji_dlog, fujifilm_flog, nikon_nlog) or call detect_camera.');
    }
    const m = method || (prof.lut ? 'lut' : 'colorspace');

    if (m === 'lut') {
        if (!prof.lut) throw new Error(`No conversion LUT in the library for ${prof.label} — use method="colorspace".`);
        const graph = await ti.GetNodeGraph();
        const idx = node_index || 1;
        const ok = await graph.SetLUT(idx, prof.lut);
        const applied = await graph.GetLUT(idx);
        return { ok: !!ok, profile: prof.key, label: prof.label, method: 'lut', node_index: idx, lut: prof.lut, applied_lut: applied || '' };
    }

    const mp = clip_name ? await R.getCurrentFolderClipByName(clip_name) : await ti.GetMediaPoolItem();
    if (!mp) throw new Error('No media pool item.');
    const ok = await mp.SetClipProperty('Input Color Space', prof.input_color_space);
    const applied = await mp.GetClipProperty('Input Color Space');
    return {
        ok: !!ok,
        profile: prof.key,
        label: prof.label,
        method: 'colorspace',
        input_color_space: prof.input_color_space,
        applied,
        note: ok ? undefined : 'Did not apply — enable DaVinci Color Management (Project Settings → Color Management → Color science = DaVinci YRGB Color Managed) and check the color space name.',
    };
}

module.exports = {
    apply_cdl_to_node,
    apply_lut_to_node,
    reset_grade,
    set_node_enabled,
    get_node_info,
    list_luts,
    apply_powergrade,
    add_serial_node,
    grade_clip,
    list_grade_recipes,
    manage_color_versions,
    manage_color_group,
    copy_grade_to_clips,
    export_clip_lut,
    stabilize_clip,
    grab_timeline_stills,
    detect_camera,
    apply_log_profile,
};
