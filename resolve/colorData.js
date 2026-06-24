// Color knowledge base: grade recipes (look -> ordered node plan with concrete
// ASC-CDL per node), camera LOG profiles (-> real conversion LUTs in the library
// + RCM input color space), and node-creation variants. Verified CDL values from
// research; LUT paths verified against the installed 163-LUT library.

const LUT_DIR = '/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT';

// Color-page node-creation variants (macOS default keymap) with menu fallback.
const NODE_VARIANTS = {
    serial: { key: 's', modifiers: ['option'], menu: ['Color', 'Nodes', 'Add Serial Node'] },
    serial_before: { key: 's', modifiers: ['shift'], menu: ['Color', 'Nodes', 'Add Serial Node Before Current'] },
    parallel: { key: 'p', modifiers: ['option'], menu: ['Color', 'Nodes', 'Add Parallel Node'] },
    layer: { key: 'l', modifiers: ['option'], menu: ['Color', 'Nodes', 'Add Layer Node'] },
    outside: { key: 'o', modifiers: ['option'], menu: ['Color', 'Nodes', 'Add Outside Node'] },
};

// Each node: {label, role, variant (for nodes after #1), cdl, lut, manual_note}.
// Node #1 always reuses the existing node on the clip (no creation).
const N = (slope, offset, power, saturation) => ({ slope, offset, power, saturation });

