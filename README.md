# dsh-session-deck

A Codex-style sidebar for **DeepSeek Harness**: a pinned band for projects *and* conversations,
collapsible `置顶 / 项目 / 组件` sections, a bell that switches the sidebar to a "recently used" activity
view, and per-project emoji icons.

![status](https://img.shields.io/badge/dsh-0.1.7--rc.2-blue)

## What it adds

| Where | What |
| --- | --- |
| Pinned band (`置顶`) | Pin a conversation **or a whole project** to one band above every project — the built-in pin only orders a conversation inside its own project. A pinned project unfolds in place to list its conversations. Click to open, `✕` to unpin, the header collapses. |
| Bell (`🔔`) | The last icon of the workspace row switches the sidebar to **recently used**: day groups (today / yesterday / weekday / date), two lines per row — title + project, then **the beginning of the last answer** — a running indicator, and click-through that keeps the view open so you can pick several conversations in a row. |
| Project icons | Replace a project's folder icon with any emoji, both on the sidebar's project rows and in the directory picker. A Codex-style picker: recent row, category tabs, icon grid, reset. |
| Sections | `置顶`, `项目` (the shipped project list) and `组件` (the sidebar's bottom widgets) each collapse from their header. |

Interaction, storage layout and the shipped CSS it mirrors are documented in
[`docs/implementation.md`](docs/implementation.md) (Chinese) — it is the working notebook of the plugin.

## Install

```bash
# from npm (once published)
dsh plugin --profile desktop add dsh-session-deck

# or straight from this repository
dsh plugin --profile desktop add github:Timebro9999/dsh-session-deck
```

Restart the desktop app (or reload the window) once; after that the plugin reloads with the profile.

## Requirements

- DSH `0.1.7-rc.2` on the desktop profile (the plugin reads the shipped sidebar's DOM and its client
  services; there is no slot or service contract to depend on).
- No runtime dependencies. No build step: `lib/client.js` is hand-written and shipped as-is.

## How it works (in one paragraph)

The plugin registers **no slot** and requires **no client service** (`inject: []`). It mounts a DOM
overlay: it finds the shipped sidebar's own rows (`[data-row-key^="workspace:"]`, `session:`, the section
header, the list scroller, the foot area), adds controls styled from the row's own buttons, and paints
states that the shell does not offer. Data it needs beyond the DOM comes from the client services it
reads on demand (`ctx.get('sessions' | 'workspaces' | 'uiWorkspace' | 'locale')`), and every node it
inserts is marked `data-dsh-session-deck` so a later mount reclaims its predecessor's leftovers — the
shell does not unload a plugin's old client instance when it reloads a bundle.

## Storage

Everything lives in the browser's `localStorage` (per DSH home):

| Key | Contents |
| --- | --- |
| `dsh-session-deck:v1` | `{ emoji, recent, pinnedSessions, pinnedProjects, expandedProjects, pinnedCollapsed, workspaceCollapsed, widgetsCollapsed }` |
| `dsh-session-deck:previews:v3` | The answer preview of each conversation, keyed by its `updatedAt` stamp |

Project icons are stored twice on purpose — under the workspace id when a surface knows it, and under
`name:<basename>` when only the folder name exists (the directory picker) — and either key resolves on
every surface.

## Development

```bash
npm test        # 148 + 7 assertions, no dependencies
```

The suite boots the real `lib/client.js` under a fake module loader with a fake DOM, a fake client
context and fake session records, then drives every surface: registrations, painted icons, triggers, the
picker, the pinned band, the sections, the activity view (including which part of a message becomes the
preview), locale handling and unload/reload safety.

## Uninstall

```bash
dsh plugin --profile desktop remove dsh-session-deck
```

The plugin has no host-side state; removing it and reloading leaves the shell exactly as it was.

## License

MIT
