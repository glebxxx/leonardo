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

echo "Сборка установщика → $APP"

# --- статическая проверка относительных require перед сборкой ---
# Ловит опечатки в путях модулей (которые синтаксис-чек не видит), чтобы в
# payload не уехал плагин, падающий при запуске с "Cannot find module".
echo "Проверка require-путей…"
problems=$(find "$HERE" -name '*.js' -not -path '*/node_modules/*' | while read -r f; do
    d=$(dirname "$f")
    reqs=$(grep -oE "require\('(\.[^']+)'\)" "$f" | sed -E "s/require\('//; s/'\)//" || true)
    for req in $reqs; do
        t="$d/$req"
        if [ -f "$t" ] || [ -f "$t.js" ] || [ -f "$t.node" ] || [ -f "$t/index.js" ]; then
            :
        elif [ "${req##*/}" = "WorkflowIntegration.node" ]; then
            : # подкладывается из SDK при установке
        else
            echo "  ${f#$HERE/} → $req"
        fi
    done
done || true)
if [ -n "$problems" ]; then
    echo "ОШИБКА: require указывает на несуществующие модули:" >&2
    echo "$problems" >&2
    echo "Исправь пути и запусти сборку снова." >&2
    exit 1
fi
echo "require-пути OK"

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
    "$HERE"/ "$RES"/

# --- иконка приложения: macOS-«карточка» из img/logo.png ---
ICON_SRC="$HERE/img/logo.png"
if [ -f "$ICON_SRC" ]; then
    TMP="$(mktemp -d)"
    ICON_BASE="$ICON_SRC"
    # Свежий 1024-мастер в стиле macOS (скругление/поля/тень/рамка) через Swift+AppKit.
    if swift "$HERE/installer/make-icon.swift" "$ICON_SRC" "$TMP/card.png" >/dev/null 2>&1 && [ -f "$TMP/card.png" ]; then
        ICON_BASE="$TMP/card.png"
        echo "Иконка-карточка сгенерирована (macOS-стиль)."
    else
        echo "Не удалось собрать карточку (нет swift?) — беру картинку во весь квадрат."
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
    touch "$APP"   # подтолкнуть Finder обновить иконку
    echo "Иконка установлена."
else
    echo "Внимание: $ICON_SRC не найден — иконка по умолчанию."
fi

echo "Готово."
echo "Дважды кликни «Install Leonardo» в Finder — установщик запросит пароль администратора и всё разложит по местам."
