#!/bin/bash
# Installs the Leonardo Workflow Integration plugin into DaVinci Resolve Studio.
# Copies the plugin folder into the system-wide Workflow Integration Plugins root
# (needs admin) and copies the matching WorkflowIntegration.node from the installed
# Resolve SDK so the native ABI always matches your Resolve version.

set -euo pipefail

PLUGIN_ID="com.gleb.leonardo"
SRC="$(cd "$(dirname "$0")" && pwd)"

RESOLVE_SUPPORT="/Library/Application Support/Blackmagic Design/DaVinci Resolve"
DEST_ROOT="$RESOLVE_SUPPORT/Workflow Integration Plugins"
DEST="$DEST_ROOT/$PLUGIN_ID"
NODE_SRC="$RESOLVE_SUPPORT/Developer/Workflow Integrations/Examples/SamplePlugin/WorkflowIntegration.node"

echo "Leonardo — установка плагина"
echo "  источник: $SRC"
echo "  цель:     $DEST"
echo "  (потребуется пароль администратора для записи в /Library)"
echo

if [ ! -f "$NODE_SRC" ]; then
    echo "ОШИБКА: не найден WorkflowIntegration.node по пути:"
    echo "  $NODE_SRC"
    echo "Убедись, что установлена DaVinci Resolve STUDIO (не бесплатная) с компонентом Developer/Workflow Integrations."
    exit 1
fi

sudo mkdir -p "$DEST"

# Copy plugin files (skip VCS/junk; the .node is copied separately below).
sudo rsync -a --delete \
    --exclude '.git' \
    --exclude '.DS_Store' \
    --exclude 'WorkflowIntegration.node' \
    "$SRC"/ "$DEST"/

# Copy the native addon that ships with THIS Resolve version.
sudo cp "$NODE_SRC" "$DEST/WorkflowIntegration.node"

echo
echo "Готово."
echo "Дальше:"
echo "  1) DaVinci Resolve > Preferences > General > External scripting using = Local"
echo "  2) Полностью перезапусти DaVinci Resolve Studio"
echo "  3) Workspace > Workflow Integrations > Leonardo"
echo "  4) В панели нажми ⚙ и вставь свой Anthropic API-ключ (или экспортируй ANTHROPIC_API_KEY)"
