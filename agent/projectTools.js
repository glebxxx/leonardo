// Project settings + render-queue management. Verified against the Resolve 21
// Scripting README. Set* methods only return Bool, so handlers read state back
// (before/after) to give verifiable results. Serializable returns only.

const R = require('../resolve/resolveClient');

async function get_project_setting({ setting_name }) {
    const project = await R.getCurrentProject();
    if (setting_name) return { setting_name, value: await project.GetSetting(setting_name) };
    const all = (await project.GetSetting('')) || {};
    return { settings: all, count: Object.keys(all).length };
}

async function set_project_setting({ setting_name, setting_value }) {
    const project = await R.getCurrentProject();
    const before = await project.GetSetting(setting_name);
    const ok = await project.SetSetting(setting_name, String(setting_value));
    const after = await project.GetSetting(setting_name);
    return { setting_name, requested: String(setting_value), ok: !!ok, before, after };
}

async function list_render_jobs() {
    const project = await R.getCurrentProject();
    const jobs = (await project.GetRenderJobList()) || [];
    const rendering = await project.IsRenderingInProgress();
    const out = [];
    for (const j of jobs) {
        const id = j.JobId || j.JobID || j.jobId;
        let status = null;
        try {
            status = await project.GetRenderJobStatus(id);
        } catch (e) {
            /* ignore */
        }
        out.push({
            job_id: id,
            name: j.RenderJobName || j.OutputFilename || null,
            target_dir: j.TargetDir || null,
            output_filename: j.OutputFilename || null,
            status: status ? status.JobStatus : null,
            completion_percentage: status ? status.CompletionPercentage : null,
            timeline_name: j.TimelineName || null,
        });
    }
    return { rendering_in_progress: !!rendering, job_count: out.length, jobs: out };
}

async function get_render_status({ job_id }) {
    const project = await R.getCurrentProject();
    const rendering = await project.IsRenderingInProgress();
    if (!job_id) return { rendering_in_progress: !!rendering };
    const status = await project.GetRenderJobStatus(job_id);
    return {
        job_id,
        rendering_in_progress: !!rendering,
        job_status: status ? status.JobStatus : null,
        completion_percentage: status ? status.CompletionPercentage : null,
        time_taken_ms: status && status.TimeTakenToRenderInMs != null ? status.TimeTakenToRenderInMs : null,
        error: status && status.Error != null ? status.Error : null,
    };
}

async function stop_rendering() {
    const project = await R.getCurrentProject();
    const wasRendering = await project.IsRenderingInProgress();
    await project.StopRendering();
    const stillRendering = await project.IsRenderingInProgress();
    return { was_rendering: !!wasRendering, still_rendering: !!stillRendering };
}

async function delete_render_job({ job_id, all }) {
    const project = await R.getCurrentProject();
    if (all) return { mode: 'all', ok: !!(await project.DeleteAllRenderJobs()) };
    if (!job_id) throw new Error('Specify job_id or all=true.');
    return { mode: 'single', job_id, ok: !!(await project.DeleteRenderJob(job_id)) };
}

async function list_render_formats({ format, codec }) {
    const project = await R.getCurrentProject();
    const formats = (await project.GetRenderFormats()) || {};
    const result = { render_mode: await project.GetCurrentRenderMode(), formats };
    if (format) {
        result.codecs = (await project.GetRenderCodecs(format)) || {};
        if (codec) {
            const res = (await project.GetRenderResolutions(format, codec)) || [];
            result.resolutions = res.map((r) => ({ width: r.Width, height: r.Height }));
        }
    }
    const cur = await project.GetCurrentRenderFormatAndCodec();
    result.current = cur ? { format: cur.format, codec: cur.codec } : null;
    return result;
}

async function set_render_format_codec({ format, codec }) {
    const project = await R.getCurrentProject();
    const codecs = (await project.GetRenderCodecs(format)) || {};
    const ok = await project.SetCurrentRenderFormatAndCodec(format, codec);
    const current = await project.GetCurrentRenderFormatAndCodec();
    return {
        ok: !!ok,
        requested: { format, codec },
        current: current ? { format: current.format, codec: current.codec } : null,
        available_codecs_for_format: codecs,
    };
}

module.exports = {
    get_project_setting,
    set_project_setting,
    list_render_jobs,
    get_render_status,
    stop_rendering,
    delete_render_job,
    list_render_formats,
    set_render_format_codec,
};
