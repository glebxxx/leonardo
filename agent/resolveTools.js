// Tool action layer: each function maps a Claude tool call to concrete Resolve
// API calls and returns a *serializable* summary (never a raw Resolve object —
// those are native proxies and can't be JSON-encoded or sent back to Claude).

const R = require('../resolve/resolveClient');
const editHandlers = require('./editTools');
const uiHandlers = require('./uiTools');
const fusionHandlers = require('./fusionTools');
const audioHandlers = require('./audioTools');
const projectHandlers = require('./projectTools');
const mediaHandlers = require('./mediaTools');
const timelineIoHandlers = require('./timelineIoTools');
const colorHandlers = require('./colorTools');
const systemHandlers = require('./systemTools');

const PAGES = ['media', 'cut', 'edit', 'fusion', 'color', 'fairlight', 'deliver'];

async function open_page({ page }) {
    const resolve = await R.getResolve();
    if (!PAGES.includes(page)) {
        throw new Error(`Unknown page "${page}". Allowed: ${PAGES.join(', ')}.`);
    }
    if ((await resolve.GetCurrentPage()) !== page) {
        await resolve.OpenPage(page);
    }
    return { ok: true, page };
}

async function get_status() {
    const resolve = await R.getResolve();
    const page = await resolve.GetCurrentPage();
    const pm = await resolve.GetProjectManager();
    const project = pm ? await pm.GetCurrentProject() : null;
    if (!project) return { page, project: null };

    const projectName = await project.GetName();
    const timelineCount = await project.GetTimelineCount();
    let currentTimeline = null;
    const ct = await project.GetCurrentTimeline();
    if (ct) currentTimeline = await ct.GetName();
    return { page, project: projectName, timelineCount, currentTimeline };
}

async function list_projects() {
    const pm = await R.getProjectManager();
    const names = await pm.GetProjectListInCurrentFolder();
    return { projects: names || [] };
}

async function create_project({ name }) {
    const pm = await R.getProjectManager();
    const project = await pm.CreateProject(name);
    if (!project) throw new Error(`Failed to create project "${name}" (it may already exist).`);
    await pm.SaveProject();
    return { ok: true, project: name };
}

async function open_project({ name }) {
    const pm = await R.getProjectManager();
    const project = await pm.LoadProject(name);
    if (!project) throw new Error(`Failed to open project "${name}".`);
    return { ok: true, project: name };
}

async function create_bin({ name }) {
    const root = await R.getRootFolder();
    const mp = await R.getMediaPool();
    const bin = await mp.AddSubFolder(root, name);
    if (!bin) throw new Error(`Failed to create bin "${name}".`);
    await mp.SetCurrentFolder(bin);
    return { ok: true, bin: name, note: 'bin created and set as current' };
}

async function import_media({ file_paths }) {
    if (!Array.isArray(file_paths) || file_paths.length === 0) {
        throw new Error('file_paths is empty — provide absolute paths to media files.');
    }
    const resolve = await R.getResolve();
    const ms = await resolve.GetMediaStorage();
    if (!ms) throw new Error('Failed to get MediaStorage.');
    const items = await ms.AddItemListToMediaPool(file_paths);
    const imported = Array.isArray(items) ? items.length : items ? 1 : 0;
    if (!imported) throw new Error('Failed to import media — check the file paths.');
    return { ok: true, imported };
}

async function create_timeline_from_current_bin({ name }) {
    const mp = await R.getMediaPool();
    const folder = await mp.GetCurrentFolder();
    const clips = await folder.GetClipList();
    if (!clips || clips.length === 0) throw new Error('The current bin has no clips for a timeline.');
    const tl = await mp.CreateTimelineFromClips(name, clips);
    if (!tl) throw new Error(`Failed to create timeline "${name}".`);
    return { ok: true, timeline: name, clips: clips.length };
}

async function create_empty_timeline({ name }) {
    const mp = await R.getMediaPool();
    const tl = await mp.CreateEmptyTimeline(name);
    if (!tl) throw new Error(`Failed to create empty timeline "${name}".`);
    return { ok: true, timeline: name };
}

async function list_timelines() {
    const project = await R.getCurrentProject();
    const count = await project.GetTimelineCount();
    const timelines = [];
    for (let i = 1; i <= count; i++) {
        const t = await project.GetTimelineByIndex(i);
        if (t) timelines.push(await t.GetName());
    }
    return { timelines };
}

async function select_timeline({ name }) {
    const project = await R.getCurrentProject();
    const t = await R.getTimelineByName(project, name);
    if (!t) throw new Error(`Timeline "${name}" not found.`);
    await project.SetCurrentTimeline(t);
    return { ok: true, timeline: name };
}

async function add_timeline_marker({ frame, color, name, note }) {
    const project = await R.getCurrentProject();
    const tl = await project.GetCurrentTimeline();
    if (!tl) throw new Error('No active timeline.');
    const ok = await tl.AddMarker(frame || 0, color || 'Blue', name || 'Marker', note || '', 1);
    if (!ok) throw new Error('Failed to add marker (there may already be one on this frame).');
    return { ok: true, frame: frame || 0, color: color || 'Blue' };
}

async function get_render_presets() {
    const project = await R.getCurrentProject();
    const presets = await project.GetRenderPresets();
    // Depending on version this is an array or a {index: name} dict.
    const list = Array.isArray(presets) ? presets : presets ? Object.values(presets) : [];
    return { presets: list };
}

async function render_current_timeline({ preset_name, target_dir, clip_name }) {
    const project = await R.getCurrentProject();
    const tl = await project.GetCurrentTimeline();
    if (!tl) throw new Error('No active timeline to render.');
    if (!(await project.LoadRenderPreset(preset_name))) {
        throw new Error(`Render preset "${preset_name}" not found. Call get_render_presets first.`);
    }
    if (!(await project.SetRenderSettings({ TargetDir: target_dir, CustomName: clip_name }))) {
        throw new Error('Failed to apply render settings (TargetDir/CustomName).');
    }
    const jobId = await project.AddRenderJob();
    if (!jobId) throw new Error('Failed to add a render job to the queue.');
    await project.StartRendering(jobId);
    return { ok: true, jobId, output: `${target_dir}/${clip_name}` };
}

const HANDLERS = {
    open_page,
    get_status,
    list_projects,
    create_project,
    open_project,
    create_bin,
    import_media,
    create_timeline_from_current_bin,
    create_empty_timeline,
    list_timelines,
    select_timeline,
    add_timeline_marker,
    get_render_presets,
    render_current_timeline,
    ...editHandlers,
    ...uiHandlers,
    ...fusionHandlers,
    ...audioHandlers,
    ...projectHandlers,
    ...mediaHandlers,
    ...timelineIoHandlers,
    ...colorHandlers,
    ...systemHandlers,
};

// Dispatch a tool call. Never throws — failures come back as {is_error:true}
// so Claude can read the message and recover instead of the turn crashing.
async function dispatch(name, input) {
    const fn = HANDLERS[name];
    if (!fn) return { is_error: true, content: `Unknown tool: ${name}` };
    try {
        const result = await fn(input || {});
        return { is_error: false, content: JSON.stringify(result) };
    } catch (e) {
        return { is_error: true, content: `Error: ${e && e.message ? e.message : String(e)}` };
    }
}

module.exports = { dispatch, HANDLERS, PAGES };
