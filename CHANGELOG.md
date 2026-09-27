# Changelog

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
