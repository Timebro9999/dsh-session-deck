# Changelog

## 0.2.2 — no duplicated sections after a plugin update

Leaving the desktop app open across a plugin update (or any profile change) could leave the sidebar
"scrambled": the section headers — most visibly 组件 — piled up, one per plugin instance. The shell does
not unload an old client instance when it reloads a bundle, and every instance paints its own copy of the
sidebar furniture; a restart used to be the only cure.

Now every pass picks a winner **structurally**: the instance that is scanning keeps its own container and
hides every other copy of it (the 置顶/项目 band, the activity panel, the 组件 header). Nodes are hidden
rather than removed, because an owner whose node was removed simply inserts a new one — hiding is what
actually converges. If a newer instance marks this one stale, this one stands down instead of fighting.

## 0.2.1 — the pinned area matches the project area, and the data never goes stale

- **Type metric.** The section heads and pinned rows no longer hard-code a font size: they inherit the
  shell's own row metric, exactly like the shipped project rows, so 置顶 and 项目 are the same size in
  every theme.
- **Self-healing reads.** The session/workspace snapshot is cached for half a second and the store
  subscriptions are (re)attached on every read, not only at mount. A plugin that mounted before the
  client services were live used to keep serving an empty snapshot — which is how the activity view could
  show "nothing yet" next to a sidebar full of conversations, and how a running conversation could miss
  its ring.
- **Container takeover.** Section/pinned nodes and the activity panel now carry the same stale marker the
  bell uses: when a newer instance takes over, the older one stands down instead of re-inserting its copy
  (a page can hold instances from earlier bundle loads; the shell does not unload them).

## 0.2.0 — live everywhere, and the running ring

- **One state, every view.** The pinned band and the activity view now resolve each row against the live
  session/workspace stores instead of the snapshot taken when you pinned it: rename a conversation and it
  renames in every view the moment the shell broadcasts it; the same for a project title, a running turn,
  and the project icon. The stored snapshot is only the fallback (and is refreshed with what we resolved).
- **The shell's own running ring.** A conversation that is working shows the same 14px spinner ring the
  project list shows — same geometry, colour and 1.5s period, `prefers-reduced-motion` respected — in the
  pinned band (including the conversations unfolded under a pinned project) and in the activity view,
  instead of the project emoji.

## 0.1.1 — cross-platform copy

- The emoji-panel hint is now platform-aware: macOS (`Control + Command + Space`), Windows (`Win + .`),
  anything else gets the neutral wording. Nothing else in the plugin was platform-specific — it is a
  browser-side DOM overlay, so the same build runs in the macOS, Windows and Linux desktop apps.
- README: an explicit "Platform" line, and a test that fails if a macOS-only shortcut leaks into the
  copy on a non-Mac platform.

## 0.1.0 — first public release

Everything below is the initial release: the plugin was developed against DSH `0.1.7-rc.2` in a live profile.

- **Pinned band (置顶)** — pin conversations *and* projects into one band at the top of the workspace list
  (the built-in pin only orders a conversation inside its own project). Rows are click-to-open,
  `✕` unpins, the header collapses.
- **Activity view (bell)** — a bell at the end of the workspace icon row switches the sidebar to
  "recently used": day groups (today / yesterday / weekday / date), two-line rows with the project name
  and **the beginning of the last answer** as preview, running indicator, click-through that keeps the
  view open.
- **Project icons** — replace a project's folder icon with an emoji, on the sidebar project rows and in
  the directory picker, from a Codex-style picker (recent row, category tabs, grid, reset).
- **Collapsible sections** — 置顶 / 项目 / 组件 headers, each collapsing its own area; the project list is
  hidden by a class on the scroller (the shipped rows are never removed), the widgets section hides only
  the sidebar's foot actions, never the settings/account row.
- No slots, no client services required: the plugin is a pure DOM overlay (`inject: []`), marking every
  node it adds so a reload reclaims its predecessor's leftovers.
- 148 + 7 assertions in `npm test` (fake DOM + fake module loader + fake client services, no dependencies).