const RECIPES = [
    {
        look: 'Clean Natural Correction',
        aliases: ['clean', 'natural', 'correct', 'baseline', 'нейтральная', 'коррекция', 'естественный', 'цветокоррекция'],
        summary: 'Basic correction: neutral, light contrast and a touch of saturation. Default when no style is specified.',
        nodes: [
            { label: 'BALANCE', role: 'balance', cdl: N([1, 1, 1], [0, 0, 0], [1, 1, 1], 1), lut: '', manual_note: 'Precise white balance is picked with the eyedropper off the scopes — the API cannot see this; apply per-channel offsets only when there is an obvious cast.' },
            { label: 'CONTRAST', role: 'contrast', variant: 'serial', cdl: N([1.05, 1.05, 1.05], [-0.005, -0.005, -0.005], [0.95, 0.95, 0.95], 1), lut: '', manual_note: '' },
            { label: 'SAT', role: 'look', variant: 'serial', cdl: N([1, 1, 1], [0, 0, 0], [1, 1, 1], 1.05), lut: '', manual_note: '' },
        ],
    },
    {
        look: 'Cinematic Teal & Orange',
        aliases: ['teal orange', 'teal & orange', 'cinematic', 'блокбастер', 'тил оранж', 'киношный', 'киношно'],
        summary: 'Split tone: teal in the shadows, warm orange in the highlights. Protecting skin tones requires HSL (manual).',
        nodes: [
            { label: 'BALANCE', role: 'balance', cdl: N([1, 1, 1], [0, 0, 0], [1, 1, 1], 1), lut: '', manual_note: '' },
            { label: 'CONTRAST', role: 'contrast', variant: 'serial', cdl: N([1.05, 1.05, 1.05], [-0.008, -0.008, -0.008], [1, 1, 1], 1), lut: '', manual_note: '' },
            { label: 'TEAL_ORANGE', role: 'look', variant: 'serial', cdl: N([1.06, 1, 0.94], [-0.015, 0.005, 0.02], [0.97, 1, 1.03], 1), lut: '', manual_note: 'To keep skin from going red — a separate node with HSL qualification (Hue-vs-Sat/Hue-vs-Hue) or a power window on the face; CDL cannot do this.' },
        ],
    },
    {
        look: 'Warm / Golden Hour',
        aliases: ['warm', 'golden', 'golden hour', 'тёплый', 'тепло', 'золотой час', 'закат'],
        summary: 'Warmth across the whole range, stronger in mids/highlights — a nostalgic golden tone.',
        nodes: [
            { label: 'BALANCE', role: 'balance', cdl: N([1, 1, 1], [0, 0, 0], [1, 1, 1], 1), lut: '', manual_note: '' },
            { label: 'WARM', role: 'look', variant: 'serial', cdl: N([1.06, 1, 0.93], [0.01, 0, -0.01], [0.93, 0.97, 1.05], 1.05), lut: '', manual_note: '' },
        ],
    },
    {
        look: 'Cool / Cold',
        aliases: ['cool', 'cold', 'blue', 'night', 'steel', 'холодный', 'холодно', 'ночь', 'синий', 'сталь'],
        summary: 'Mirror of warm: blue, minus red, colder in the shadows/mids; slightly desaturated.',
        nodes: [
            { label: 'BALANCE', role: 'balance', cdl: N([1, 1, 1], [0, 0, 0], [1, 1, 1], 1), lut: '', manual_note: '' },
            { label: 'COOL', role: 'look', variant: 'serial', cdl: N([0.94, 1, 1.06], [-0.01, 0, 0.015], [1.05, 1, 0.93], 0.95), lut: '', manual_note: '' },
        ],
    },
    {
        look: 'High-Contrast Filmic',
        aliases: ['filmic', 'film', 'high contrast', 'kodak', 'print', 'плёнка', 'киноплёнка', 'контрастный'],
        summary: 'Strong contrast + Kodak 2383 print LUT for a real film shoulder that CDL does not provide.',
        nodes: [
            { label: 'BALANCE', role: 'balance', cdl: N([1, 1, 1], [0, 0, 0], [1, 1, 1], 1), lut: '', manual_note: '' },
            { label: 'CONTRAST_split', role: 'contrast', variant: 'serial', cdl: N([1.2, 1.18, 1.15], [-0.025, -0.02, -0.012], [1.05, 1.05, 1.05], 0.95), lut: '', manual_note: '' },
            { label: 'FILM_PRINT', role: 'look', variant: 'serial', cdl: N([1, 1, 1], [0, 0, 0], [1, 1, 1], 1), lut: 'Film Looks/Rec709 Kodak 2383 D65.cube', manual_note: 'For an honest film shoulder, add a Custom Curve (soft highlight shoulder) and Hue-vs-Lum — manually; the print LUT expects normalized Rec709 at its input, not raw log.' },
        ],
    },
    {
        look: 'Vintage / Faded Film',
        aliases: ['vintage', 'faded', 'retro', 'lifted blacks', 'old film', 'винтаж', 'выцветший', 'ретро', 'плёночный'],
        summary: 'Lifted black point (offset+), reduced contrast, cyan shift in the shadows, muted saturation.',
        nodes: [
            { label: 'BALANCE', role: 'balance', cdl: N([1, 1, 1], [0, 0, 0], [1, 1, 1], 1), lut: '', manual_note: '' },
            { label: 'FADE', role: 'look', variant: 'serial', cdl: N([0.88, 0.88, 0.9], [0.04, 0.035, 0.045], [1, 1, 0.97], 0.8), lut: '', manual_note: 'Film grain — a separate OFX node/grain LUT at the end of the pipeline (not CDL); add it manually for texture.' },
        ],
    },
    {
        look: 'Cinematic Black & White',
        aliases: ['black and white', 'b&w', 'bw', 'monochrome', 'grayscale', 'чб', 'чёрно-белый', 'монохром'],
        summary: 'Quality B&W from 3 nodes: channel shift BEFORE desaturation (how colors map to gray) → full desaturation → contrast.',
        nodes: [
            { label: 'CHANNEL_PUSH', role: 'balance', cdl: N([1.2, 1, 0.85], [0, 0, 0], [1, 1, 1], 1), lut: '', manual_note: 'The fine mapping of hues to gray is done with Hue-vs-Lum on this node (manually) — CDL only does it crudely, like a channel mixer.' },
            { label: 'DESATURATE', role: 'look', variant: 'serial', cdl: N([1, 1, 1], [0, 0, 0], [1, 1, 1], 0), lut: '', manual_note: '' },
            { label: 'CONTRAST_bw', role: 'contrast', variant: 'serial', cdl: N([1.15, 1.15, 1.15], [-0.015, -0.015, -0.015], [1.05, 1.05, 1.05], 0), lut: '', manual_note: '' },
        ],
    },
    {
        look: 'Bright & Airy',
        aliases: ['bright', 'airy', 'pastel', 'light', 'high key', 'светлый', 'воздушный', 'пастельный', 'яркий'],
        summary: 'Open shadows and mids, low contrast, pastel light desaturation. Watch out for highlight clipping.',
        nodes: [
            { label: 'BALANCE', role: 'balance', cdl: N([1, 1, 1], [0, 0, 0], [1, 1, 1], 1), lut: '', manual_note: '' },
            { label: 'AIRY', role: 'look', variant: 'serial', cdl: N([1.03, 1.03, 1], [0.02, 0.02, 0.022], [0.85, 0.85, 0.85], 0.9), lut: '', manual_note: 'Offset+ and power<1 can drive highlights into clipping: if whites are >~940 — lower the slope or add an output-limiter node.' },
        ],
    },
    {
        look: 'Moody / Dark',
        aliases: ['moody', 'dark', 'low key', 'dramatic', 'somber', 'мрачный', 'мрачно', 'тёмный', 'драма', 'лоу-кей'],
        summary: 'Deep shadows, darkened mids, held-back highlights, cool desaturation.',
        nodes: [
            { label: 'BALANCE', role: 'balance', cdl: N([1, 1, 1], [0, 0, 0], [1, 1, 1], 1), lut: '', manual_note: '' },
            { label: 'MOODY', role: 'look', variant: 'serial', cdl: N([0.95, 0.95, 0.97], [-0.025, -0.02, -0.018], [1.15, 1.12, 1.1], 0.85), lut: '', manual_note: 'A vignette strongly enhances the mood — add an Outside/Power Window node manually (Option+O after a circular window); geometry cannot be expressed in CDL.' },
        ],
    },
    {
        look: 'Bleach Bypass',
        aliases: ['bleach bypass', 'bleach', 'silver retention', 'война', 'десатур', 'обесцвеченный'],
        summary: 'Low saturation + high luminance contrast, lively blacks. A harsh steely war look.',
        nodes: [
            { label: 'BALANCE', role: 'balance', cdl: N([1, 1, 1], [0, 0, 0], [1, 1, 1], 1), lut: '', manual_note: '' },
            { label: 'BLEACH', role: 'look', variant: 'serial', cdl: N([1.22, 1.2, 1.16], [-0.005, -0.005, 0], [1, 1, 1], 0.7), lut: '', manual_note: 'Classic bleach-bypass — overlay a desaturated, high-contrast copy via a Layer Mixer in Hardlight/Overlay (UI, not CDL). Hold skin at ~-10..-15% sat with Hue-vs-Sat, not globally.' },
        ],
    },
];

