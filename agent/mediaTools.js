// Media-pool tools: AI transcription and double-system audio sync.
// Transcription is Studio+AI: soft {ok:false,error} when unavailable.
// AUDIO_SYNC_* constants live on the top-level resolve handle (computed keys).

const R = require('../resolve/resolveClient');

async function transcribe_clip_audio({ clip_name, use_speaker_detection, action }) {
    const clip = await R.getCurrentFolderClipByName(clip_name);
    if (!clip) throw new Error(`Clip "${clip_name}" not found in the current bin.`);

    let ok;
    if (action === 'clear') {
        ok = await clip.ClearTranscription();
    } else if (use_speaker_detection === undefined) {
        ok = await clip.TranscribeAudio();
    } else {
        ok = await clip.TranscribeAudio(use_speaker_detection);
    }
    if (!ok && action !== 'clear') {
        return {
            ok: false,
            clip_name,
            action: 'transcribe',
            error: 'TranscribeAudio returned False — requires DaVinci Resolve Studio with AI; not available in the free version.',
        };
    }
    return {
        ok,
        clip_name,
        action: action === 'clear' ? 'clear' : 'transcribe',
        used_speaker_detection: use_speaker_detection === undefined ? null : use_speaker_detection,
    };
}

async function sync_clip_audio({ clip_names, sync_mode, channel_number, retain_embedded_audio, retain_video_metadata }) {
    if (!Array.isArray(clip_names) || clip_names.length < 2) {
        throw new Error('Need >=2 clips (>=1 video and >=1 audio).');
    }
    const resolve = await R.getResolve();
    const mp = await R.getMediaPool();
    const items = [];
    for (const nm of clip_names) {
        const c = await R.getCurrentFolderClipByName(nm);
        if (!c) throw new Error(`Clip not found: ${nm}.`);
        items.push(c);
    }
    const settings = {
        [resolve.AUDIO_SYNC_MODE]: sync_mode === 'waveform' ? resolve.AUDIO_SYNC_WAVEFORM : resolve.AUDIO_SYNC_TIMECODE,
        [resolve.AUDIO_SYNC_CHANNEL_NUMBER]: channel_number == null ? 1 : channel_number,
        [resolve.AUDIO_SYNC_RETAIN_EMBEDDED_AUDIO]: !!retain_embedded_audio,
        [resolve.AUDIO_SYNC_RETAIN_VIDEO_METADATA]: !!retain_video_metadata,
    };
    const ok = await mp.AutoSyncAudio(items, settings);
    return {
        ok,
        synced_clip_names: clip_names,
        sync_mode: sync_mode || 'timecode',
        channel_number: channel_number == null ? 1 : channel_number,
        retain_embedded_audio: !!retain_embedded_audio,
        retain_video_metadata: !!retain_video_metadata,
    };
}

module.exports = { transcribe_clip_audio, sync_clip_audio };
