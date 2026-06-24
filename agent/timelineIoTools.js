// Timeline I/O: export to NLE interchange formats, markers (list/bulk-delete),
// timeline settings, duplicate, AI subtitles. Verified against the Resolve 21
// Scripting README. EXPORT_*/SUBTITLE_*/AUTO_CAPTION_* constants live on the
// top-level resolve handle. Serializable returns only.

const R = require('../resolve/resolveClient');

async function resolveTimeline(timeline_name) {
    if (timeline_name) {
        const tl = await R.getTimelineByName(await R.getCurrentProject(), timeline_name);
        if (!tl) throw new Error(`Timeline "${timeline_name}" not found.`);
        return tl;
    }
    return R.getCurrentTimeline();
}

const EXPORT_FMT = {
    AAF: 'EXPORT_AAF', DRT: 'EXPORT_DRT', EDL: 'EXPORT_EDL',
    FCP_7_XML: 'EXPORT_FCP_7_XML', FCPXML_1_8: 'EXPORT_FCPXML_1_8',
    FCPXML_1_9: 'EXPORT_FCPXML_1_9', FCPXML_1_10: 'EXPORT_FCPXML_1_10',
    OTIO: 'EXPORT_OTIO', ALE: 'EXPORT_ALE', ALE_CDL: 'EXPORT_ALE_CDL',
    TEXT_CSV: 'EXPORT_TEXT_CSV', TEXT_TAB: 'EXPORT_TEXT_TAB',
    HDR_10_PROFILE_A: 'EXPORT_HDR_10_PROFILE_A', HDR_10_PROFILE_B: 'EXPORT_HDR_10_PROFILE_B',
    DOLBY_VISION_VER_2_9: 'EXPORT_DOLBY_VISION_VER_2_9',
    DOLBY_VISION_VER_4_0: 'EXPORT_DOLBY_VISION_VER_4_0',
    DOLBY_VISION_VER_5_1: 'EXPORT_DOLBY_VISION_VER_5_1',
};
const EXPORT_SUB = {
    AAF_NEW: 'EXPORT_AAF_NEW', AAF_EXISTING: 'EXPORT_AAF_EXISTING',
    CDL: 'EXPORT_CDL', SDL: 'EXPORT_SDL', MISSING_CLIPS: 'EXPORT_MISSING_CLIPS', NONE: 'EXPORT_NONE',
};

async function export_timeline({ file_path, format, subtype, timeline_name }) {
    const resolve = await R.getResolve();
    if (!EXPORT_FMT[format]) throw new Error(`Unknown format "${format}".`);
    const exportType = resolve[EXPORT_FMT[format]];
    let exportSubtype = resolve.EXPORT_NONE;
    if (format === 'AAF') exportSubtype = resolve[EXPORT_SUB[subtype || 'AAF_NEW']];
    else if (format === 'EDL') exportSubtype = resolve[EXPORT_SUB[subtype || 'NONE']];
    const tl = await resolveTimeline(timeline_name);
    const ok = await tl.Export(file_path, exportType, exportSubtype);
    return { ok, format, subtype: subtype || null, file_path, timeline: await tl.GetName() };
}

async function list_markers({ timeline_name, color }) {
    const tl = await resolveTimeline(timeline_name);
    const startFrame = await tl.GetStartFrame();
    const markersDict = (await tl.GetMarkers()) || {};
    const markers = Object.entries(markersDict)
        .map(([frameId, m]) => ({
            frame_id: Number(frameId),
            absolute_frame: startFrame + Number(frameId),
            color: m.color,
            name: m.name,
            note: m.note,
            duration: m.duration,
            custom_data: m.customData,
        }))
        .filter((m) => !color || m.color === color)
        .sort((a, b) => a.frame_id - b.frame_id);
    return { timeline: await tl.GetName(), start_frame: startFrame, count: markers.length, markers };
}