// Camera LOG profiles -> real conversion LUT (relative to LUT_DIR) + RCM input color space.
const CAMERA_PROFILES = [
    { key: 'sony_slog3', label: 'Sony S-Log3 / S-Gamut3.Cine', brand: 'Sony', log: 'S-Log3', match: ['sony', 'slog3', 's-log3', 'sgamut3', 's-gamut3', 'xavc', 'venice', 'burano', 'fx3', 'fx6', 'fx9', 'fx30', 'a7s', 'a7iv', 'a1', 'ilce'], ext: [], lut: 'Sony/SLog3SGamut3.CineToLC-709.cube', input_color_space: 'Sony S-Gamut3.Cine/S-Log3' },
    { key: 'sony_slog2', label: 'Sony S-Log2', brand: 'Sony', log: 'S-Log2', match: ['slog2', 's-log2', 'sgamut'], ext: [], lut: 'Sony SLog2 to Rec709.ilut', input_color_space: 'Sony S-Gamut/S-Log2' },
    { key: 'panasonic_vlog', label: 'Panasonic V-Log / V-Gamut', brand: 'Panasonic', log: 'V-Log', match: ['panasonic', 'v-log', 'vlog', 'vgamut', 'v-gamut', 'varicam', 'lumix', 'gh5', 'gh6', 'gh7', 's1h', 's5', 'bgh1', 'eva1'], ext: [], lut: 'Panasonic/V-Log to V-709.cube', input_color_space: 'Panasonic V-Gamut/V-Log' },
    { key: 'arri_logc', label: 'ARRI LogC / Wide Gamut', brand: 'ARRI', log: 'LogC', match: ['arri', 'alexa', 'logc', 'log-c', 'arriraw', 'amira', 'alev'], ext: ['.ari', '.arx'], lut: 'Arri/Arri Alexa LogC to Rec709.dat', input_color_space: 'ARRI LogC3 (SUP3.x & 4.x)/ARRI Wide Gamut 3' },
    { key: 'canon_clog', label: 'Canon Log / Cinema Gamut', brand: 'Canon', log: 'Canon Log', match: ['canon', 'clog', 'c-log', 'clog2', 'clog3', 'cinema gamut', 'eos', 'c70', 'c300', 'c500', 'c400'], ext: ['.crm', '.rmf'], lut: 'Canon Log to Rec709.ilut', input_color_space: 'Canon Cinema Gamut/Canon Log3' },
    { key: 'red_log3g10', label: 'RED Log3G10 / REDWideGamutRGB', brand: 'RED', log: 'Log3G10', match: ['red', 'log3g10', 'redwidegamut', 'rwg', 'komodo', 'raptor', 'helium', 'monstro', 'dragon', 'v-raptor'], ext: ['.r3d'], lut: 'RED/RWG_Log3G10_to_REC709_BT1886_with_LOW_CONTRAST_and_R_3_Soft_size_33.cube', input_color_space: 'REDWideGamutRGB/Log3G10' },
    { key: 'bmd_film_gen5', label: 'Blackmagic Film Gen5 / Wide Gamut', brand: 'Blackmagic', log: 'BMD Film', match: ['blackmagic', 'bmd', 'braw', 'film gen', 'widegamutgen', 'pocket', 'ursa', 'pyxis', 'cinema camera'], ext: ['.braw'], lut: 'Blackmagic Design/Blackmagic 4.6K Film to Rec709.cube', input_color_space: 'Blackmagic Design Wide Gamut Gen5/Blackmagic Design Film Gen5' },
    { key: 'dji_dlog', label: 'DJI D-Log / D-Gamut', brand: 'DJI', log: 'D-Log', match: ['dji', 'd-log', 'dlog', 'd-gamut', 'mavic', 'ronin', 'inspire', 'osmo', 'zenmuse', 'pocket'], ext: [], lut: 'DJI/DJI_X7_DLOG2Rec709.cube', input_color_space: 'DJI D-Gamut/D-Log' },
    { key: 'fujifilm_flog', label: 'Fujifilm F-Log / F-Gamut', brand: 'Fujifilm', log: 'F-Log', match: ['fujifilm', 'fuji', 'f-log', 'flog', 'f-log2', 'x-h2', 'x-t', 'gfx'], ext: [], lut: '', input_color_space: 'FUJIFILM F-Gamut/F-Log' },
    { key: 'nikon_nlog', label: 'Nikon N-Log / N-Gamut', brand: 'Nikon', log: 'N-Log', match: ['nikon', 'n-log', 'nlog', 'z9', 'z8', 'z6', 'z7', 'zf'], ext: [], lut: '', input_color_space: 'Nikon N-Gamut/N-Log' },
];

