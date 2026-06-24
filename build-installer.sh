#!/bin/bash
# Builds "Install Leonardo.app" — a double-clickable installer that embeds the
# current plugin files and, on launch, copies them into place (with a native
# admin-password prompt). Re-run this after changing any plugin code so the
# embedded payload stays in sync.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"            # the leonardo/ source dir
PARENT="$(dirname "$HERE")"
APP="$PARENT/Install Leonardo.app"
SCPT="$HERE/installer/installer.applescript"

echo "Building installer → $APP"

# --- static check of relative require() paths before building ---
# Catches typos in module paths (a syntax check misses these) so a plugin that
# crashes at launch with "Cannot find module" never ships in the payload.
echo "Checking require() paths…"
problems=$(find "$HERE" -name '*.js' -not -path '*/node_modules/*' | while read -r f; do
    d=$(dirname "$f")
    reqs=$(grep -oE "require\('(\.[^']+)'\)" "$f" | sed -E "s/require\('//; s/'\)//" || true)
    for req in $reqs; do
        t="$d/$req"
        if [ -f "$t" ] || [ -f "$t.js" ] || [ -f "$t.node" ] || [ -f "$t/index.js" ]; then
            :
        elif [ "${req##*/}" = "WorkflowIntegration.node" ]; then
            : # copied from the SDK at install time
        else
            echo "  ${f#$HERE/} → $req"
        fi
    done
done || true)
if [ -n "$problems" ]; then
    echo "ERROR: require() points to missing modules:" >&2
    echo "$problems" >&2
    echo "Fix the paths and run the build again." >&2
    exit 1
fi
echo "require() paths OK"

rm -rf "$APP"
osacompile -o "$APP" "$SCPT"

# Embed the plugin payload inside the app bundle (exclude installer scaffolding).
RES="$APP/Contents/Resources/leonardo"
mkdir -p "$RES"
rsync -a --delete \
    --exclude '.git' \
    --exclude '.DS_Store' \
    --exclude 'node_modules' \
    --exclude 'installer' \
    --exclude 'build-installer.sh' \
    --exclude 'install.sh' \
    --exclude 'Install Leonardo.zip' \
    --exclude 'docs' \
    --exclude '.gitignore' \
    "$HERE"/ "$RES"/

# --- app icon: macOS "card" style from img/logo.png ---
ICON_SRC="$HERE/img/logo.png"
if [ -f "$ICON_SRC" ]; then
    TMP="$(mktemp -d)"
    ICON_BASE="$ICON_SRC"
    # Fresh 1024 macOS-style master (rounded corners/margins/shadow/border) via Swift+AppKit.
    if swift "$HERE/installer/make-icon.swift" "$ICON_SRC" "$TMP/card.png" >/dev/null 2>&1 && [ -f "$TMP/card.png" ]; then
        ICON_BASE="$TMP/card.png"
        echo "Card icon generated (macOS style)."
    else
        echo "Could not build the card (no swift?) — using the full-square image."
    fi
    ICONSET="$TMP/leonardo.iconset"
    mkdir -p "$ICONSET"
    for s in 16 32 128 256 512; do
        sips -z "$s" "$s" "$ICON_BASE" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
        d=$((s * 2))
        sips -z "$d" "$d" "$ICON_BASE" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
    done
    iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/applet.icns"
    rm -rf "$TMP"
    touch "$APP"   # nudge Finder to refresh the icon
    echo "Icon installed."
else
    echo "Warning: $ICON_SRC not found — using the default icon."
fi

echo "Done."
echo "Double-click "Install Leonardo" in Finder — it will ask for an admin password and put everything in place."
