// Audio / Fairlight tools. Verified against the Resolve 21 Scripting README.
// Voice Isolation is a Studio+AI feature: it returns a soft {ok:false,error} when
// unavailable instead of throwing, so Claude can explain it.

const R = require('../resolve/resolveClient');

async function set_voice_isolation({ scope, track_index, is_enabled, amount, item_index }) {
    const tl = await R.getCurrentTimeline();
    const n = await tl.GetTrackCount('audio');
    if (track_index < 1 || track_index > n) throw new Error(`track_index out of range 1..${n}.`);
    const amt = Math.round(amount == null ? 50 : amount);
    if (amt < 0 || amt > 100) throw new Error('amount must be 0..100.');
    const state = { isEnabled: is_enabled !== false, amount: amt };

    let ok, applied;
    if (scope === 'item') {
        const items = (await tl.GetItemListInTrack('audio', track_index)) || [];
        const it = items[item_index || 0];
        if (!it) throw new Error('Clip not found on track.');
        ok = await it.SetVoiceIsolationState(state);
        applied = await it.GetVoiceIsolationState();
    } else {
        ok = await tl.SetVoiceIsolationState(track_index, state);
        applied = await tl.GetVoiceIsolationState(track_index);
    }
    if (!ok) {
        return {
            ok: false,
            scope: scope || 'track',
            track_index,
            error: 'Voice Isolation returned False — requires DaVinci Resolve Studio with AI; unavailable in the free version.',
        };
    }
    return {
        ok,
        scope: scope || 'track',
        track_index,
        item_index: scope === 'item' ? item_index || 0 : undefined,
        requested: state,
        applied,
        track_count: n,
    };
}

async function add_audio_track_of_type({ audio_type, index, name }) {
    const tl = await R.getCurrentTimeline();
    const before = await tl.GetTrackCount('audio');
    const opts = { audioType: audio_type || 'mono' };
    if (index != null) opts.index = index;
    const ok = await tl.AddTrack('audio', opts);
    if (!ok) throw new Error('Failed to add audio track (check audio_type).');
    const after = await tl.GetTrackCount('audio');
    const newIndex = index != null && index >= 1 && index <= before ? index : after;
    if (name) await tl.SetTrackName('audio', newIndex, name);
    return {
        ok,
        audio_type: audio_type || 'mono',
        requested_index: index == null ? null : index,
        new_track_index: newIndex,
        track_name: await tl.GetTrackName('audio', newIndex),
        actual_sub_type: await tl.GetTrackSubType('audio', newIndex),
        track_count_before: before,
        track_count_after: after,
    };
}

module.exports = { set_voice_isolation, add_audio_track_of_type };
