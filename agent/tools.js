// Tool schemas exposed to Claude. Names must match the keys in resolveTools.HANDLERS.
// Descriptions are prescriptive ("call this when...") on purpose: Opus 4.8 reaches
// for tools conservatively, so the *when* belongs in each description.

const tools = [
    {
        name: 'get_status',
        description:
            'Read the current state of Resolve: active page, name of the open project, number of timelines and the name of the current timeline. ' +
            'Call this AT THE START when you need to orient yourself before changing anything, or when the user asks "what is open right now".',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'open_page',
        description:
            'Switch the active DaVinci Resolve page. Call when the user asks to go to Media/Cut/Edit/Fusion/Color/Fairlight/Deliver, ' +
            'or when an action requires a specific page (e.g. rendering — on Deliver).',
        input_schema: {
            type: 'object',
            properties: {
                page: {
                    type: 'string',
                    enum: ['media', 'cut', 'edit', 'fusion', 'color', 'fairlight', 'deliver'],
                    description: 'Page name.',
                },
            },
            required: ['page'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_projects',
        description: 'Get the list of projects in the current project manager folder. Call before open_project if you are unsure of the exact name.',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'create_project',
        description: 'Create a new project and save it. Call when the user asks to create/start a new project.',
        input_schema: {
            type: 'object',
            properties: { name: { type: 'string', description: 'Name of the new project.' } },
            required: ['name'],
            additionalProperties: false,
        },
    },
    {
        name: 'open_project',
        description: 'Open an existing project by name. If the name is imprecise, call list_projects first.',
        input_schema: {
            type: 'object',
            properties: { name: { type: 'string', description: 'Project name.' } },
            required: ['name'],
            additionalProperties: false,
        },
    },
    {
        name: 'create_bin',
        description: 'Create a new bin (folder) in the media pool root and make it current. Call before import_media if the user wants to put media into a separate folder.',
        input_schema: {
            type: 'object',
            properties: { name: { type: 'string', description: 'Bin name.' } },
            required: ['name'],
            additionalProperties: false,
        },
    },
    {
        name: 'import_media',
        description:
            'Import media files into the current media pool bin. Accepts an array of ABSOLUTE file paths. ' +
            'Call when the user asks to import/add footage, audio or images. ' +
            'If the user gives a folder or a mask — ask them to specify the exact file paths.',
        input_schema: {
            type: 'object',
            properties: {
                file_paths: {
                    type: 'array',
                    items: { type: 'string', description: 'Absolute file path.' },
                    description: 'List of absolute paths to media files.',
                },
            },
            required: ['file_paths'],
            additionalProperties: false,
        },
    },
    {
        name: 'create_timeline_from_current_bin',
        description: 'Create a timeline from ALL clips in the current bin. Call after import_media when you need to quickly assemble a timeline from the imported footage.',
        input_schema: {
            type: 'object',
            properties: { name: { type: 'string', description: 'Name of the new timeline.' } },
            required: ['name'],
            additionalProperties: false,
        },
    },
    {
        name: 'create_empty_timeline',
        description: 'Create an empty timeline with no clips. Call when the user wants to start editing from a blank timeline.',
        input_schema: {
            type: 'object',
            properties: { name: { type: 'string', description: 'Name of the new timeline.' } },
            required: ['name'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_timelines',
        description: 'List the names of all timelines in the current project. Call before select_timeline if you are unsure of the name.',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'select_timeline',
        description: 'Make the timeline with the given name active. If the name is imprecise — call list_timelines first.',
        input_schema: {
            type: 'object',
            properties: { name: { type: 'string', description: 'Timeline name.' } },
            required: ['name'],
            additionalProperties: false,
        },
    },
    {
        name: 'add_timeline_marker',
        description: 'Add a marker to the current timeline at the given frame. Call when the user asks to mark a spot / place a marker.',
        input_schema: {
            type: 'object',
            properties: {
                frame: { type: 'number', description: 'Frame number from the start of the timeline (frameId). Defaults to 0.' },
                color: {
                    type: 'string',
                    description: 'Marker color.',
                    enum: ['Blue', 'Cyan', 'Green', 'Yellow', 'Red', 'Pink', 'Purple', 'Fuchsia', 'Rose', 'Lavender', 'Sky', 'Mint', 'Lemon', 'Sand', 'Cocoa', 'Cream'],
                },
                name: { type: 'string', description: 'Marker name.' },
                note: { type: 'string', description: 'Marker note.' },
            },
            required: ['frame'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_render_presets',
        description: 'Get the list of available render presets. ALWAYS call this before render_current_timeline to pick an existing preset.',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'render_current_timeline',
        description:
            'Add the current timeline to the render queue with the given preset and start the render. ' +
            'This is a heavy and long operation — only call it after explicit user confirmation and after get_render_presets. ' +
            'Briefly confirm the preset, folder and file name with the user before calling.',
        input_schema: {
            type: 'object',
            properties: {
                preset_name: { type: 'string', description: 'Render preset name (from get_render_presets).' },
                target_dir: { type: 'string', description: 'Absolute path to the output folder.' },
                clip_name: { type: 'string', description: 'Output file name (without extension).' },
            },
            required: ['preset_name', 'target_dir', 'clip_name'],
            additionalProperties: false,
        },
    },

    // ===== Editing (timeline editing) =====
    {
        name: 'list_timeline_clips',
        description:
            'List the clips on a track of the current timeline with their positions (start/end/duration in frames and source frames). ' +
            'Indices are 1-based. Call BEFORE any clip deletion/modification to know which index to address.',
        input_schema: {
            type: 'object',
            properties: {
                track_type: { type: 'string', enum: ['video', 'audio', 'subtitle'], description: 'Track type. Defaults to video.' },
                track_index: { type: 'number', description: 'Track number (1-based). Defaults to 1.' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'get_playhead',
        description: 'Get the current playhead timecode and the name of the clip under it. Call to orient yourself before cutting.',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'set_playhead',
        description: 'Move the playhead to the given timecode. Needed before blade_at_playhead. Timecode format HH:MM:SS:FF.',
        input_schema: {
            type: 'object',
            properties: { timecode: { type: 'string', description: 'Timecode HH:MM:SS:FF.' } },
            required: ['timecode'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_clips',
        description:
            'Delete clips from a track. ripple=true — RIPPLE delete: cuts and shifts the rest, closing the gap (default). ' +
            'ripple=false — lift: deletes, leaving an empty space. Indices from list_timeline_clips (1-based). This is the main "cut out a piece" tool.',
        input_schema: {
            type: 'object',
            properties: {
                clip_indices: { type: 'array', items: { type: 'number' }, description: '1-based indices of clips on the track.' },
                ripple: { type: 'boolean', description: 'true (default) — ripple delete with shift; false — leave a gap.' },
                track_type: { type: 'string', enum: ['video', 'audio', 'subtitle'], description: 'Defaults to video.' },
                track_index: { type: 'number', description: 'Track number. Defaults to 1.' },
            },
            required: ['clip_indices'],
            additionalProperties: false,
        },
    },
    {
        name: 'append_clip',
        description:
            'Add a clip from the current bin to the timeline, optionally TRIMMING it by source frames (source_start/source_end) — this is "trim on insert". ' +
            'record_frame sets the position on the timeline, track_index — the track. The clip name must exist in the current bin (see import_media).',
        input_schema: {
            type: 'object',
            properties: {
                clip_name: { type: 'string', description: 'Clip name in the current bin.' },
                source_start: { type: 'number', description: 'In frame in the source (in). Optional.' },
                source_end: { type: 'number', description: 'Out frame in the source (out). Optional.' },
                record_frame: { type: 'number', description: 'Frame on the timeline where to place the clip. Optional.' },
                track_index: { type: 'number', description: 'Video track number. Optional.' },
                media_type: { type: 'number', description: '1 — video only, 2 — audio only. Optional.' },
            },
            required: ['clip_name'],
            additionalProperties: false,
        },
    },
    {
        name: 'blade_at_playhead',
        description:
            'Cut the clip at the current playhead position (blade/Split, Cmd+\\). First place the playhead with set_playhead. ' +
            'NOTE: the Resolve API cannot cut at an arbitrary point, so this is done via system hotkeys and requires macOS Accessibility permission for DaVinci Resolve. ' +
            'To "cut out a fragment": blade at the start, blade at the end, then delete_clips(ripple=true) on the middle piece.',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'detect_scene_cuts',
        description: 'Automatically cut the timeline by scene-change detection (useful for a single long clip). Video only.',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'add_track',
        description: 'Add a new track (video/audio/subtitle) to the current timeline.',
        input_schema: {
            type: 'object',
            properties: { track_type: { type: 'string', enum: ['video', 'audio', 'subtitle'], description: 'Track type.' } },
            required: ['track_type'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_track',
        description: 'Delete a track by type and number (1-based).',
        input_schema: {
            type: 'object',
            properties: {
                track_type: { type: 'string', enum: ['video', 'audio', 'subtitle'] },
                track_index: { type: 'number', description: 'Track number (1-based).' },
            },
            required: ['track_type', 'track_index'],
            additionalProperties: false,
        },
    },
    {
        name: 'set_track_enabled',
        description: 'Enable/disable (show/hide) a track.',
        input_schema: {
            type: 'object',
            properties: {
                track_type: { type: 'string', enum: ['video', 'audio', 'subtitle'] },
                track_index: { type: 'number', description: 'Defaults to 1.' },
                enabled: { type: 'boolean', description: 'true — enable (default), false — disable.' },
            },
            required: ['track_type'],
            additionalProperties: false,
        },
    },
    {
        name: 'set_track_locked',
        description: 'Lock/unlock a track.',
        input_schema: {
            type: 'object',
            properties: {
                track_type: { type: 'string', enum: ['video', 'audio', 'subtitle'] },
                track_index: { type: 'number', description: 'Defaults to 1.' },
                locked: { type: 'boolean', description: 'true — lock, false — unlock (default).' },
            },
            required: ['track_type'],
            additionalProperties: false,
        },
    },
    {
        name: 'create_compound_clip',
        description: 'Combine selected track clips into a compound clip. Indices are 1-based (see list_timeline_clips).',
        input_schema: {
            type: 'object',
            properties: {
                clip_indices: { type: 'array', items: { type: 'number' }, description: '1-based clip indices.' },
                name: { type: 'string', description: 'Compound clip name. Optional.' },
                track_type: { type: 'string', enum: ['video', 'audio', 'subtitle'], description: 'Defaults to video.' },
                track_index: { type: 'number', description: 'Defaults to 1.' },
            },
            required: ['clip_indices'],
            additionalProperties: false,
        },
    },
    {
        name: 'set_clip_color',
        description: 'Color a clip on the timeline (organization). clip_index is 1-based.',
        input_schema: {
            type: 'object',
            properties: {
                clip_index: { type: 'number', description: '1-based index of the clip on the track.' },
                color: { type: 'string', description: 'Clip color, e.g. Orange/Green/Blue/Teal/Pink/Yellow/...' },
                track_type: { type: 'string', enum: ['video', 'audio', 'subtitle'], description: 'Defaults to video.' },
                track_index: { type: 'number', description: 'Defaults to 1.' },
            },
            required: ['clip_index', 'color'],
            additionalProperties: false,
        },
    },
    {
        name: 'add_title',
        description: 'Insert a title into the timeline at the playhead position (default is a simple "Text").',
        input_schema: {
            type: 'object',
            properties: { title_name: { type: 'string', description: 'Title name, e.g. "Text". Optional.' } },
            additionalProperties: false,
        },
    },
    {
        name: 'set_timeline_start_timecode',
        description: 'Set the start timecode of the current timeline (e.g. 01:00:00:00).',
        input_schema: {
            type: 'object',
            properties: { timecode: { type: 'string', description: 'Timecode HH:MM:SS:FF.' } },
            required: ['timecode'],
            additionalProperties: false,
        },
    },

    // ===== Full UI control (via system automation; requires Accessibility) =====
    {
        name: 'run_menu_command',
        description:
            'Execute ANY DaVinci Resolve menu item by path (array of levels, as in the menu bar at the top). ' +
            'Gives access to functions not available among the direct tools. Examples: ["Playback","Play"], ["Timeline","Add Transition"], ["Edit","Undo"]. ' +
            'Works via system automation — requires macOS Accessibility access for DaVinci Resolve. If unsure of the exact item name — ask the user.',
        input_schema: {
            type: 'object',
            properties: {
                menu_path: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Menu path from the menu bar to the item, e.g. ["Timeline","Add Transition"].',
                },
            },
            required: ['menu_path'],
            additionalProperties: false,
        },
    },
    {
        name: 'lookup_shortcuts',
        description:
            'Find DaVinci Resolve hotkeys by query (action or keyword, e.g. "transition", "split", "trim"). ' +
            'An empty query returns the whole list. Use if unsure which key is needed, before press_shortcut. This is the default Resolve layout.',
        input_schema: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Word or action to search for. Optional — empty returns everything.' } },
            additionalProperties: false,
        },
    },
    {
        name: 'list_menus',
        description:
            'Read the ACTUAL menu structure of the running Resolve (exact for your version and interface language). ' +
            'No argument — top-level menu names; menu_path:["Timeline"] — items of the Timeline menu; menu_path:["Timeline","Add Transition"] — submenu. ' +
            'Call BEFORE run_menu_command if unsure of the exact item name. Requires Accessibility access.',
        input_schema: {
            type: 'object',
            properties: {
                menu_path: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Path to the menu/submenu whose items to show. Empty — top level.',
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'press_shortcut',
        description:
            'Press a hotkey in Resolve — for actions not available in the API (transitions, blade, insert/overwrite, etc.). ' +
            'PREFERABLY pass action (action name) — the keys are filled in from the default layout automatically: ' +
            'for example action "Add Transition", "Split Clip", "Insert edit", "Snapping toggle". The list is via lookup_shortcuts. ' +
            'Or set the keys manually: key/special + modifiers. First set the context if needed (set_playhead). Requires Accessibility access.',
        input_schema: {
            type: 'object',
            properties: {
                action: { type: 'string', description: 'Action name from the shortcut map, e.g. "Add Transition", "Split Clip". If set — key/special are not needed.' },
                key: { type: 'string', description: 'Character key, e.g. "t", "b", "\\\\". Or use special or action.' },
                special: {
                    type: 'string',
                    description: 'Special key.',
                    enum: ['delete', 'forwarddelete', 'return', 'escape', 'space', 'tab', 'left', 'right', 'up', 'down', 'home', 'end', 'pageup', 'pagedown', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'],
                },
                command: { type: 'boolean', description: 'Hold Cmd.' },
                shift: { type: 'boolean', description: 'Hold Shift.' },
                option: { type: 'boolean', description: 'Hold Option/Alt.' },
                control: { type: 'boolean', description: 'Hold Control.' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'type_text',
        description: 'Type text in Resolve (into the active input field/search or for renaming). Requires Accessibility access.',
        input_schema: {
            type: 'object',
            properties: { text: { type: 'string', description: 'Text to type.' } },
            required: ['text'],
            additionalProperties: false,
        },
    },

    // ===== Fusion =====
    {
        name: 'list_fusion_comps',
        description: 'List Fusion compositions on a clip (default is the current video clip, or by track/clip indices). Call before add/load/delete/rename/export.',
        input_schema: {
            type: 'object',
            properties: {
                track_type: { type: 'string', enum: ['video', 'audio', 'subtitle'], description: 'Defaults to the current video clip.' },
                track_index: { type: 'number', description: '1-based, together with clip_index.' },
                clip_index: { type: 'number', description: '1-based index of the clip on the track. Without it — the current clip.' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'add_fusion_comp',
        description: 'Attach a new empty Fusion composition to a clip (default the current one), optionally with a name.',
        input_schema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name of the new composition.' },
                track_type: { type: 'string', enum: ['video', 'audio', 'subtitle'] },
                track_index: { type: 'number' },
                clip_index: { type: 'number' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'manage_fusion_comp',
        description: 'Load / rename / delete / import / export Fusion compositions on a clip. Call list_fusion_comps first.',
        input_schema: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['load', 'rename', 'delete', 'import', 'export'] },
                comp_name: { type: 'string', description: 'Name of an existing composition (for load/rename/delete/export).' },
                new_name: { type: 'string', description: 'New name (for rename).' },
                path: { type: 'string', description: 'Absolute path: for import — what to import, for export — where to save.' },
                track_type: { type: 'string', enum: ['video', 'audio', 'subtitle'] },
                track_index: { type: 'number' },
                clip_index: { type: 'number' },
            },
            required: ['action'],
            additionalProperties: false,
        },
    },
    {
        name: 'insert_fusion_title',
        description: 'Insert a Fusion title (e.g. "Text+") at the playhead position — animatable, unlike add_title.',
        input_schema: {
            type: 'object',
            properties: { title_name: { type: 'string', description: 'Fusion title name, e.g. "Text+".' } },
            required: ['title_name'],
            additionalProperties: false,
        },
    },
    {
        name: 'insert_fusion_composition',
        description: 'Insert an empty Fusion composition clip at the playhead position (a blank Fusion canvas).',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },

    // ===== Audio / Fairlight =====
    {
        name: 'set_voice_isolation',
        description: 'Enable/configure Voice Isolation (AI dialogue noise reduction) on an audio track or clip. Studio+AI: returns a soft error if unavailable.',
        input_schema: {
            type: 'object',
            properties: {
                scope: { type: 'string', enum: ['track', 'item'], description: 'track (whole track, default) or item (single clip).' },
                track_index: { type: 'number', description: '1-based audio track index.' },
                is_enabled: { type: 'boolean', description: 'Enable (default true).' },
                amount: { type: 'number', description: 'Strength 0..100 (default 50).' },
                item_index: { type: 'number', description: 'For scope=item: 0-based clip position on the track.' },
            },
            required: ['track_index'],
            additionalProperties: false,
        },
    },
    {
        name: 'add_audio_track_of_type',
        description: 'Add an audio track of a specific format (mono/stereo/5.1/7.1/adaptive…), optionally with index and name.',
        input_schema: {
            type: 'object',
            properties: {
                audio_type: { type: 'string', description: 'mono (default), stereo, 5.1, 5.1film, 7.1, adaptive1..adaptive36, etc.' },
                index: { type: 'number', description: '1-based insertion position. Otherwise added at the end.' },
                name: { type: 'string', description: 'Name of the new track.' },
            },
            additionalProperties: false,
        },
    },

    // ===== Project and render queue =====
    {
        name: 'get_project_setting',
        description: 'Read a project setting by key (e.g. timelineFrameRate, timelineResolutionWidth, superScale). Without a key — a snapshot of all settings.',
        input_schema: {
            type: 'object',
            properties: { setting_name: { type: 'string', description: 'Setting key. Empty — all settings.' } },
            additionalProperties: false,
        },
    },
    {
        name: 'set_project_setting',
        description: 'Change a project setting (key/value, as in Project Settings). Check ok and before/after — some keys are read-only.',
        input_schema: {
            type: 'object',
            properties: {
                setting_name: { type: 'string', description: 'Setting key.' },
                setting_value: { type: 'string', description: 'Value as a string (e.g. "24", "1920").' },
            },
            required: ['setting_name', 'setting_value'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_render_jobs',
        description: 'List render jobs in the Deliver queue with status and percentage, plus whether a render is running. Read-only.',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'get_render_status',
        description: 'Status and percentage of a render by job_id; without job_id — just whether a render is running. For polling progress.',
        input_schema: {
            type: 'object',
            properties: { job_id: { type: 'string', description: 'Job ID (from list_render_jobs).' } },
            additionalProperties: false,
        },
    },
    {
        name: 'stop_rendering',
        description: 'Immediately stop the current render. Safe to call even if no render is running.',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'delete_render_job',
        description: 'Delete a render job: job_id — one, all=true — the whole queue. Does not stop an active render (call stop_rendering first).',
        input_schema: {
            type: 'object',
            properties: {
                job_id: { type: 'string', description: 'Job ID.' },
                all: { type: 'boolean', description: 'true — delete all jobs.' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'list_render_formats',
        description: 'Available render formats, their codecs and supported resolutions. No arguments — all formats; format — its codecs; format+codec — resolutions.',
        input_schema: {
            type: 'object',
            properties: {
                format: { type: 'string', description: 'Format key for details.' },
                codec: { type: 'string', description: 'Codec (together with format → resolutions).' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'set_render_format_codec',
        description: 'Set the current render format+codec (e.g. format "mp4" codec "H265"). Returns the available codecs for self-correction. Before adding a job.',
        input_schema: {
            type: 'object',
            properties: {
                format: { type: 'string', description: 'Format key (from GetRenderFormats).' },
                codec: { type: 'string', description: 'Codec name for the format (from GetRenderCodecs).' },
            },
            required: ['format', 'codec'],
            additionalProperties: false,
        },
    },

    // ===== Media =====
    {
        name: 'transcribe_clip_audio',
        description: 'AI transcription of speech in a media pool clip (by name) or clearing the transcript. Studio+AI: soft error if unavailable.',
        input_schema: {
            type: 'object',
            properties: {
                clip_name: { type: 'string', description: 'Clip name in the current bin.' },
                use_speaker_detection: { type: 'boolean', description: 'Detect speakers. Without it — the project setting.' },
                action: { type: 'string', enum: ['transcribe', 'clear'], description: 'transcribe (default) or clear.' },
            },
            required: ['clip_name'],
            additionalProperties: false,
        },
    },
    {
        name: 'sync_clip_audio',
        description: 'Auto-sync of dual-system audio: align a separate audio clip with the video by timecode or waveform. Requires >=2 clips (video+audio).',
        input_schema: {
            type: 'object',
            properties: {
                clip_names: { type: 'array', items: { type: 'string' }, description: 'Clip names from the current bin (>=2).' },
                sync_mode: { type: 'string', enum: ['timecode', 'waveform'], description: 'Defaults to timecode.' },
                channel_number: { type: 'number', description: 'For waveform: channel (default 1; -1 auto, -2 mix).' },
                retain_embedded_audio: { type: 'boolean', description: 'Keep the original video audio.' },
                retain_video_metadata: { type: 'boolean', description: 'Keep the video metadata.' },
            },
            required: ['clip_names'],
            additionalProperties: false,
        },
    },

    // ===== Timeline export / markers / settings =====
    {
        name: 'export_timeline',
        description: 'Export the current (or named) timeline to an interchange format: AAF/DRT/EDL/XML/FCPXML/OTIO/ALE/CSV, etc. For handoff to another NLE/grading.',
        input_schema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Absolute output path with extension.' },
                format: {
                    type: 'string',
                    enum: ['AAF', 'DRT', 'EDL', 'FCP_7_XML', 'FCPXML_1_8', 'FCPXML_1_9', 'FCPXML_1_10', 'OTIO', 'ALE', 'ALE_CDL', 'TEXT_CSV', 'TEXT_TAB', 'HDR_10_PROFILE_A', 'HDR_10_PROFILE_B', 'DOLBY_VISION_VER_2_9', 'DOLBY_VISION_VER_4_0', 'DOLBY_VISION_VER_5_1'],
                },
                subtype: { type: 'string', description: 'Only for AAF (AAF_NEW|AAF_EXISTING) and EDL (CDL|SDL|MISSING_CLIPS|NONE).' },
                timeline_name: { type: 'string', description: 'Timeline name (default current).' },
            },
            required: ['file_path', 'format'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_markers',
        description: 'List of timeline markers (frame, color, name, note, duration, customData), optional filter by color. For an audit before deletion.',
        input_schema: {
            type: 'object',
            properties: {
                timeline_name: { type: 'string', description: 'Default current.' },
                color: { type: 'string', description: 'Filter by color.' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'delete_markers_by_color',
        description: 'Delete all markers of a given color (or color="All" — all). Bulk cleanup of markers.',
        input_schema: {
            type: 'object',
            properties: {
                color: { type: 'string', description: 'Marker color or "All".' },
                timeline_name: { type: 'string', description: 'Default current.' },
            },
            required: ['color'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_timeline_setting',
        description: 'Read a timeline-level setting (e.g. timelineFrameRate). Without a key — a snapshot of all. Different from get_project_setting.',
        input_schema: {
            type: 'object',
            properties: {
                setting_name: { type: 'string', description: 'Key. Empty — all settings.' },
                timeline_name: { type: 'string', description: 'Default current.' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'set_timeline_setting',
        description: 'Set a timeline setting (e.g. timelineFrameRate "29.97 DF"). Reads the value back. Check ok.',
        input_schema: {
            type: 'object',
            properties: {
                setting_name: { type: 'string', description: 'Setting key.' },
                setting_value: { type: 'string', description: 'Value as a string.' },
                timeline_name: { type: 'string', description: 'Default current.' },
            },
            required: ['setting_name', 'setting_value'],
            additionalProperties: false,
        },
    },
    {
        name: 'duplicate_timeline',
        description: 'Duplicate the current (or named) timeline, optionally with a new name. A safe copy before risky editing. Does not switch to the copy.',
        input_schema: {
            type: 'object',
            properties: {
                new_name: { type: 'string', description: 'Copy name (otherwise auto).' },
                source_timeline_name: { type: 'string', description: 'Source (default current).' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'create_subtitles_from_audio',
        description: 'Auto subtitles from timeline audio (speech-to-text), optionally language/preset/line length. Studio+AI: soft error if unavailable.',
        input_schema: {
            type: 'object',
            properties: {
                language: { type: 'string', description: 'AUTO (default), RUSSIAN, ENGLISH, SPANISH, FRENCH, GERMAN, JAPANESE, etc.' },
                preset: { type: 'string', enum: ['SUBTITLE_DEFAULT', 'TELETEXT', 'NETFLIX'], description: 'Default SUBTITLE_DEFAULT.' },
                chars_per_line: { type: 'number', description: 'Max characters per line (1..60).' },
                line_break: { type: 'string', enum: ['SINGLE', 'DOUBLE'], description: 'Default SINGLE.' },
                gap: { type: 'number', description: 'Min gap between subtitles in frames (0..10).' },
            },
            additionalProperties: false,
        },
    },

    // ===== Color / grading =====
    {
        name: 'grade_clip',
        description:
            'Color grade the current clip by recipe: build a node tree (via UI on the Color page) and apply CDL/LUT per node via the API. ' +
            'look/intent — the name of a look or a free-form query (clean/teal&orange/warm/cool/filmic/vintage/bw/bright/moody/bleach; Russian synonyms also work). ' +
            'Without a style — a neutral correction. strength scales the intensity (0..2, default 1). Returns a list of what needs to be tweaked MANUALLY (curves/HSL/windows). Requires Accessibility to create nodes.',
        input_schema: {
            type: 'object',
            properties: {
                look: { type: 'string', description: 'Look name or its synonym.' },
                intent: { type: 'string', description: 'Free-form query if there is no exact name.' },
                reset_first: { type: 'boolean', description: 'Reset the grade before building (recommended).' },
                strength: { type: 'number', description: 'Effect strength 0..2 (default 1).' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'list_grade_recipes',
        description: 'List of available color grading looks with descriptions and synonyms. Call if the user asks what styles are available.',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'apply_cdl_to_node',
        description: 'Apply ASC-CDL (slope/offset/power/saturation) to a node of the current clip via SetCDL. The base correction/look primitive. slope≈gain, offset≈lift (small!), power≈gamma.',
        input_schema: {
            type: 'object',
            properties: {
                node_index: { type: 'number', description: '1-based node index.' },
                slope: { type: 'array', items: { type: 'number' }, description: '[R,G,B] gain, neutral [1,1,1].' },
                offset: { type: 'array', items: { type: 'number' }, description: '[R,G,B] lift, neutral [0,0,0], keep within ±0.05.' },
                power: { type: 'array', items: { type: 'number' }, description: '[R,G,B] gamma, neutral [1,1,1].' },
                saturation: { type: 'number', description: 'Saturation, neutral 1.' },
            },
            required: ['node_index'],
            additionalProperties: false,
        },
    },
    {
        name: 'apply_lut_to_node',
        description: 'Apply a .cube/LUT to a node of the current clip (Graph.SetLUT). For look/output nodes (film print LUT, creative LUT, LOG→Rec709). Path relative to the LUT folder (see list_luts).',
        input_schema: {
            type: 'object',
            properties: {
                node_index: { type: 'number', description: '1-based node index. Defaults to 1.' },
                lut_path: { type: 'string', description: 'Path to the LUT relative to the LUT folder, e.g. "Film Looks/Rec709 Kodak 2383 D65.cube".' },
                layer_index: { type: 'number', description: '1-based node-stack layer (optional).' },
                refresh_lut: { type: 'boolean', description: 'Refresh the LUT list before applying (for freshly added ones).' },
            },
            required: ['lut_path'],
            additionalProperties: false,
        },
    },
    {
        name: 'reset_grade',
        description: 'Reset all node grades of the current clip (ResetAllNodeColors). Does not delete nodes. Before rebuilding a look.',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'set_node_enabled',
        description: 'Enable/disable a node (SetNodeEnabled) — a non-destructive bypass for A/B.',
        input_schema: {
            type: 'object',
            properties: {
                node_index: { type: 'number', description: '1-based node index.' },
                enabled: { type: 'boolean', description: 'true — enable, false — disable.' },
            },
            required: ['node_index', 'enabled'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_node_info',
        description: 'Inspect the node tree of the current clip: count, labels and tools in each node. To verify the built tree.',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'add_serial_node',
        description: 'Create a new node on the Color page via UI (the API cannot create nodes). variant: serial (default), serial_before, parallel, layer, outside. Requires focus on the Color page + Accessibility. Returns the new node index.',
        input_schema: {
            type: 'object',
            properties: { variant: { type: 'string', enum: ['serial', 'serial_before', 'parallel', 'layer', 'outside'], description: 'Node type.' } },
            additionalProperties: false,
        },
    },
    {
        name: 'list_luts',
        description: 'List of installed LUTs (from the DaVinci LUT folder, ~163 of them), paths are relative — ready for apply_lut_to_node. Optional filter by substring (e.g. "kodak", "sony", "709").',
        input_schema: {
            type: 'object',
            properties: { filter: { type: 'string', description: 'Filter by name.' } },
            additionalProperties: false,
        },
    },
    {
        name: 'apply_powergrade',
        description: 'Apply a saved PowerGrade/still from a .drx to the current clip (ApplyGradeFromDRX) — builds the whole node tree at once. For ready-made looks/stills from the gallery.',
        input_schema: {
            type: 'object',
            properties: {
                drx_path: { type: 'string', description: 'Absolute path to the .drx.' },
                grade_mode: { type: 'number', description: '0 — without keyframes (default), 1 — by source TC, 2 — by start frames.' },
            },
            required: ['drx_path'],
            additionalProperties: false,
        },
    },
    {
        name: 'manage_color_versions',
        description: 'Grade versions on the current clip: list/add/load/rename/delete/current. For alternative color variants.',
        input_schema: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['list', 'add', 'load', 'rename', 'delete', 'current'] },
                version_name: { type: 'string', description: 'Version name (for add/load/delete/rename).' },
                new_name: { type: 'string', description: 'New name (for rename).' },
                version_type: { type: 'number', description: '0 — local (default), 1 — remote.' },
            },
            required: ['action'],
            additionalProperties: false,
        },
    },
    {
        name: 'manage_color_group',
        description: 'Color groups: list/create/assign/remove/delete/rename. assign_scope: current (current clip) or track (whole video track).',
        input_schema: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['list', 'create', 'assign', 'remove', 'delete', 'rename'] },
                group_name: { type: 'string', description: 'Group name.' },
                new_name: { type: 'string', description: 'New name (for rename).' },
                assign_scope: { type: 'string', enum: ['current', 'track'], description: 'For assign.' },
                track_index: { type: 'number', description: 'Video track for assign_scope=track.' },
            },
            required: ['action'],
            additionalProperties: false,
        },
    },
    {
        name: 'copy_grade_to_clips',
        description: 'Copy the grade of the current clip to other clips: scope="track" (whole video track) or "names" (by names). By default the source clip is excluded.',
        input_schema: {
            type: 'object',
            properties: {
                scope: { type: 'string', enum: ['track', 'names'] },
                track_index: { type: 'number', description: 'Video track for scope=track.' },
                clip_names: { type: 'array', items: { type: 'string' }, description: 'Clip names for scope=names.' },
                include_source: { type: 'boolean', description: 'Include the source clip (default false).' },
            },
            required: ['scope'],
            additionalProperties: false,
        },
    },
    {
        name: 'export_clip_lut',
        description: 'Export the grade of the current clip as a LUT (.cube). size: 17|33|65 points or vlut (Panasonic).',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Output path with file name.' },
                size: { type: 'string', enum: ['17', '33', '65', 'vlut'], description: 'LUT size/type. Default 33.' },
            },
            required: ['path'],
            additionalProperties: false,
        },
    },
    {
        name: 'stabilize_clip',
        description: 'Stabilize the current clip (Stabilize). smart_reframe=true additionally runs Smart Reframe (Studio+AI; soft error if unavailable).',
        input_schema: {
            type: 'object',
            properties: { smart_reframe: { type: 'boolean', description: 'Additional Smart Reframe (Studio+AI).' } },
            additionalProperties: false,
        },
    },
    {
        name: 'grab_timeline_stills',
        description: 'Grab stills into the gallery: scope="current" (current clip) or "all" (one per clip). Optionally export them directly to a folder (export_folder, format png/jpg/dpx/tif…).',
        input_schema: {
            type: 'object',
            properties: {
                scope: { type: 'string', enum: ['current', 'all'] },
                still_frame_source: { type: 'string', enum: ['first', 'middle'], description: 'For scope=all: still frame.' },
                export_folder: { type: 'string', description: 'Absolute folder for export (optional).' },
                file_prefix: { type: 'string', description: 'File name prefix.' },
                format: { type: 'string', enum: ['dpx', 'cin', 'tif', 'jpg', 'png', 'ppm', 'bmp', 'xpm', 'drx'], description: 'Export format (default png).' },
            },
            required: ['scope'],
            additionalProperties: false,
        },
    },
    {
        name: 'detect_camera',
        description:
            'Determine the camera/LOG profile of a clip from metadata and codec: reads GetMetadata()/GetClipProperty() and heuristically determines the brand (Sony S-Log3, Panasonic V-Log, ARRI LogC, Canon Log, RED Log3G10, BMD Film, DJI D-Log…). ' +
            'Call BEFORE apply_log_profile or when the user asks what it was shot on. Without clip_name — the current clip on the timeline.',
        input_schema: {
            type: 'object',
            properties: { clip_name: { type: 'string', description: 'Clip name in the current bin. Without it — the current clip.' } },
            additionalProperties: false,
        },
    },
    {
        name: 'apply_log_profile',
        description:
            'Convert LOG to Rec.709 correctly: applies the camera conversion LUT (method="lut", default, on node 1) OR sets the Input Color Space when using DaVinci Color Management (method="colorspace"). ' +
            'Without profile — auto-detection via detect_camera. This is the FIRST step before grading LOG footage.',
        input_schema: {
            type: 'object',
            properties: {
                clip_name: { type: 'string', description: 'Clip name (for colorspace/detection). Without it — the current one.' },
                profile: { type: 'string', description: 'Profile: sony_slog3, sony_slog2, panasonic_vlog, arri_logc, canon_clog, red_log3g10, bmd_film_gen5, dji_dlog, fujifilm_flog, nikon_nlog. Without it — auto.' },
                method: { type: 'string', enum: ['lut', 'colorspace'], description: 'lut (conversion LUT, default) or colorspace (RCM Input Color Space).' },
                node_index: { type: 'number', description: 'Node for the LUT (default 1).' },
            },
            additionalProperties: false,
        },
    },

    // ===== System super-tools (full access to the machine) =====
    {
        name: 'run_shell',
        description:
            'Execute ANY shell command on the user\'s machine (bash): ffmpeg, file operations, utilities, git, etc. PATH is extended (homebrew/local). ' +
            'POWERFUL and potentially irreversible — before deleting/bulk/dangerous commands (rm, overwrite, sudo, formatting) FIRST show the command and get the user\'s consent.',
        input_schema: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'Command for the shell.' },
                cwd: { type: 'string', description: 'Working directory (default $HOME).' },
                timeout: { type: 'number', description: 'Timeout in ms (default 120000).' },
            },
            required: ['command'],
            additionalProperties: false,
        },
    },
    {
        name: 'run_python',
        description:
            'Execute Python code. By default it connects the FULL DaVinci Resolve Python API (the variables resolve/projectManager/project are already ready) — ANY API methods are available, even those not wrapped in separate tools. ' +
            'Print the result via print(). connect_resolve=false — plain python without Resolve.',
        input_schema: {
            type: 'object',
            properties: {
                code: { type: 'string', description: 'Python code. resolve/project are available by default.' },
                connect_resolve: { type: 'boolean', description: 'Connect the Resolve API (default true).' },
                cwd: { type: 'string', description: 'Working directory.' },
                timeout: { type: 'number', description: 'Timeout in ms (default 120000).' },
            },
            required: ['code'],
            additionalProperties: false,
        },
    },
    {
        name: 'run_applescript',
        description: 'Execute arbitrary AppleScript (controlling macOS/applications). For system automation beyond Resolve.',
        input_schema: {
            type: 'object',
            properties: { script: { type: 'string', description: 'AppleScript code.' } },
            required: ['script'],
            additionalProperties: false,
        },
    },
    {
        name: 'read_file',
        description: 'Read a text file from disk (up to max_bytes). For reading logs, configs, EDL/XML, scripts.',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Absolute file path.' },
                max_bytes: { type: 'number', description: 'How many bytes to read (default ~100KB).' },
            },
            required: ['path'],
            additionalProperties: false,
        },
    },
    {
        name: 'write_file',
        description: 'Write/append a text file (creates folders). append=true appends. Overwriting an existing file is irreversible, confirm if in doubt.',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Absolute path.' },
                content: { type: 'string', description: 'Content.' },
                append: { type: 'boolean', description: 'Append instead of overwriting.' },
            },
            required: ['path', 'content'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_dir',
        description: 'List files/folders in a directory (name, type, size, mtime). For navigating the file system.',
        input_schema: {
            type: 'object',
            properties: { path: { type: 'string', description: 'Path to the folder (default $HOME).' } },
            additionalProperties: false,
        },
    },
    {
        name: 'http_request',
        description: 'HTTP request to an arbitrary URL (download/check/send). Returns status, headers and body (truncated). Sending data externally — confirm if in doubt.',
        input_schema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'URL.' },
                method: { type: 'string', description: 'GET (default), POST, PUT, DELETE…' },
                headers: { type: 'object', additionalProperties: { type: 'string' }, description: 'Headers.' },
                body: { type: 'string', description: 'Request body.' },
                max_bytes: { type: 'number', description: 'Body read limit.' },
            },
            required: ['url'],
            additionalProperties: false,
        },
    },
    {
        name: 'open_path',
        description: 'Open a file/folder/URL in the default application (macOS open). E.g. show a render in Finder or open a link.',
        input_schema: {
            type: 'object',
            properties: { path: { type: 'string', description: 'Path to a file/folder or URL.' } },
            required: ['path'],
            additionalProperties: false,
        },
    },
];

module.exports = { tools };
