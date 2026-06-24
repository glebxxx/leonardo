// Timeline-editing tool handlers (trim-on-insert, ripple/lift delete, tracks,
// scene-cut, compound, clip color, titles, playhead) + a UI-automation blade.
// Verified against the Resolve 21 Scripting README on this machine.
// Each handler returns a serializable summary (never a raw Resolve proxy object).

const R = require('../resolve/resolveClient');
const ui = require('../resolve/uiAutomation');

const TRACK_TYPES = ['video', 'audio', 'subtitle'];

function normTrack(track_type) {
    const t = (track_type || 'video').toLowerCase();
    if (!TRACK_TYPES.includes(t)) {
        throw new Error(`track_type must be one of: ${TRACK_TYPES.join(', ')}.`);
    }
    return t;
}

async function itemsInTrack(tl, trackType, trackIndex) {
    const items = await tl.GetItemListInTrack(trackType, trackIndex);
    return items || [];
}

async function pickItems(tl, trackType, trackIndex, clipIndices) {
    const items = await itemsInTrack(tl, trackType, trackIndex);
    const out = [];
    for (const idx of clipIndices) {
        const it = items[idx - 1];
        if (!it) throw new Error(`Track ${trackType} ${trackIndex} has no clip at index ${idx}.`);
        out.push(it);
    }
    return out;
}

async function list_timeline_clips({ track_type, track_index }) {
    const tl = await R.getCurrentTimeline();
    const tt = normTrack(track_type);
    const ti = track_index || 1;
    const items = await itemsInTrack(tl, tt, ti);
    const clips = [];
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        clips.push({
            index: i + 1,
            name: await it.GetName(),
            start: await it.GetStart(),
            end: await it.GetEnd(),
            duration: await it.GetDuration(),
            source_start: await it.GetSourceStartFrame(),
            source_end: await it.GetSourceEndFrame(),
        });
    }
    return { track: `${tt} ${ti}`, count: clips.length, clips };
}

async function get_playhead() {
    const tl = await R.getCurrentTimeline();
    const tc = await tl.GetCurrentTimecode();
    let current = null;
    const v = await tl.GetCurrentVideoItem();
    if (v) current = await v.GetName();
    return { timecode: tc, current_clip: current };
}

async function set_playhead({ timecode }) {
    const tl = await R.getCurrentTimeline();
    const ok = await tl.SetCurrentTimecode(timecode);
    if (!ok) throw new Error(`Could not move the playhead to ${timecode} (format HH:MM:SS:FF).`);
    return { ok: true, timecode };
}

async function delete_clips({ track_type, track_index, clip_indices, ripple }) {
    if (!Array.isArray(clip_indices) || clip_indices.length === 0) {
        throw new Error('Provide clip_indices — a list of 1-based indices (see list_timeline_clips).');
    }
    const tl = await R.getCurrentTimeline();
    const tt = normTrack(track_type);
    const ti = track_index || 1;
    const targets = await pickItems(tl, tt, ti, clip_indices);
    const doRipple = ripple !== false; // ripple delete by default
    const ok = await tl.DeleteClips(targets, doRipple);
    if (!ok) throw new Error('Resolve could not delete the clips.');
    return { ok: true, deleted: targets.length, ripple: doRipple };
}

async function append_clip({ clip_name, source_start, source_end, track_index, record_frame, media_type }) {
    const mp = await R.getMediaPool();
    const item = await R.getCurrentFolderClipByName(clip_name);
    if (!item) {
        throw new Error(`Clip "${clip_name}" not found in the current bin. Run import_media first or select the right bin.`);
    }
    const clipInfo = { mediaPoolItem: item };
    if (source_start != null) clipInfo.startFrame = source_start;
    if (source_end != null) clipInfo.endFrame = source_end;
    if (track_index != null) clipInfo.trackIndex = track_index;
    if (record_frame != null) clipInfo.recordFrame = record_frame;
    if (media_type != null) clipInfo.mediaType = media_type;
    const appended = await mp.AppendToTimeline([clipInfo]);
    if (!appended || appended.length === 0) throw new Error('Could not add the clip to the timeline.');
    return { ok: true, clip: clip_name, source_start, source_end };
}