async function delete_markers_by_color({ color, timeline_name }) {
    const tl = await resolveTimeline(timeline_name);
    const before = Object.keys((await tl.GetMarkers()) || {}).length;
    const ok = await tl.DeleteMarkersByColor(color);
    const after = Object.keys((await tl.GetMarkers()) || {}).length;
    return { ok, color, deleted: before - after, remaining: after, timeline: await tl.GetName() };
}

async function get_timeline_setting({ setting_name, timeline_name }) {
    const tl = await resolveTimeline(timeline_name);
    if (setting_name) return { timeline: await tl.GetName(), setting_name, value: await tl.GetSetting(setting_name) };
    return { timeline: await tl.GetName(), settings: (await tl.GetSetting('')) || {} };
}

async function set_timeline_setting({ setting_name, setting_value, timeline_name }) {
    const tl = await resolveTimeline(timeline_name);
    const ok = await tl.SetSetting(setting_name, String(setting_value));
    return { ok, setting_name, requested: String(setting_value), value: await tl.GetSetting(setting_name), timeline: await tl.GetName() };
}

async function duplicate_timeline({ new_name, source_timeline_name }) {
    const tl = await resolveTimeline(source_timeline_name);
    const dup = new_name ? await tl.DuplicateTimeline(new_name) : await tl.DuplicateTimeline();
    if (!dup) return { ok: false, source: await tl.GetName() };
    return { ok: true, source: await tl.GetName(), new_timeline: await dup.GetName(), unique_id: await dup.GetUniqueId() };
}

const SUB_LANGS = ['AUTO', 'ENGLISH', 'SPANISH', 'FRENCH', 'GERMAN', 'ITALIAN', 'JAPANESE', 'KOREAN', 'MANDARIN_SIMPLIFIED', 'MANDARIN_TRADITIONAL', 'PORTUGUESE', 'RUSSIAN', 'DUTCH', 'DANISH', 'NORWEGIAN', 'SWEDISH'];
const SUB_PRESETS = ['SUBTITLE_DEFAULT', 'TELETEXT', 'NETFLIX'];

async function create_subtitles_from_audio({ language, preset, chars_per_line, line_break, gap }) {
    const resolve = await R.getResolve();
    const tl = await R.getCurrentTimeline();
    const lang = (language || 'AUTO').toUpperCase();
    const pre = (preset || 'SUBTITLE_DEFAULT').toUpperCase();
    if (!SUB_LANGS.includes(lang)) throw new Error(`Unknown language "${language}".`);
    if (!SUB_PRESETS.includes(pre)) throw new Error(`Unknown preset "${preset}".`);
    const settings = {
        [resolve.SUBTITLE_LANGUAGE]: resolve['AUTO_CAPTION_' + lang],
        [resolve.SUBTITLE_CAPTION_PRESET]: resolve['AUTO_CAPTION_' + pre],
        [resolve.SUBTITLE_LINE_BREAK]: line_break && String(line_break).toUpperCase() === 'DOUBLE' ? resolve.AUTO_CAPTION_LINE_DOUBLE : resolve.AUTO_CAPTION_LINE_SINGLE,
    };
    if (chars_per_line != null) settings[resolve.SUBTITLE_CHARS_PER_LINE] = chars_per_line;
    if (gap != null) settings[resolve.SUBTITLE_GAP] = gap;
    const before = await tl.GetTrackCount('subtitle');
    const ok = await tl.CreateSubtitlesFromAudio(settings);
    const after = await tl.GetTrackCount('subtitle');
    if (!ok) {
        return {
            ok: false,
            language: lang,
            preset: pre,
            subtitle_tracks_before: before,
            subtitle_tracks_after: after,
            timeline: await tl.GetName(),
            error: 'CreateSubtitlesFromAudio returned False — requires DaVinci Resolve Studio with speech models (AI Extras).',
        };
    }
    return { ok, language: lang, preset: pre, subtitle_tracks_before: before, subtitle_tracks_after: after, timeline: await tl.GetName() };
}

module.exports = {
    export_timeline,
    list_markers,
    delete_markers_by_color,
    get_timeline_setting,
    set_timeline_setting,
    duplicate_timeline,
    create_subtitles_from_audio,
};
