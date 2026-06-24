// Fusion tools — attach/list/manage Fusion comps on timeline clips, insert
// Fusion titles/compositions. Verified against the Resolve 21 Scripting README.
// Returns only serializable summaries (never raw Resolve proxies).

const R = require('../resolve/resolveClient');

async function targetItem(tl, track_type, track_index, clip_index) {
    const item = clip_index != null
        ? await R.pickTimelineItem(tl, track_type, track_index, clip_index)
        : await tl.GetCurrentVideoItem();
    if (!item) throw new Error('No target clip (no clip under the playhead).');
    return item;
}

async function list_fusion_comps({ track_type, track_index, clip_index }) {
    const tl = await R.getCurrentTimeline();
    const item = await targetItem(tl, track_type, track_index, clip_index);
    const count = await item.GetFusionCompCount();
    const names = (await item.GetFusionCompNameList()) || [];
    return { clip: await item.GetName(), count, comps: names.map((n, i) => ({ index: i + 1, name: n })) };
}

async function add_fusion_comp({ name, track_type, track_index, clip_index }) {
    const tl = await R.getCurrentTimeline();
    const item = await targetItem(tl, track_type, track_index, clip_index);
    const before = (await item.GetFusionCompNameList()) || [];
    const comp = await item.AddFusionComp();
    if (!comp) throw new Error('AddFusionComp failed.');
    const after = (await item.GetFusionCompNameList()) || [];
    let newName = after.find((n) => !before.includes(n)) || after[after.length - 1];
    if (name && newName && name !== newName) {
        if (await item.RenameFusionCompByName(newName, name)) newName = name;
    }
    return { ok: true, clip: await item.GetName(), comp_name: newName, count: await item.GetFusionCompCount() };
}

async function manage_fusion_comp({ action, comp_name, new_name, path, track_type, track_index, clip_index }) {
    const tl = await R.getCurrentTimeline();
    const item = await targetItem(tl, track_type, track_index, clip_index);

    if (action === 'import') {
        if (!path) throw new Error('path is required.');
        const before = (await item.GetFusionCompNameList()) || [];
        const comp = await item.ImportFusionComp(path);
        if (!comp) throw new Error('ImportFusionComp returned null (bad path or format).');
        const after = (await item.GetFusionCompNameList()) || [];
        const added = after.find((n) => !before.includes(n)) || after[after.length - 1];
        return { ok: true, action, clip: await item.GetName(), comp_name: added, count: await item.GetFusionCompCount() };
    }

    const names = (await item.GetFusionCompNameList()) || [];
    if (!comp_name || !names.includes(comp_name)) throw new Error(`No comp named ${comp_name}.`);

    if (action === 'load') {
        if (!(await item.LoadFusionCompByName(comp_name))) throw new Error('load failed.');
        return { ok: true, action, comp_name };
    }
    if (action === 'rename') {
        if (!new_name) throw new Error('new_name is required.');
        if (!(await item.RenameFusionCompByName(comp_name, new_name))) throw new Error('rename failed.');
        return { ok: true, action, comp_name, new_name };
    }
    if (action === 'delete') {
        if (!(await item.DeleteFusionCompByName(comp_name))) throw new Error('delete failed.');
        return { ok: true, action, comp_name, count: await item.GetFusionCompCount() };
    }
    if (action === 'export') {
        if (!path) throw new Error('path is required.');
        const idx = names.indexOf(comp_name) + 1;
        if (!(await item.ExportFusionComp(path, idx))) throw new Error('export failed.');
        return { ok: true, action, comp_name, exported_path: path };
    }
    throw new Error(`Unknown action: ${action}.`);
}

async function insert_fusion_title({ title_name }) {
    if (!title_name) throw new Error('title_name is required, e.g. "Text+".');
    const tl = await R.getCurrentTimeline();
    const item = await tl.InsertFusionTitleIntoTimeline(title_name);
    if (!item) throw new Error('InsertFusionTitleIntoTimeline failed — check the Fusion title name.');
    return { ok: true, title: title_name, inserted_clip: await item.GetName() };
}

async function insert_fusion_composition() {
    const tl = await R.getCurrentTimeline();
    const item = await tl.InsertFusionCompositionIntoTimeline();
    if (!item) throw new Error('InsertFusionCompositionIntoTimeline failed.');
    return { ok: true, inserted_clip: await item.GetName(), start: await item.GetStart(), duration: await item.GetDuration() };
}

module.exports = { list_fusion_comps, add_fusion_comp, manage_fusion_comp, insert_fusion_title, insert_fusion_composition };