async function add_track({ track_type }) {
    const tl = await R.getCurrentTimeline();
    const tt = normTrack(track_type);
    const ok = await tl.AddTrack(tt);
    if (!ok) throw new Error(`Could not add a ${tt} track.`);
    return { ok: true, added: tt, count: await tl.GetTrackCount(tt) };
}

async function delete_track({ track_type, track_index }) {
    if (track_index == null) throw new Error('Provide track_index.');
    const tl = await R.getCurrentTimeline();
    const tt = normTrack(track_type);
    const ok = await tl.DeleteTrack(tt, track_index);
    if (!ok) throw new Error(`Could not delete track ${tt} ${track_index}.`);
    return { ok: true, deleted: `${tt} ${track_index}` };
}

async function set_track_enabled({ track_type, track_index, enabled }) {
    const tl = await R.getCurrentTimeline();
    const tt = normTrack(track_type);
    const ti = track_index || 1;
    const on = enabled !== false;
    const ok = await tl.SetTrackEnable(tt, ti, on);
    if (!ok) throw new Error('Could not change track visibility.');
    return { ok: true, track: `${tt} ${ti}`, enabled: on };
}

async function set_track_locked({ track_type, track_index, locked }) {
    const tl = await R.getCurrentTimeline();
    const tt = normTrack(track_type);
    const ti = track_index || 1;
    const lock = locked === true;
    const ok = await tl.SetTrackLock(tt, ti, lock);
    if (!ok) throw new Error('Could not change track lock.');
    return { ok: true, track: `${tt} ${ti}`, locked: lock };
}

async function detect_scene_cuts() {
    const tl = await R.getCurrentTimeline();
    const ok = await tl.DetectSceneCuts();
    if (!ok) throw new Error('DetectSceneCuts returned False (video footage is required on the timeline).');
    return { ok: true, note: 'The timeline was automatically split by detected cuts.' };
}

async function create_compound_clip({ track_type, track_index, clip_indices, name }) {
    if (!Array.isArray(clip_indices) || clip_indices.length === 0) {
        throw new Error('Provide clip_indices.');
    }
    const tl = await R.getCurrentTimeline();
    const tt = normTrack(track_type);
    const ti = track_index || 1;
    const targets = await pickItems(tl, tt, ti, clip_indices);
    const compound = await tl.CreateCompoundClip(targets, name ? { name } : {});
    if (!compound) throw new Error('Could not create the compound clip.');
    return { ok: true, name: name || (await compound.GetName()) };
}

async function set_clip_color({ track_type, track_index, clip_index, color }) {
    const tl = await R.getCurrentTimeline();
    const tt = normTrack(track_type);
    const ti = track_index || 1;
    const [it] = await pickItems(tl, tt, ti, [clip_index || 1]);
    const ok = await it.SetClipColor(color);
    if (!ok) throw new Error(`Could not set color "${color}".`);
    return { ok: true, clip: await it.GetName(), color };
}

async function add_title({ title_name }) {
    const tl = await R.getCurrentTimeline();
    const item = await tl.InsertTitleIntoTimeline(title_name || 'Text');
    if (!item) throw new Error(`Could not insert title "${title_name}". Check the title name (e.g. "Text").`);
    return { ok: true, title: title_name || 'Text' };
}

async function set_timeline_start_timecode({ timecode }) {
    const tl = await R.getCurrentTimeline();
    const ok = await tl.SetStartTimecode(timecode);
    if (!ok) throw new Error(`Could not set the start timecode ${timecode}.`);
    return { ok: true, start_timecode: timecode };
}

// --- UI automation: the API can't cut a clip at an arbitrary playhead position ---
async function blade_at_playhead() {
    const resolve = await R.getResolve();
    if ((await resolve.GetCurrentPage()) !== 'edit') await resolve.OpenPage('edit');
    // Resolve default: Split Clip at playhead = Cmd+\
    await ui.sendResolveKey('\\', ['command']);
    return {
        ok: true,
        note: 'Sent the Split Clip command (Cmd+\\) at the current playhead. If nothing was cut, you need Accessibility permission and focus on the timeline.',
    };
}

module.exports = {
    list_timeline_clips,
    get_playhead,
    set_playhead,
    delete_clips,
    append_clip,
    add_track,
    delete_track,
    set_track_enabled,
    set_track_locked,
    detect_scene_cuts,
    create_compound_clip,
    set_clip_color,
    add_title,
    set_timeline_start_timecode,
    blade_at_playhead,
};
