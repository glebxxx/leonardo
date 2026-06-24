# Leonardo для DaVinci Resolve

Встроенная в DaVinci Resolve **Studio** панель-чат **Leonardo** (работает на модели Claude).
Пишешь задачу на естественном языке — Leonardo управляет Resolve через scripting API
(страницы, проекты, медиапул, таймлайны, маркеры, рендер).

Это **Workflow Integration Plugin** (Electron-панель внутри Resolve), а не OFX-плагин:
OFX обрабатывает только пиксели кадра и не имеет доступа к таймлайну/медиапулу/рендеру,
поэтому для «чата, управляющего программой» он не подходит.

## Требования

- **DaVinci Resolve Studio** (платная) — Workflow Integrations есть только в Studio.
  Проверено на Resolve 21.0.0 (macOS).
- Anthropic API-ключ.
- Node/npm **не нужны**: плагин ходит в Anthropic API через встроенный в Electron `fetch`,
  внешних зависимостей нет.

## Установка

### Вариант 1 — двойным кликом (рекомендуется)

Дважды кликни **`Install Leonardo.app`** (лежит рядом с папкой `leonardo`).
Он покажет нативный запрос пароля администратора и сам разложит всё по местам.

Если приложения нет или ты менял код плагина — пересобери его:
```bash
cd "leonardo"
./build-installer.sh        # создаёт ../Install Leonardo.app со свежим payload
```
> Payload вшит внутрь `.app` снимком, поэтому после правок кода плагина
> запусти `build-installer.sh` заново, иначе установится старая версия.

### Вариант 2 — из терминала

```bash
cd "leonardo"
./install.sh
```

Оба способа делают одно и то же:
1. копируют файлы плагина в системную папку
   `/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins/com.gleb.leonardo/`
   (нужен пароль администратора);
2. копируют `WorkflowIntegration.node` из SDK твоей версии Resolve (ABI должен совпадать).

Затем:
1. **Preferences → General → External scripting using = Local**;
2. полностью перезапусти Resolve Studio;
3. **Workspace → Workflow Integrations → Leonardo**;
4. в панели нажми **⚙** и вставь Anthropic API-ключ.

## API-ключ

Ключ берётся в таком порядке:
1. переменная окружения `ANTHROPIC_API_KEY` (работает, только если Resolve запущен из терминала —
   GUI-приложения из Dock не наследуют переменные шелла);
2. файл `~/.leonardo.json` (`{"apiKey": "...", "model": "claude-opus-4-8"}`),
   куда панель сохраняет ключ из настроек (права `600`).

Ключ хранится и используется только в main-процессе Electron; в песочницу renderer он не попадает.

## Что умеет (инструменты)

| Инструмент | Действие |
|---|---|
| `get_status` | текущая страница, проект, таймлайны |
| `open_page` | переключить страницу (media/cut/edit/fusion/color/fairlight/deliver) |
| `list_projects` / `create_project` / `open_project` | проекты |
| `create_bin` | создать и выбрать bin |
| `import_media` | импорт файлов в текущий bin |
| `create_timeline_from_current_bin` / `create_empty_timeline` | таймлайны |
| `list_timelines` / `select_timeline` | выбор таймлайна |
| `add_timeline_marker` | маркер на таймлайн |
| `get_render_presets` / `render_current_timeline` | очередь и запуск рендера |

**Монтаж (timeline editing):**

| Инструмент | Действие |
|---|---|
| `list_timeline_clips` | список клипов дорожки с позициями (индексы 1-based) |
| `get_playhead` / `set_playhead` | таймкод плейхеда |
| `delete_clips` | удалить клипы: `ripple=true` — со сдвигом (ripple), `false` — с зазором (lift) |
| `append_clip` | добавить клип, обрезав по `source_start`/`source_end` (trim на вставке) |
| `blade_at_playhead` | разрезать клип в точке плейхеда (Cmd+\, нужен Accessibility) |
| `detect_scene_cuts` | авто-нарезка по сменам сцен |
| `add_track` / `delete_track` / `set_track_enabled` / `set_track_locked` | дорожки |
| `create_compound_clip` | объединить клипы в compound |
| `set_clip_color` / `add_title` / `set_timeline_start_timecode` | прочее |

> **Про trim/cut:** scripting API Resolve умеет ripple-удаление, обрезку-на-вставке и авто-нарезку
> напрямую, но НЕ умеет «лезвие» в произвольной точке и трим краёв существующего клипа — это GUI-операции.
> Поэтому `blade_at_playhead` нажимает системную горячую клавишу (Cmd+\) и требует разрешения
> **System Settings → Privacy & Security → Accessibility → DaVinci Resolve**.
> Классический «вырезать фрагмент» = blade в начале, blade в конце, затем `delete_clips(ripple=true)` на средний кусок.

**Полный контроль (любое действие):**

| Инструмент | Действие |
|---|---|
| `run_menu_command` | выполнить ЛЮБОЙ пункт меню по пути, напр. `["Timeline","Add Transition"]` |
| `press_shortcut` | нажать шорткат: по имени `action` (напр. `"Add Transition"`, `"Split Clip"`) — клавиши подставятся из карты; или вручную `key`/`special`+модификаторы |
| `lookup_shortcuts` | найти горячие клавиши по запросу (карта дефолтной раскладки Resolve, ~32 действия) |
| `list_menus` | прочитать РЕАЛЬНУЮ структуру меню запущенного Resolve (для точного `run_menu_command`) |
| `type_text` | напечатать текст (поиск/переименование) |

