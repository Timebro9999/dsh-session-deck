**English** | [简体中文](README.zh-CN.md)

# dsh-session-deck

**Manage your whole workspace, not just one conversation.** A Codex-style sidebar for DeepSeek Harness:
pin projects *and* conversations to one band, switch the sidebar to a "recently used" activity view,
give every project its own icon, and collapse the sections you are not using.

![dsh](https://img.shields.io/badge/dsh-0.1.7--rc.2-blue)
![tests](https://img.shields.io/badge/tests-148%20%2B%207-brightgreen)
![license](https://img.shields.io/badge/license-MIT-green)

## Why

DSH's sidebar is organized per project, and that is fine until you work across several of them:

- the built-in pin only reorders a conversation **inside its own project** — there is no place for
  "these are the threads I am actually working on right now";
- the projects you use most sit wherever they happened to be created, and every project looks the same
  (one folder glyph);
- finding "what did I touch yesterday" means scrolling a tree;
- the bottom of the column fills up with widgets you cannot get out of the way.

This plugin adds the four things you reach for: **a pinned band, a recent view, an icon per project, and
collapsible sections.**

## What you get

| | |
| --- | --- |
| **Pinned band** (`置顶`) | Pin a conversation **or a whole project** into one band above every project. A pinned project unfolds in place and lists its own conversations — like the project row below, but reachable without scrolling. Click to open, `✕` to unpin, the header collapses. |
| **Activity view** (`🔔`) | The last icon of the workspace row switches the sidebar to **recently used**: day groups (today / yesterday / weekday / date), two lines per conversation (title + project, then **the beginning of the last answer**), a running indicator, and click-through that keeps the view open so you can walk through several threads in a row. |
| **Project icons** | Replace a project's folder icon with any emoji — on the sidebar's project rows *and* in the directory picker. A Codex-style picker: recently used, category tabs, an icon grid, and reset. |
| **Collapsible sections** | `置顶`, `项目` (the shipped project list) and `组件` (the sidebar's bottom widgets) each collapse from their own header and remember their state. |

## Sidebar anatomy

```
┌ 工作区                        🔍  ⌘  📁+  🔔   ← the bell opens the activity view
│ ▾ 置顶                                  3       ← pinned band (conversations + projects)
│   ▸ 🌈 deepseek调试                     项目
│     🚀 新出了个GLM5.3 flashx…           会话
│     🌈 我没发现现在有什么这个左侧…      会话
│   ────────────────────────────────────
│ ▾ 项目                                  9       ← the shipped project list, collapsible
│   📁 pdf
│   🚀 前沿方向研究
│       新出了个GLM5.3 flashx…            1天
└
  ⋯ widgets ⋯
  ▸ 组件                                          ← the bottom widgets, collapsible
```

## Usage

1. **Pin** — hover a conversation row and press `☆` in its action strip, or hover a project row and
   press the `☆` left of the pencil. The pinned band appears on top; its header collapses it and `✕`
   removes a single pin.
2. **Recent** — press the bell at the end of the workspace row. Pick a conversation; the view stays
   open, so you can pick several. Press the bell again (or `✕`) to return to the project list.
3. **Icons** — hover a project row and press the pencil (or right-click the row) to open the picker.
   Pick an emoji, paste one from the system emoji panel (⌃⌘Space), or reset to the folder glyph. The
   same picker works on the folder rows inside the directory picker.
4. **Collapse** — click any section header (`置顶` / `项目` / `组件`). States are remembered per DSH home.

## Install

```bash
# from npm (once published)
dsh plugin --profile desktop add dsh-session-deck

# or straight from this repository
dsh plugin --profile desktop add github:Timebro9999/dsh-session-deck
```

Restart the desktop app (or reload the window) once; after that the plugin loads with the profile.

Listing in the DSH plugin market comes from the curated index
[`awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) (the market reads its
`plugins.json`). The submission is one file — `data/plugins/Timebro9999__dsh-session-deck.yml`, kept in
this repo under [`marketplace/`](marketplace) — and
[`scripts/open-marketplace-pr.sh`](scripts/open-marketplace-pr.sh) opens the PR.

## Requirements

- DSH `0.1.7-rc.2` on the desktop profile. The plugin reads the shipped sidebar's DOM and its client
  services, so there is no slot or service contract to depend on — but a future shell redesign can move
  the anchors it uses.
- No runtime dependencies and **no build step**: [`lib/client.js`](lib/client.js) is hand-written and
  shipped as-is.
- The interface follows DSH's own language (the locale service first, then the rendered UI, then the
  browser), so its copy is Chinese or English like the rest of the app.

## How it works

The plugin registers **no slot** and requires **no client service** (`inject: []`). It mounts a DOM
overlay: it finds the shipped rows (`[data-row-key^="workspace:"]`, `session:`), the section header, the
list scroller and the sidebar foot area; adds controls styled from the row's own buttons; and paints the
states the shell does not offer. Anything it needs beyond the DOM comes from client services it reads on
demand (`ctx.get('sessions' | 'workspaces' | 'uiWorkspace' | 'locale')`).

Every node it inserts is marked `data-dsh-session-deck`, so a later mount reclaims its predecessor's
leftovers — the shell does not unload an old client instance when it reloads a bundle. The working
notebook of that exploration (anchors, mirrored CSS, traps, and the remote probe that reports page state
through a slot id) lives in [`docs/implementation.md`](docs/implementation.md) (Chinese).

## Storage

Everything is browser `localStorage`, per DSH home:

| Key | Contents |
| --- | --- |
| `dsh-session-deck:v1` | `{ emoji, recent, pinnedSessions, pinnedProjects, expandedProjects, pinnedCollapsed, workspaceCollapsed, widgetsCollapsed }` |
| `dsh-session-deck:previews:v3` | The answer preview of each conversation, keyed by its `updatedAt` stamp |

Project icons are stored under two keys on purpose — the workspace id when a surface knows it, and
`name:<basename>` when only the folder name exists — and either resolves everywhere.

## Development

```bash
npm test        # 148 + 7 assertions, no dependencies
```

The suite boots the real `lib/client.js` under a fake module loader with a fake DOM, a fake client
context and fake session records, then drives every surface: registrations, painted icons, triggers, the
picker, the pinned band, the sections, the activity view (including which part of a message becomes the
preview), locale handling, and unload/reload safety. CI runs it on Node 22 and 24.

## Uninstall

```bash
dsh plugin --profile desktop remove dsh-session-deck
```

There is no host-side state: remove it, reload, and the shell is exactly as it was.

## License

MIT