function norm(s) {
    return String(s || '').toLowerCase().trim();
}

function findRecipe(query) {
    const q = norm(query);
    if (!q) return null;
    let hit = RECIPES.find((r) => norm(r.look) === q);
    if (!hit) hit = RECIPES.find((r) => r.aliases.some((a) => norm(a) === q));
    if (!hit) hit = RECIPES.find((r) => norm(r.look).includes(q) || r.aliases.some((a) => norm(a).includes(q) || q.includes(a)));
    return hit || null;
}

// Best-effort camera/LOG detection from a blob of metadata/property text + extension.
function detectProfile(blob, ext) {
    const b = norm(blob);
    const e = norm(ext);
    let best = null;
    let bestScore = 0;
    let reasons = [];
    for (const p of CAMERA_PROFILES) {
        let score = 0;
        const why = [];
        for (const kw of p.match) {
            if (b.includes(kw)) {
                score += kw.length > 3 ? 2 : 1;
                why.push(kw);
            }
        }
        for (const x of p.ext || []) {
            if (e.includes(x)) {
                score += 3;
                why.push(x);
            }
        }
        if (score > bestScore) {
            bestScore = score;
            best = p;
            reasons = why;
        }
    }
    if (!best || bestScore === 0) return null;
    return {
        key: best.key,
        label: best.label,
        brand: best.brand,
        log: best.log,
        lut: best.lut || null,
        input_color_space: best.input_color_space || null,
        matched: reasons,
        confidence: bestScore >= 4 ? 'high' : bestScore >= 2 ? 'medium' : 'low',
    };
}

function getProfile(key) {
    const k = norm(key);
    return CAMERA_PROFILES.find((p) => p.key === k || norm(p.brand) === k || p.match.includes(k)) || null;
}

module.exports = { LUT_DIR, NODE_VARIANTS, RECIPES, CAMERA_PROFILES, findRecipe, detectProfile, getProfile };