> Карта шорткатов — `resolve/shortcuts.js` (дефолтная раскладка macOS). Leonardo вызывает `press_shortcut`
> по имени действия, поэтому не угадывает клавиши. Если ты менял раскладку или клавиша не сработала —
> используй `run_menu_command` (не зависит от раскладки). Точные операции (ripple/lift-удаление, маркеры)
> идут через API, а не клавишами.

> Эти три инструмента дают **человеческий уровень контроля** — всё, что есть в меню и на горячих клавишах
> (переходы, трим, любые команды), даже если этого нет в scripting API. Работают через системную
> автоматизацию и требуют **Accessibility** для DaVinci Resolve. Leonardo предпочитает прямые API-инструменты,
> а к UI-командам обращается только для того, чего в API нет.
>
> **Про davinci-resolve-mcp:** он построен на том же Python scripting API (тот же потолок, без blade/trim),
> поэтому полезен как референс для расширения API-покрытия, но «полноту» даёт именно слой UI-контроля выше.

**Цвет и грейдинг:**

| Инструмент | Действие |
|---|---|
| `grade_clip` | построить лук под запрос (ноды через UI + CDL/LUT через API), вернуть manual_steps |
| `list_grade_recipes` | 10 луков (clean/teal&orange/warm/cool/filmic/vintage/bw/bright/moody/bleach) |
| `apply_cdl_to_node` / `apply_lut_to_node` | примитивы CDL/LUT на ноду |
| `add_serial_node` / `get_node_info` / `reset_grade` / `set_node_enabled` | работа с нодами |
| `list_luts` / `apply_powergrade` | LUT-библиотека / применить .drx PowerGrade |
| `manage_color_versions` / `manage_color_group` / `copy_grade_to_clips` | версии/группы/копирование грейда |
| `export_clip_lut` / `stabilize_clip` / `grab_timeline_stills` | экспорт LUT / стабилизация / стиллы |
| **`detect_camera`** | определить камеру/LOG по метаданным (Sony S-Log3, V-Log, LogC, C-Log, Log3G10, BRAW, D-Log…) |
| **`apply_log_profile`** | привести LOG→Rec.709 конверсионным LUT камеры или через Input Color Space (RCM) |

> **Архитектура грейда:** значения грейда (ASC-CDL `SetCDL`, `SetLUT`) идут через API, но **создание нод** в API отсутствует — ноды строятся UI-автоматизацией на Color page (Option+S и т.д., нужен Accessibility). Поэтому `grade_clip` всегда возвращает `manual_steps`: кривые/S-curve, HSL-квалификация и защита кожи, power-window виньетки, layer-mixer — это делается вручную. Для LOG-материала пайплайн: `detect_camera` → `apply_log_profile` (LOG→Rec.709) → `grade_clip`.

Примеры запросов: «что сейчас открыто?», «создай проект Demo и пустой таймлайн Rough Cut»,
«импортируй /Users/gleb/clips/a.mov и /Users/gleb/clips/b.mov и собери из них таймлайн»,
«перейди на Color», «отрендери текущий таймлайн пресетом H.265 в /Users/gleb/out как final».

## Архитектура

```
Resolve Studio ──launches──> main.js (Electron main)
  ├─ require WorkflowIntegration.node ─ Initialize(PLUGIN_ID) ─ GetResolve()
  ├─ ipcMain 'chat:send' ─> agent/agentLoop.js  (цикл tool-use)
  │     ├─ lib/anthropic.js     стрим Messages API (SSE, fetch)
  │     ├─ agent/tools.js       JSON-схемы инструментов
  │     └─ resolve/resolveTools dispatch ─> resolve/resolveClient (Resolve API)
  └─ BrowserWindow ─ preload.js (contextBridge) ─ index.html / renderer.js (чат)
```

Поток одного сообщения: renderer → `chat:send` → цикл: Leonardo (Claude) стримит ответ;
если есть `tool_use` — выполняем в Resolve, отдаём `tool_result` обратно и повторяем,
пока не `end_turn`. Текст стримится в чат, вызовы инструментов показываются «чипами».

## Отладка

Раскомментируй в `main.js`:
```js
mainWindow.webContents.openDevTools({ mode: 'detach' });
```
Ошибки подключения к Resolve обычно означают, что выключен External scripting (см. выше)
или `PLUGIN_ID` в `pluginConfig.js` не совпадает с `<Id>` в `manifest.xml`.

## Безопасность / ограничения

- Тяжёлые/необратимые действия (`render_current_timeline`, `create_project`) выполняются
  только после явного согласия — это задано в системном промпте. Жёсткого диалога-подтверждения
  пока нет (см. «Дальнейшие шаги»).
- `import_media` принимает только абсолютные пути к конкретным файлам.

## Дальнейшие шаги

- Модальное подтверждение перед деструктивными инструментами (human-in-the-loop).
- Больше инструментов: транскрипт/субтитры, базовый цвет, нарезка по таймкодам, экспорт XML/EDL.
- Хранение ключа в macOS Keychain вместо файла.
- Кэширование системного промпта и списка инструментов (prompt caching) для экономии токенов.
