// Low-level access to the DaVinci Resolve scripting object.
// Loads the native WorkflowIntegration.node addon (must sit in the plugin root),
// initializes it once with the PLUGIN_ID, caches the Resolve handle, and exposes
// small async accessors. All Resolve APIs are promise-based in Resolve 20.1+/21,
// so everything is awaited.

const path = require('path');
const { PLUGIN_ID } = require('../pluginConfig');

// The native addon ships with your installed Resolve version and is copied into
// the plugin root by install.sh.
const WorkflowIntegration = require('../WorkflowIntegration.node');

let resolveObj = null;

const SCRIPTING_HINT =
    'Failed to connect to DaVinci Resolve. Check that: ' +
    '(1) the panel is open inside Resolve via Workspace > Workflow Integrations, ' +
    '(2) in Preferences > General, "External scripting using" is set to Local.';

async function initResolveInterface() {
    const ok = await WorkflowIntegration.Initialize(PLUGIN_ID);
    if (!ok) return null;
    return await WorkflowIntegration.GetResolve();
}

async function getResolve() {
    if (!resolveObj) {
        resolveObj = await initResolveInterface();
    }
    if (!resolveObj) {
        throw new Error(SCRIPTING_HINT);
    }
    return resolveObj;
}

async function getProjectManager() {
    const r = await getResolve();
    const pm = await r.GetProjectManager();
    if (!pm) throw new Error('Failed to get ProjectManager.');
    return pm;
}

async function getCurrentProject() {
    const pm = await getProjectManager();
    const p = await pm.GetCurrentProject();
    if (!p) throw new Error('No project open in Resolve.');
    return p;
}

async function getMediaPool() {
    const p = await getCurrentProject();
    const mp = await p.GetMediaPool();
    if (!mp) throw new Error('Failed to get MediaPool.');
    return mp;
}

async function getRootFolder() {
    const mp = await getMediaPool();
    return await mp.GetRootFolder();
}

async function getFolderByName(rootBin, name) {
    if (!rootBin) return null;
    const list = await rootBin.GetSubFolderList();
    if (!list || list.length === 0) return null;
    for (const folder of list) {
        if ((await folder.GetName()) === name) return folder;
    }
    return null;
}

async function getTimelineByName(project, name) {
    const count = await project.GetTimelineCount();
    if (!count) return null;
    for (let i = 1; i <= count; i++) {
        const t = await project.GetTimelineByIndex(i);
        if (t && (await t.GetName()) === name) return t;
    }
    return null;
}

async function getCurrentTimeline() {
    const project = await getCurrentProject();
    const tl = await project.GetCurrentTimeline();
    if (!tl) throw new Error('No active timeline in the project.');
    return tl;
}

async function getCurrentFolderClipByName(name) {
    const mp = await getMediaPool();
    const folder = await mp.GetCurrentFolder();
    const clips = await folder.GetClipList();
    if (!clips) return null;
    for (const c of clips) {
        if ((await c.GetName()) === name) return c;
    }
    return null;
}

async function getCurrentVideoItem() {
    const tl = await getCurrentTimeline();
    const item = await tl.GetCurrentVideoItem();
    if (!item) throw new Error('No video clip under the playhead (an active clip on the timeline is required).');
    return item;
}

async function getGallery() {
    const p = await getCurrentProject();
    const g = await p.GetGallery();
    if (!g) throw new Error('Failed to get Gallery.');
    return g;
}

// Resolve a single TimelineItem by track_type/track_index/clip_index (all 1-based).
async function pickTimelineItem(tl, trackType, trackIndex, clipIndex) {
    const TT = ['video', 'audio', 'subtitle'];
    const tt = (trackType || 'video').toLowerCase();
    if (!TT.includes(tt)) throw new Error(`track_type must be one of: ${TT.join(', ')}.`);
    const ti = trackIndex || 1;
    const items = (await tl.GetItemListInTrack(tt, ti)) || [];
    const it = items[(clipIndex || 1) - 1];
    if (!it) throw new Error(`Track ${tt} ${ti} has no clip with index ${clipIndex || 1}.`);
    return it;
}

async function cleanup() {
    try {
        WorkflowIntegration.CleanUp();
    } catch (e) {
        /* ignore */
    }
    resolveObj = null;
}

module.exports = {
    getResolve,
    getProjectManager,
    getCurrentProject,
    getMediaPool,
    getRootFolder,
    getFolderByName,
    getTimelineByName,
    getCurrentTimeline,
    getCurrentFolderClipByName,
    getCurrentVideoItem,
    getGallery,
    pickTimelineItem,
    cleanup,
};
