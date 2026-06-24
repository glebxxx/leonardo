#!/bin/bash
# Fetch the Radnika brand webfont locally. These files are NOT redistributed in
# this repository (they are Blackmagic Design's brand font); this script just
# downloads them from Blackmagic's public CDN so the panel can render with them.
# Without them, the UI simply falls back to the system font.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BASE="https://css.blackmagicdesign.com/static/fonts/radnika"
for f in radnika-condensed-webfont.woff2 radnika-condensed-webfont.woff \
         radnika-mediumcondensed-webfont.woff2 radnika-mediumcondensed-webfont.woff; do
    curl -fsSL "$BASE/$f" -o "$DIR/$f" && echo "downloaded $f" || echo "FAILED $f"
done
