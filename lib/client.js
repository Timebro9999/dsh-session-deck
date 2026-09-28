/**
 * dsh-session-deck — project icons for the DeepSeek Harness sidebar.
 *
 * Scope (deliberately one thing): replace a **project's folder icon** with a
 * glyph the user picks, on every surface that draws that project:
 *   - sidebar project rows  (`[data-row-key^="workspace:"]`, glyph seat `*_folder`)
 *   - directory-picker rows (`svg[class*="_rowIcon"]`, name from `*_rowName`)
 *
 * It also adds the **pinned area** the shipped sidebar does not have: one band
 * at the very top of the workspace list holding pinned *projects* and pinned
 * *conversations*, reachable from a star on every row — the built-in pin only
 * orders a conversation inside its own project.
 *
 * Icon interaction, modelled on the Codex project-appearance picker:
 *   - a *customize* trigger in the project row's own hover action strip,
 *     styled from the row's shipped icon button so it looks native;
 *   - right-click on the project row opens the same picker;
 *   - clicking an icon that is already applied re-opens the picker.
 * The picker is a panel with a "recent" row, a category tab bar and an icon
 * grid — one click applies, `还原默认` falls back to the shipped folder glyph.
 * Nothing is replaced until the user chooses something.
 *
 * Storage: browser localStorage `dsh-session-deck:v1` → `{ emoji: { … } }`,
 * keyed by workspace id when the surface knows it and by `name:<folder>` when
 * only the folder basename is available; either key resolves everywhere.
 *
 * Bundle protocol: dsh module-loader (`window.__ModuleLoader__.load`), CJS body,
 * no module-table requires (pure DOM — no React, no slots).
 */
window.__ModuleLoader__.load({
  id: "dsh-session-deck",
  factory: () => {
    var module = { exports: {} };
    var exports = module.exports;
    "use strict";

    const PLUGIN_ID = "dsh-session-deck";
    const STORAGE_KEY = "dsh-session-deck:v1";
    const PREVIEW_KEY = "dsh-session-deck:previews:v3";
    const PREVIEW_LIMIT = 240;
    const PREVIEW_CHARS = 320;
    const NAME_KEY_PREFIX = "name:";
    const RECENT_LIMIT = 16;

    /* ---------------------------------------------------------------- copy */

    const COPY = {
      zh: {
        title: "项目图标",
        subtitle: "选一个图标代表这个项目",
        recent: "最近",
        reset: "还原默认",
        hint: "也可以用系统表情面板（Control + Command + Space）粘贴",
        change: "更改项目图标",
        pinned: "置顶",
        pin: "置顶到顶部",
        unpin: "取消置顶",
        project: "项目",
        session: "会话",
        untitled: "未命名会话",
        newSession: "新会话",
        empty: "没有匹配的图标",
        noSessions: "这个项目还没有会话",
        activity: "最近使用",
        activityBell: "活动视图（最近使用）",
        activityEmpty: "还没有最近使用的对话",
        close: "关闭",
        collapseProjects: "收起 / 展开项目列表",
        projects: "项目",
        widgets: "组件",
        collapseSection: "收起 / 展开",
        today: "今天",
        yesterday: "昨天",
        earlier: "更早",
        weekdays: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
        running: "运行中",
        justNow: "刚刚",
        minutesShort: " 分钟前",
        hoursShort: " 小时前",
        daysShort: " 天前",
      },
      en: {
        title: "Project icon",
        subtitle: "Pick an icon for this project",
        recent: "Recent",
        reset: "Reset to folder",
        hint: "You can also paste from the system emoji panel (Control + Command + Space)",
        change: "Change project icon",
        pinned: "Pinned",
        pin: "Pin to the top",
        unpin: "Unpin",
        project: "Project",
        session: "Session",
        untitled: "Untitled session",
        newSession: "New session",
        empty: "No matching icon",
        noSessions: "This project has no conversations yet",
        activity: "Recent",
        activityBell: "Activity (recent conversations)",
        activityEmpty: "No recently used conversations yet",
        close: "Close",
        collapseProjects: "Collapse / expand the project list",
        projects: "Projects",
        widgets: "Widgets",
        collapseSection: "Collapse / expand",
        today: "Today",
        yesterday: "Yesterday",
        earlier: "Earlier",
        weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        running: "Running",
        justNow: "just now",
        minutesShort: "m ago",
        hoursShort: "h ago",
        daysShort: "d ago",
      },
    };

    /**
     * Copy follows the harness's own locale (`ctx.locale`) — NOT the browser's,
     * which is often the system language and would leave Chinese copy reading
     * "Pinned". The browser is only the fallback, then Chinese.
     */
    function detectLanguage(ctx, serviceHint) {
      // 1. The harness's own locale service — the authority.
      const fromService = safe(() => {
        const service = serviceHint ||
          (ctx && typeof ctx.get === "function" ? ctx.get("locale") : undefined);
        if (!service) return "";
        const snapshot = typeof service.getLocale === "function"
          ? service.getLocale()
          : typeof service.getSnapshot === "function"
            ? service.getSnapshot()
            : undefined;
        return snapshot && typeof snapshot.active === "string" ? snapshot.active : "";
      }, "");
      if (fromService) return fromService.toLowerCase().startsWith("zh") ? "zh" : "en";

      // 2. What the shipped UI is actually rendering right now: a sidebar label
      //    in Chinese means the app is Chinese, whatever the browser says. This
      //    matters because the locale service may mount after this plugin does,
      //    and the browser language is often the system one. The rendered copy is
      //    stronger evidence than the document's own `lang` attribute, which a
      //    shell may leave at its build-time value.
      const probed = safe(() => {
        const node = document.querySelector('[class*="_sectionLabel"]') ||
          document.querySelector('[class*="_brandName"]');
        const text = node && typeof node.textContent === "string" ? node.textContent : "";
        if (/[\u3400-\u9fff]/.test(text)) return "zh";
        if (/[A-Za-z]{3,}/.test(text)) return "en";
        return "";
      }, "");
      if (probed) return probed;

      // 3. The document language the shell declares.
      const fromDocument = safe(() => String((document.documentElement && document.documentElement.lang) || ""), "");
      if (fromDocument) return fromDocument.toLowerCase().startsWith("zh") ? "zh" : "en";

      // 4. Browser, then Chinese (this app's default for its owner).
      const fromBrowser = safe(() => String(navigator.language || ""), "");
      if (fromBrowser) return fromBrowser.toLowerCase().startsWith("zh") ? "zh" : "en";
      return "zh";
    }

    let language = detectLanguage(undefined);
    const t = (key) => {
      const dict = COPY[language] || COPY.zh;
      return dict[key] !== undefined ? dict[key] : key;
    };
    const describe = (entry) => entry.label[language] || entry.label.zh;

    /* --------------------------------------------------------------- icons */

    /** Icon groups, ordered the way the picker renders them. */
    const GROUPS = [
      {
        id: "work",
        label: { zh: "工作", en: "Work" },
        items: ["📁", "🗂️", "📂", "🗃️", "📊", "📈", "📉", "🧮", "📋", "📌", "📎", "🖊️", "✏️", "📝", "🗒️", "📚", "📖", "🔖", "🧷", "🖇️", "📅", "⏱️", "🗓️", "⌨️"],
      },
      {
        id: "science",
        label: { zh: "科研", en: "Research" },
        items: ["🔬", "🧬", "🧫", "🧪", "⚗️", "📐", "📏", "🧠", "🫀", "🩺", "💊", "🌡️", "🧭", "🗺️", "🌍", "🌏", "🪐", "🔭", "🛰️", "📡", "🧲", "🔎", "📓", "🎓"],
      },
      {
        id: "tech",
        label: { zh: "技术", en: "Tech" },
        items: ["💻", "🖥️", "🖱️", "🧑‍💻", "🛠️", "🔧", "🔨", "⚙️", "🧰", "🔌", "🔋", "🛜", "🌐", "🗄️", "🧱", "🐳", "🐙", "🕹️", "📦", "🚀", "🧩", "🤖", "⚡", "🛰️"],
      },
      {
        id: "smileys",
        label: { zh: "表情", en: "Smileys" },
        items: ["😀", "😄", "🙂", "😊", "😎", "🤓", "🧐", "🤔", "🤨", "😴", "🥳", "🤩", "😇", "🫡", "🙃", "😉", "🤝", "😺", "👻", "💡", "✨", "🔥", "⭐", "❤️"],
      },
      {
        id: "nature",
        label: { zh: "自然", en: "Nature" },
        items: ["🌱", "🌿", "🍀", "🌳", "🌲", "🌴", "🌵", "🌸", "🌻", "🌷", "🍁", "🍄", "🌊", "🏔️", "⛰️", "🌤️", "🌈", "❄️", "🐝", "🦋", "🐢", "🐈", "🐕", "🐬"],
      },
      {
        id: "objects",
        label: { zh: "物件", en: "Objects" },
        items: ["🧳", "🎒", "🪪", "🔑", "🗝️", "🔒", "🪑", "🖼️", "🎨", "🖌️", "🎭", "🎬", "📷", "🎧", "🎼", "🎹", "🎸", "🥁", "🎯", "🧸", "🕯️", "🎁", "📮", "🧿"],
      },
      {
        id: "life",
        label: { zh: "生活", en: "Life" },
        items: ["☕", "🍵", "🍜", "🍚", "🥗", "🍎", "🍇", "🍰", "🍫", "🥤", "🛒", "🏃", "🚴", "🧘", "💪", "🛌", "🧺", "🪴", "🏠", "🗼", "🎈", "🧑‍🍳", "🐾", "☂️"],
      },
      {
        id: "travel",
        label: { zh: "旅行", en: "Travel" },
        items: ["✈️", "🛫", "🚄", "🚗", "🚲", "⛵", "🚢", "🚁", "🛶", "🏝️", "🏕️", "🏛️", "🏰", "🌉", "🎡", "🚉", "🛣️", "🏞️", "🌅", "🌃", "🗽", "🧭", "🗺️", "🚀"],
      },
      {
        id: "symbols",
        label: { zh: "符号", en: "Symbols" },
        items: ["🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💠", "🔷", "🔶", "🟢", "🟡", "🟠", "🔴", "🟣", "⚫", "⚪", "✅", "❗", "❓", "♻️", "🌟", "🔆", "🈶"],
      },
    ];

    const ALL_ICONS = (() => {
      const list = [];
      for (const group of GROUPS) {
        for (const glyph of group.items) if (list.indexOf(glyph) === -1) list.push(glyph);
      }
      return list;
    })();

    /* --------------------------------------------------------------- style */

    const STYLE_TEXT = `
.dsd-picker { position:fixed; z-index:2147483000; width:320px; max-height:min(460px, calc(100vh - 24px)); display:flex; flex-direction:column; padding:12px; border-radius:14px; border:1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); box-shadow: 0 18px 48px rgba(0,0,0,.24); font-family: inherit; }
.dsd-picker-head { display:flex; align-items:baseline; gap:8px; padding:0 2px 8px; }
.dsd-picker-title { font-size:13px; font-weight:600; }
.dsd-picker-sub { font-size:11px; color: var(--dsw-alias-label-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsd-tabs { display:flex; gap:2px; overflow-x:auto; padding-bottom:6px; scrollbar-width:none; }
.dsd-tabs::-webkit-scrollbar { display:none; }
.dsd-tab { flex:none; border:none; background:transparent; color: var(--dsw-alias-label-secondary); font:inherit; font-size:11px; line-height:1; padding:5px 8px; border-radius:999px; cursor:pointer; }
.dsd-tab:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsd-tab-active { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-weight:600; }
.dsd-grid { display:grid; grid-template-columns: repeat(8, 1fr); gap:2px; overflow-y:auto; padding:2px 0; min-height:72px; }
.dsd-cell { width:100%; aspect-ratio:1; display:flex; align-items:center; justify-content:center; border:none; background:transparent; border-radius:8px; cursor:pointer; font-size:18px; line-height:1; padding:0; }
.dsd-cell:hover { background: var(--dsw-alias-bg-layer-2); }
.dsd-cell-active { background: var(--dsw-alias-bg-layer-2); outline:1px solid var(--dsw-alias-brand-primary); }
.dsd-empty { grid-column:1 / -1; padding:18px 0; text-align:center; font-size:12px; color: var(--dsw-alias-label-secondary); }
.dsd-picker-foot { display:flex; align-items:center; gap:6px; padding-top:8px; border-top:1px solid var(--dsw-alias-border-l1); margin-top:8px; }
.dsd-note { flex:1; min-width:0; font-size:10px; line-height:1.4; color: var(--dsw-alias-label-secondary); }
.dsd-action { flex:none; border:1px solid var(--dsw-alias-border-l1); background:transparent; color: var(--dsw-alias-label-primary); font:inherit; font-size:11px; line-height:1; padding:5px 10px; border-radius:8px; cursor:pointer; white-space:nowrap; }
.dsd-action:hover { background: var(--dsw-alias-bg-layer-2); }
.dsd-trigger { border-radius: var(--dsw-radius-xs); cursor:pointer; width:16px; height:16px; color: var(--dsw-alias-label-tertiary); background:0 0; border:none; flex:none; justify-content:center; align-items:center; padding:0; display:inline-flex; }
.dsd-trigger:hover { color: var(--dsw-alias-label-primary); }
.dsd-inline-trigger { opacity:0; transition:opacity .12s ease; }
.dsd-projrow:hover .dsd-inline-trigger, .dsd-inline-trigger:focus-visible { opacity:.9; }
.dsd-project-icon { display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; font-size:13px; line-height:1; cursor:pointer; border-radius:4px; }
.dsd-project-icon:hover { background: var(--dsw-alias-bg-layer-2); }
.dsd-trigger-on { color: var(--dsw-alias-brand-primary) !important; }
/* Pinned band. Geometry mirrors the shipped session row exactly
   (padding 0 8px, gap, 10px/16px meta) so its right-hand labels line up with the
   normal rows' times, which sit at the same inset. */
.dsd-pin-sep { height:1px; margin:6px 8px; background: var(--dsw-alias-border-l1); }
/* One section head serves 置顶 / 项目 / 组件: triangle + label + optional count,
   same 13px as the rows so the whole column reads as one list. */
.dsd-sections { display:flex; flex-direction:column; gap:1px; }
/* No font-size here on purpose: the shipped rows inherit the shell's own row
   metric, so hard-coding one made the pinned area look smaller than the project
   area. Inheriting keeps the two identical in every theme. */
.dsd-section-head { display:flex; align-items:center; gap:6px; height:32px; padding:0 8px; border-radius: var(--dsw-radius-md); cursor:pointer; color: var(--dsw-alias-label-primary); }
.dsd-section-head:hover { background: var(--dsw-alias-bg-layer-2); }
.dsd-section-caret { width:10px; height:10px; }
.dsd-section-label { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; }
.dsd-section-count { flex:none; font-size:10px; line-height:16px; color: var(--dsw-alias-label-tertiary); }
/* Collapsing 项目 hides the shipped rows: React owns them, so CSS hides them. */
.dsd-projects-collapsed > :not([data-dsh-session-deck]) { display:none; }
/* Running indicator — same geometry, colour and 1.5s period as the shell's own. */
.dsd-spinner { display:inline-flex; align-items:center; justify-content:center; flex:none; width:16px; color: var(--dsw-alias-label-tertiary); }
.dsd-spinner-motion { transform-origin:center; animation: dsd-spinner-spin 1.5s linear infinite; }
.dsd-spinner-track, .dsd-spinner-arc { fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; }
.dsd-spinner-track { opacity:.25; }
.dsd-spinner-arc { stroke-dasharray: 12 150; animation: dsd-spinner-dash 1.5s ease-in-out infinite; }
@keyframes dsd-spinner-spin { to { transform: rotate(360deg); } }
@keyframes dsd-spinner-dash {
  0% { stroke-dasharray: 12 150; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 24 150; stroke-dashoffset: -6; }
  100% { stroke-dasharray: 12 150; stroke-dashoffset: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .dsd-spinner-motion, .dsd-spinner-arc { animation: none; }
  .dsd-spinner-arc { stroke-dasharray: 18 150; stroke-dashoffset: -3; }
}
.dsd-caret { display:inline-flex; align-items:center; justify-content:center; flex:none; color: var(--dsw-alias-label-tertiary); transition: transform .15s ease; }
.dsd-caret-open { transform: rotate(90deg); }
.dsd-pin-row { position:relative; display:flex; align-items:center; gap:6px; height:32px; padding:0 8px; border-radius: var(--dsw-radius-md); cursor:pointer; color: var(--dsw-alias-label-primary); }
.dsd-pin-row:hover { background: var(--dsw-alias-bg-layer-2); }
.dsd-pin-icon { flex:none; width:16px; text-align:center; line-height:1; transition:opacity .12s ease; }
.dsd-pin-title { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsd-pin-kind { flex:none; margin-left:auto; font-size:10px; line-height:16px; color: var(--dsw-alias-label-tertiary); transition:opacity .12s ease; }
.dsd-pin-row:hover .dsd-pin-kind { opacity:0; }
.dsd-pin-action { border:none; background:transparent; color: var(--dsw-alias-label-tertiary); font:inherit; font-size:11px; line-height:1; padding:3px 5px; border-radius:6px; cursor:pointer; }
/* Scoped to pinned rows: the same class also dresses the panel's own close
   button, which must stay in flow. */
.dsd-pin-row > .dsd-pin-action { position:absolute; right:8px; top:50%; transform:translateY(-50%); opacity:0; transition:opacity .12s ease; }
.dsd-pin-row:hover > .dsd-pin-action { opacity:1; }
.dsd-pin-action:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
/* The disclosure chevron takes the icon's seat on hover — the same swap the
   shipped project rows do, so the row stays on the same grid. */
.dsd-chevron { position:absolute; left:8px; width:16px; justify-content:center; opacity:0; transition:opacity .12s ease, transform .15s ease; }
.dsd-pin-project:hover .dsd-pin-icon { opacity:0; }
.dsd-pin-project:hover .dsd-chevron { opacity:1; }
.dsd-pin-sub { height:30px; padding-left:30px; color: var(--dsw-alias-label-secondary); }
.dsd-pin-sub:hover { color: var(--dsw-alias-label-primary); }
.dsd-pin-empty { padding:4px 8px 6px 30px; font-size:11px; color: var(--dsw-alias-label-tertiary); }
/* Activity view (the bell): same 12px grid as the browsing list — outer
   padding 4px + row padding 8px — so its text lines up with the pinned band and
   the normal rows. */
.dsd-activity { display:flex; flex-direction:column; flex:1; min-height:0; padding:6px 4px 28px; overflow-y:auto; }
.dsd-activity-head { display:flex; align-items:center; gap:6px; padding:2px 8px 2px; }
.dsd-activity-title { flex:1; font-size:12px; font-weight:600; color: var(--dsw-alias-label-secondary); }
.dsd-activity-group { padding:16px 8px 4px; font-size:12px; font-weight:600; color: var(--dsw-alias-label-secondary); }
.dsd-activity-group:first-child { padding-top:8px; }
.dsd-activity-row { display:flex; align-items:flex-start; gap:10px; padding:9px 8px; border-radius: var(--dsw-radius-md); cursor:pointer; }
.dsd-activity-row:hover { background: var(--dsw-alias-bg-layer-2); }
.dsd-activity-glyph { flex:none; width:20px; text-align:center; font-size:14px; line-height:18px; }
.dsd-activity-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.dsd-activity-line { display:flex; align-items:baseline; gap:8px; min-width:0; }
.dsd-activity-name { flex:1; min-width:0; font-size:13px; font-weight:500; line-height:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color: var(--dsw-alias-label-primary); }
.dsd-activity-source { flex:none; max-width:104px; font-size:11px; line-height:16px; color: var(--dsw-alias-label-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dsd-activity-meta { display:flex; align-items:flex-start; gap:8px; font-size:12px; line-height:16px; color: var(--dsw-alias-label-secondary); }
.dsd-activity-preview { flex:1; min-width:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word; }
.dsd-activity-stamp { flex:none; margin-left:auto; font-size:10px; line-height:16px; white-space:nowrap; color: var(--dsw-alias-label-tertiary); }
.dsd-activity-state { display:inline-flex; align-items:center; gap:4px; margin-left:auto; font-size:10px; line-height:16px; color: var(--dsw-alias-brand-primary); }
.dsd-activity-dot { width:5px; height:5px; border-radius:50%; background: currentColor; display:inline-block; }
.dsd-activity-empty { padding:22px 8px; font-size:12px; text-align:center; color: var(--dsw-alias-label-secondary); }
.dsd-rail-hidden { display:none; }
`;

    const TRIGGER_SVG =
      '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">' +
      '<path d="M13.1 3.2l3.7 3.7-8.9 8.9-4.3.6.6-4.3 8.9-8.9z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M12.1 4.2l3.7 3.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
      "</svg>";

    /* ------------------------------------------------------------- helpers */

    function safe(fn, fallback) {
      try {
        return fn();
      } catch (error) {
        return fallback;
      }
    }

    function firstGrapheme(text) {
      const value = String(text || "").trim();
      if (value.length === 0) return "";
      const segmented = safe(() => {
        const parts = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value));
        return parts.length > 0 ? parts[0].segment : "";
      }, "");
      if (typeof segmented === "string" && segmented.length > 0) return segmented;
      const points = Array.from(value);
      return points.length > 0 ? points[0] : "";
    }

    /** Message events whose text is worth showing as a row's preview. */
    const MESSAGE_EVENT = /(user|assistant)\/message$/;

    /**
     * Content-part kinds that carry the answer. An assistant message is a list of
     * parts — `reasoning`, `text`, `tool-call` (probe-verified) — and the row
     * wants the ANSWER: take the `text` parts and ignore the thinking and the
     * tool traffic.
     */
    const ANSWER_PART = /^(text|output[-_]?text|message|final)$/;

    /**
     * Make answer text fit a two-line row: drop fenced blocks (an answer often
     * ends with one) and markdown marks, then collapse whitespace.
     */
    function cleanPreview(text) {
      let out = String(text || "");
      const fence = out.indexOf("```");
      if (fence !== -1) out = out.slice(0, fence);
      out = out.replace(/`[^`]*`/g, " ");
      out = out.replace(/^\s{0,3}#{1,6}\s*/gm, " ");
      out = out.replace(/[*_~>#|]+/g, " ");
      out = out.replace(/\s+/g, " ").trim();
      return out.slice(0, PREVIEW_CHARS);
    }

    /** The answer text of one message event, or "" when it carries none. */
    function messageText(event) {
      const data = event && event.data && typeof event.data === "object" ? event.data : {};
      const message = data.message && typeof data.message === "object" ? data.message : data;
      const content = message.content !== undefined ? message.content : data.content;
      if (Array.isArray(content)) {
        const parts = [];
        for (const part of content) {
          if (!part || typeof part !== "object") continue;
          const kind = typeof part.type === "string" ? part.type.toLowerCase() : "";
          if (!ANSWER_PART.test(kind)) continue;
          if (typeof part.text === "string" && part.text.trim().length > 0) parts.push(part.text);
          else if (typeof part.content === "string" && part.content.trim().length > 0) parts.push(part.content);
        }
        if (parts.length === 0) return "";
        return cleanPreview(parts.join(" "));
      }
      if (typeof message.text === "string" && message.text.trim().length > 0) return cleanPreview(message.text);
      if (typeof data.text === "string" && data.text.trim().length > 0) return cleanPreview(data.text);
      return "";
    }

    /** Preview text of the newest message in one session record window. */
    function previewFromWindow(window) {
      const entries = window && Array.isArray(window.entries) ? window.entries : [];
      let fallback = "";
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const entry = entries[i];
        if (!entry || entry.type !== "event" || !entry.event) continue;
        const type = typeof entry.event.type === "string" ? entry.event.type : "";
        if (!MESSAGE_EVENT.test(type)) continue;
        const text = messageText(entry.event);
        if (text.length === 0) continue;
        // The newest answer wins; a bare user prompt is only the fallback for a
        // turn whose reply has not been written yet.
        if (type.indexOf("assistant/") === 0) return text;
        if (fallback.length === 0) fallback = text;
      }
      return fallback;
    }

    const nameKeyOf = (name) => {
      const text = typeof name === "string" ? name.trim() : "";
      return text.length === 0 ? "" : NAME_KEY_PREFIX + text;
    };

    function classMatches(element, suffix) {
      const list = element && element.classList;
      if (!list) return false;
      for (const name of list) {
        if (name === suffix.replace(/^_/, "") || name.slice(-suffix.length) === suffix) return true;
      }
      return false;
    }

    function firstBySuffix(root, suffixes) {
      for (const node of root.querySelectorAll("*")) {
        for (const suffix of suffixes) if (classMatches(node, suffix)) return node;
      }
      return null;
    }

    const textOf = (node) =>
      node && typeof node.textContent === "string" ? node.textContent.trim() : "";

    /* --------------------------------------------------------------- store */

    function createStore() {
      const read = () => {
        const parsed = safe(() => JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}"), null);
        const emoji = parsed && typeof parsed.emoji === "object" && parsed.emoji !== null ? parsed.emoji : {};
        const clean = {};
        for (const [key, value] of Object.entries(emoji)) {
          if (typeof value === "string" && value.trim().length > 0) clean[key] = firstGrapheme(value);
        }
        const recent = Array.isArray(parsed && parsed.recent)
          ? parsed.recent.filter((glyph) => typeof glyph === "string" && glyph.length > 0)
          : [];
        const entry = (value) => {
          if (!value || typeof value !== "object") return null;
          if (typeof value.id !== "string" || value.id.length === 0) return null;
          return {
            id: value.id,
            title: typeof value.title === "string" ? value.title : "",
            icon: typeof value.icon === "string" ? value.icon : "",
          };
        };
        const list = (value) => (Array.isArray(value) ? value.map(entry).filter(Boolean) : []);
        const expanded = Array.isArray(parsed && parsed.expandedProjects)
          ? parsed.expandedProjects.filter((id) => typeof id === "string")
          : [];
        const pinnedCollapsed = Boolean(parsed && parsed.pinnedCollapsed);
        const workspaceCollapsed = Boolean(parsed && parsed.workspaceCollapsed);
        const widgetsCollapsed = Boolean(parsed && parsed.widgetsCollapsed);
        return {
          emoji: clean,
          recent: recent.slice(0, RECENT_LIMIT),
          pinnedSessions: list(parsed && parsed.pinnedSessions),
          pinnedProjects: list(parsed && parsed.pinnedProjects),
          expandedProjects: expanded,
          pinnedCollapsed,
          workspaceCollapsed,
          widgetsCollapsed,
        };
      };
      let state = read();
      const listeners = new Set();

      const persist = () => {
        safe(() => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), undefined);
        for (const listener of [...listeners]) listener();
      };

      return {
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        get(key) {
          return (typeof key === "string" && state.emoji[key]) || "";
        },
        recent() {
          return state.recent.slice();
        },
        pinnedSessions() {
          return state.pinnedSessions.slice();
        },
        pinnedProjects() {
          return state.pinnedProjects.slice();
        },
        isPinnedSession(id) {
          return state.pinnedSessions.some((entry) => entry.id === id);
        },
        expandedProjects() {
          return state.expandedProjects.slice();
        },
        isPinnedCollapsed() {
          return state.pinnedCollapsed;
        },
        togglePinnedCollapsed() {
          state = Object.assign({}, state, { pinnedCollapsed: !state.pinnedCollapsed });
          persist();
        },
        isWorkspaceCollapsed() {
          return state.workspaceCollapsed;
        },
        toggleWorkspaceCollapsed() {
          state = Object.assign({}, state, { workspaceCollapsed: !state.workspaceCollapsed });
          persist();
        },
        isWidgetsCollapsed() {
          return state.widgetsCollapsed;
        },
        toggleWidgetsCollapsed() {
          state = Object.assign({}, state, { widgetsCollapsed: !state.widgetsCollapsed });
          persist();
        },
        isExpanded(id) {
          return state.expandedProjects.indexOf(id) !== -1;
        },
        toggleExpanded(id) {
          const open = state.expandedProjects.indexOf(id) !== -1;
          const next = open
            ? state.expandedProjects.filter((candidate) => candidate !== id)
            : state.expandedProjects.concat([id]);
          state = Object.assign({}, state, { expandedProjects: next });
          persist();
        },
        isPinnedProject(id) {
          return state.pinnedProjects.some((entry) => entry.id === id);
        },
        /** Pin/unpin one conversation or project; newest pin first. */
        togglePin(kind, entry) {
          const field = kind === "project" ? "pinnedProjects" : "pinnedSessions";
          const current = state[field];
          const index = current.findIndex((candidate) => candidate.id === entry.id);
          const next = index === -1
            ? [{ id: entry.id, title: entry.title || "", icon: entry.icon || "" }].concat(current)
            : current.filter((candidate) => candidate.id !== entry.id);
          state = Object.assign({}, state, { [field]: next });
          persist();
          return index === -1;
        },
        /** Keep a stored pin's label/icon snapshot current while its row is rendered. */
        syncPin(kind, entry) {
          const field = kind === "project" ? "pinnedProjects" : "pinnedSessions";
          const current = state[field];
          const index = current.findIndex((candidate) => candidate.id === entry.id);
          if (index === -1) return;
          const existing = current[index];
          const title = entry.title || existing.title;
          const icon = entry.icon || existing.icon;
          if (existing.title === title && existing.icon === icon) return;
          const next = current.slice();
          next[index] = { id: existing.id, title, icon };
          state = Object.assign({}, state, { [field]: next });
          persist();
        },
        set(key, glyph) {
          if (typeof key !== "string" || key.length === 0) return;
          const icon = firstGrapheme(glyph);
          const emoji = Object.assign({}, state.emoji);
          if (icon.length === 0) delete emoji[key];
          else emoji[key] = icon;
          const recent = icon.length === 0
            ? state.recent
            : [icon].concat(state.recent.filter((entry) => entry !== icon)).slice(0, RECENT_LIMIT);
          state = Object.assign({}, state, { emoji, recent });
          persist();
        },
      };
    }

    /* -------------------------------------------------------------- picker */

    /**
     * The project-icon panel: recent row, category tabs, icon grid, reset.
     * Plain DOM (no React): anchored to the trigger, closes on Esc, outside
     * click, or after a choice.
     */
    function createPicker(doc, store, onChanged) {
      let node = null;
      let cleanup = null;
      let group = null;

      const close = () => {
        if (cleanup) cleanup();
        cleanup = null;
        if (node && node.parentNode) node.parentNode.removeChild(node);
        node = null;
      };

      const place = (panel, anchor) => {
        const rect = anchor.getBoundingClientRect();
        const view = doc.defaultView || { innerWidth: 1200, innerHeight: 800 };
        const width = 320;
        const height = Math.min(panel.offsetHeight || 420, view.innerHeight - 24);
        const left = Math.max(8, Math.min(rect.left, view.innerWidth - width - 8));
        const below = rect.bottom + 6;
        const top = below + height > view.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
        panel.style.left = left + "px";
        panel.style.top = top + "px";
      };

      const render = (panel, anchor, target) => {
        panel.textContent = "";

        const head = doc.createElement("div");
        head.className = "dsd-picker-head";
        const title = doc.createElement("span");
        title.className = "dsd-picker-title";
        title.textContent = t("title");
        const sub = doc.createElement("span");
        sub.className = "dsd-picker-sub";
        sub.textContent = target.label || t("subtitle");
        head.appendChild(title);
        head.appendChild(sub);
        panel.appendChild(head);

        const recent = store.recent();
        const active = group === null ? (recent.length > 0 ? "recent" : GROUPS[0].id) : group;

        const tabs = doc.createElement("div");
        tabs.className = "dsd-tabs";
        const addTab = (id, label) => {
          const button = doc.createElement("button");
          button.type = "button";
          button.className = "dsd-tab" + (active === id ? " dsd-tab-active" : "");
          button.textContent = label;
          button.addEventListener("click", () => {
            group = id;
            render(panel, anchor, target);
          });
          tabs.appendChild(button);
        };
        if (recent.length > 0) addTab("recent", t("recent"));
        for (const entry of GROUPS) addTab(entry.id, describe(entry));
        panel.appendChild(tabs);

        const grid = doc.createElement("div");
        grid.className = "dsd-grid";
        let items;
        if (active === "recent") items = recent.length > 0 ? recent : ALL_ICONS;
        else {
          const entry = GROUPS.find((candidate) => candidate.id === active) || GROUPS[0];
          items = entry.items;
        }
        if (items.length === 0) items = ALL_ICONS;
        for (const glyph of items) {
          const cell = doc.createElement("button");
          cell.type = "button";
          cell.className = "dsd-cell" + (store.get(target.storageKey) === glyph ? " dsd-cell-active" : "");
          cell.textContent = glyph;
          cell.title = glyph;
          cell.addEventListener("click", () => {
            store.set(target.storageKey, glyph);
            if (typeof onChanged === "function") onChanged();
            close();
          });
          grid.appendChild(cell);
        }
        panel.appendChild(grid);

        const foot = doc.createElement("div");
        foot.className = "dsd-picker-foot";
        const reset = doc.createElement("button");
        reset.type = "button";
        reset.className = "dsd-action";
        reset.textContent = t("reset");
        reset.addEventListener("click", () => {
          store.set(target.storageKey, "");
          if (typeof onChanged === "function") onChanged();
          close();
        });
        const note = doc.createElement("span");
        note.className = "dsd-note";
        note.textContent = t("hint");
        foot.appendChild(reset);
        foot.appendChild(note);
        panel.appendChild(foot);
      };

      const open = (anchor, target) => {
        if (node) close();
        const panel = doc.createElement("div");
        panel.className = "dsd-picker";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", t("title"));
        panel.addEventListener("mousedown", (event) => event.stopPropagation());
        render(panel, anchor, target);
        doc.body.appendChild(panel);
        node = panel;
        place(panel, anchor);

        const onKey = (event) => {
          if (event.key === "Escape") close();
        };
        const onDown = (event) => {
          if (panel.contains(event.target)) return;
          close();
        };
        doc.addEventListener("keydown", onKey, true);
        doc.addEventListener("mousedown", onDown, true);
        cleanup = () => {
          doc.removeEventListener("keydown", onKey, true);
          doc.removeEventListener("mousedown", onDown, true);
        };
      };

      return {
        open,
        close,
        isOpen: () => node !== null,
      };
    }

    /* ---------------------------------------------------------------- data */

    /**
     * Snapshot of the session/workspace stores, used by the pinned band to list
     * a pinned project's conversations even while the shipped list keeps them
     * collapsed. Refreshed on the services' own notifications (and by the DOM
     * observer, which fires on every list render anyway).
     */
    function createDataFace(ctx, onChange, store) {
      let cache = null;
      let cacheAt = 0;
      const disposers = [];
      const attached = new Set();
      /** id -> { stamp, text }: the preview of a session we have already read. */
      const previews = new Map();
      const inFlight = new Set();
      const service = (name) => safe(() => (ctx && typeof ctx.get === "function" ? ctx.get(name) : undefined), undefined);

      safe(() => {
        const stored = JSON.parse(window.localStorage.getItem(PREVIEW_KEY) || "{}");
        if (stored && typeof stored === "object") {
          for (const [id, entry] of Object.entries(stored)) {
            if (entry && typeof entry.text === "string") {
              previews.set(id, { stamp: typeof entry.stamp === "number" ? entry.stamp : 0, text: entry.text });
            }
          }
        }
      }, undefined);

      const persistPreviews = () => {
        const out = {};
        let count = 0;
        for (const [id, entry] of previews) {
          if (count >= PREVIEW_LIMIT) break;
          out[id] = entry;
          count += 1;
        }
        safe(() => window.localStorage.setItem(PREVIEW_KEY, JSON.stringify(out)), undefined);
      };

      const invalidate = () => {
        cache = null;
        cacheAt = 0;
        if (typeof onChange === "function") onChange();
      };

      /** Snapshot lifetime: long enough to be cheap, short enough to self-heal. */
      const CACHE_MS = 500;

      /**
       * Attach to a store's own notifications. Called lazily on every read, not
       * just at mount: a client service can appear after the plugin does, and an
       * unattached face would then keep serving whatever it cached first —
       * which is exactly how the activity view once showed "nothing yet" for a
       * sidebar full of conversations.
       */
      const attach = () => {
        for (const name of ["sessions", "workspaces"]) {
          if (attached.has(name)) continue;
          const list = safe(() => {
            const svc = service(name);
            return svc && svc.list ? svc.list : undefined;
          }, undefined);
          if (!list || typeof list.subscribe !== "function") continue;
          attached.add(name);
          const dispose = safe(() => list.subscribe(invalidate), undefined);
          if (typeof dispose === "function") disposers.push(dispose);
        }
      };

      return {
        read() {
          attach();
          if (cache !== null && Date.now() - cacheAt < CACHE_MS) return cache;
          const sessions = new Map();
          const ids = [];
          const sList = safe(() => {
            const svc = service("sessions");
            const list = svc && svc.list;
            return list && typeof list.getSnapshot === "function" ? list.getSnapshot() : undefined;
          }, undefined);
          if (sList && Array.isArray(sList.ids)) {
            for (const id of sList.ids) ids.push(String(id));
          }
          if (sList && sList.byId && typeof sList.byId === "object") {
            for (const [id, value] of Object.entries(sList.byId)) {
              sessions.set(String(id), {
                title: value && typeof value.displayTitle === "string" ? value.displayTitle : "",
                blank: Boolean(value && value.blank),
                updatedAt: value && typeof value.updatedAt === "number" ? value.updatedAt : 0,
                running: Boolean(value && value.running),
              });
            }
          }
          const workspaces = new Map();
          const wList = safe(() => {
            const svc = service("workspaces");
            const list = svc && svc.list;
            return list && typeof list.getSnapshot === "function" ? list.getSnapshot() : undefined;
          }, undefined);
          if (wList && Array.isArray(wList.items)) {
            for (const item of wList.items) {
              if (!item) continue;
              workspaces.set(String(item.workspaceId), {
                title: typeof item.title === "string" ? item.title : "",
                sessionIds: Array.isArray(item.sessionIds) ? item.sessionIds.map(String) : [],
              });
            }
          }
          for (const [id] of sessions) if (ids.indexOf(id) === -1) ids.push(id);
          cache = { sessions, workspaces, ids };
          cacheAt = Date.now();
          return cache;
        },
        /**
         * Recently used conversations across every project, newest first. The
         * activity time comes from the session's own binding when it is
         * available; sessions without one keep the host list's order.
         */
        recents(limit) {
          const data = this.read();
          const projectOf = new Map();
          for (const [workspaceId, workspace] of data.workspaces) {
            for (const id of workspace.sessionIds) projectOf.set(id, workspaceId);
          }
          const rows = [];
          let index = 0;
          for (const id of data.ids) {
            const session = data.sessions.get(id);
            const title = session && session.title
              ? session.title
              : session && session.blank
                ? t("newSession")
                : t("untitled");
            const workspaceId = projectOf.get(id) || "";
            const workspace = workspaceId ? data.workspaces.get(workspaceId) : undefined;
            rows.push({
              id,
              title,
              projectId: workspaceId,
              projectTitle: workspace ? workspace.title : "",
              running: Boolean(session && session.running),
              preview: this.preview(id, (session && session.updatedAt) || 0),
              index,
              // The summary's own stamp is authoritative; a session whose summary
              // carries none falls back to its event record, then to list order.
              time: (session && session.updatedAt) || this.sessionTime(id),
            });
            index += 1;
          }
          rows.sort((a, b) => {
            if (a.time !== b.time) return b.time - a.time;
            return a.index - b.index;
          });
          return typeof limit === "number" && limit > 0 ? rows.slice(0, limit) : rows;
        },
        /**
         * Shape of a session's newest record entry — the activity view needs the
         * message text out of it (diagnostic only).
         */
        /** Every field name the session summary carries (diagnostic only). */
        /** Every field name the session summary carries (diagnostic only). */
        /** Can the plugin actually see the session store, and who is running? */
        dataFacts() {
          return safe(() => {
            const data = this.read();
            const running = [...data.sessions.entries()].filter(([, summary]) => summary.running);
            const pinnedRunning = store
              .pinnedSessions()
              .filter((entry) => {
                const summary = data.sessions.get(entry.id);
                return Boolean(summary && summary.running);
              }).length;
            return [
              "ids" + data.ids.length,
              "ws" + data.workspaces.size,
              "run" + running.length,
              "prun" + pinnedRunning + "of" + store.pinnedSessions().length,
            ].join(".");
          }, "err");
        },
        /** What the sidebar list actually shows right now (diagnostic only). */
        treeFacts() {
          return safe(() => {
            const doc = document;
            const area = doc.querySelector('[class*="_listArea"]');
            const list = area ? [...area.querySelectorAll("*")].find((node) => {
              for (const name of node.classList || []) {
                if (name === "list" || name.slice(-5) === "_list") return true;
              }
              return false;
            }) : null;
            const sections = doc.querySelector(".dsd-sections");
            const heads = [...doc.querySelectorAll(".dsd-section-head")];
            const visible = (node) => Boolean(node) && node.offsetParent !== null;
            const kids = list ? [...list.children] : [];
            const collapsed = list && list.className.includes("dsd-projects-collapsed");
            return [
              "cls" + (collapsed ? 1 : 0),
              "list" + (visible(list) ? 1 : 0),
              "sec" + (sections ? (visible(sections) ? 1 : 0) : 2),
              "heads" + heads.filter(visible).length + "of" + heads.length,
              "kids" + kids.filter(visible).length + "of" + kids.length,
            ].join(".");
          }, "err");
        },
        /**
         * The newest message text of one session. Cached per session stamp, and
         * read on demand: a session that is not currently retained is held for
         * the read and released again (`using`), so the activity view can show a
         * preview without keeping conversations open.
         */
        preview(id, stamp) {
          const cached = previews.get(id);
          if (cached && cached.stamp === stamp) return cached.text;
          if (!cached || cached.stamp !== stamp) this.loadPreview(id, stamp);
          return cached ? cached.text : "";
        },
        loadPreview(id, stamp) {
          const svc = service("sessions");
          if (!svc || typeof svc.using !== "function") return;
          if (inFlight.has(id) || inFlight.size >= 3) return;
          inFlight.add(id);
          let settled = false;
          const settle = () => {
            if (settled) return;
            settled = true;
            inFlight.delete(id);
            if (typeof onChange === "function") onChange();
          };
          const timer = setTimeout(settle, 12000);
          safe(() => {
            const operation = svc.using(id, { source: "gateway" }, async (reference) => {
              const binding = reference && reference.ready
                ? await reference.ready
                : reference && reference.binding;
              const source = binding && binding.eventSource;
              const window = source && typeof source.getSnapshot === "function" ? source.getSnapshot() : undefined;
              return previewFromWindow(window);
            });
            Promise.resolve(operation).then((text) => {
              clearTimeout(timer);
              previews.set(id, { stamp, text: typeof text === "string" ? text : "" });
              persistPreviews();
              settle();
            }).catch(() => {
              clearTimeout(timer);
              // Remember the miss so an unreadable session is not retried every pass.
              previews.set(id, { stamp, text: "" });
              persistPreviews();
              settle();
            });
          }, undefined);
        },
        /** Last activity of one session, from its own record (0 when unknown). */
        sessionTime(id) {
          const value = safe(() => {
            const svc = service("sessions");
            if (!svc || typeof svc.binding !== "function") return 0;
            const binding = svc.binding(id);
            const session = binding && binding.session;
            const snapshot = session && typeof session.getSnapshot === "function" ? session.getSnapshot() : undefined;
            const nodes = snapshot && Array.isArray(snapshot.nodes) ? snapshot.nodes : undefined;
            if (!nodes) return 0;
            for (let i = nodes.length - 1; i >= 0; i -= 1) {
              const node = nodes[i];
              if (node && typeof node.time === "number" && node.time > 0) return node.time;
            }
            return 0;
          }, 0);
          return typeof value === "number" ? value : 0;
        },
        /** Live summary of one session: title, blank flag, running state, stamp. */
        sessionSummary(id) {
          const summary = this.read().sessions.get(id);
          if (!summary) return undefined;
          return {
            title: summary.title || (summary.blank ? t("newSession") : t("untitled")),
            running: Boolean(summary.running),
            updatedAt: summary.updatedAt || 0,
          };
        },
        /** Live title of one project. */
        workspaceTitle(id) {
          const workspace = this.read().workspaces.get(id);
          return workspace ? workspace.title : "";
        },
        /** Which project a conversation belongs to, right now. */
        workspaceOfSession(id) {
          for (const [workspaceId, workspace] of this.read().workspaces) {
            if (workspace.sessionIds.indexOf(id) !== -1) return workspaceId;
          }
          return "";
        },
        /** Conversations of one project, titled and ordered like the shipped list. */
        sessionsOf(workspaceId, data) {
          const workspace = data.workspaces.get(workspaceId);
          if (!workspace) return [];
          return workspace.sessionIds.map((id) => {
            const session = data.sessions.get(id);
            const title = session && session.title
              ? session.title
              : session && session.blank
                ? t("newSession")
                : t("untitled");
            return { id, title };
          });
        },
        dispose() {
          for (const dispose of disposers) safe(() => dispose(), undefined);
          disposers.length = 0;
        },
      };
    }

    /* ------------------------------------------------------------- overlay */

    const starSvg = (filled) =>
      '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">' +
      '<path d="M10 2.6l2.3 4.7 5.2.8-3.8 3.6.9 5.2L10 14.4l-4.6 2.5.9-5.2L2.5 8.1l5.2-.8L10 2.6z" ' +
      (filled
        ? 'fill="currentColor"'
        : 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"') +
      "/></svg>";

    /**
     * The shipped running indicator: a 14px ring with a slow rotating arc. The
     * geometry, colours and the 1.5s timing are copied from the shell's own
     * StateDot (`ongoing`), so a conversation looks the same wherever it is
     * listed — the project list, the pinned band, or the activity view.
     */
    const SPINNER_SVG =
      '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">' +
      '<g class="dsd-spinner-motion">' +
      '<circle class="dsd-spinner-track" cx="12" cy="12" r="9.5"/>' +
      '<circle class="dsd-spinner-arc" cx="12" cy="12" r="9.5"/>' +
      "</g></svg>";

    /** One spinner element, marked as ours so a reload reclaims it. */
    function buildSpinner(doc, label) {
      const node = mark(doc.createElement("span"));
      node.className = "dsd-spinner";
      node.setAttribute("role", "img");
      node.setAttribute("aria-label", label);
      node.innerHTML = SPINNER_SVG;
      return node;
    }

    /** Small filled disclosure triangle — the shipped project rows' own shape. */
    const TRIANGLE_SVG =
      '<svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">' +
      '<path d="M3.8 1.8l5.4 4.2-5.4 4.2z" fill="currentColor"/>' +
      "</svg>";

    /** Build one caret: a triangle that rotates to point down when open. */
    function buildCaret(doc, className, open) {
      const node = doc.createElement("span");
      node.className = "dsd-caret" + (className ? " " + className : "") + (open ? " dsd-caret-open" : "");
      node.innerHTML = TRIANGLE_SVG;
      return node;
    }

    const BELL_SVG = (active) =>
      '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">' +
      '<path d="M10 2.8a4.4 4.4 0 0 1 4.4 4.4c0 3.1 1 4.4 1.6 5.1H4c.6-.7 1.6-2 1.6-5.1A4.4 4.4 0 0 1 10 2.8z" ' +
      (active
        ? 'fill="currentColor"'
        : 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"') +
      "/>" +
      '<path d="M8.2 15.1a1.9 1.9 0 0 0 3.6 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>' +
      "</svg>";

    /**
     * Every node this plugin injects is marked with the id of the instance that
     * made it. The shell does not unload an old client instance when it reloads
     * a bundle, so several instances can be alive in one page (after an update,
     * or after the profile changes a few times) — and the newest one hides what
     * the older ones left behind, using the sequence below to pick a winner.
     */
    const OWNED = "dshSessionDeck";
    const STALE = "dsh-session-deck-stale";
    const SEQ = (() => {
      const win = typeof window !== "undefined" ? window : undefined;
      if (!win) return 1;
      win.__dshSessionDeckSeq = (win.__dshSessionDeckSeq || 0) + 1;
      return win.__dshSessionDeckSeq;
    })();
    const MARK = String(SEQ);
    const mark = (node) => {
      if (node && node.dataset !== undefined) node.dataset[OWNED] = MARK;
      return node;
    };

    /**
     * Exactly one of each container may be visible. Instances from earlier
     * bundle loads stay alive and keep painting, and two instances out of the
     * SAME load cannot be told apart by any per-instance id — so ownership is
     * decided structurally instead: the instance doing the scan keeps its own
     * node and hides every other one. Nodes are hidden rather than removed,
     * because an owner whose node was removed just inserts a new one.
     */
    const hideSiblings = (node, className) => {
      const parent = node && node.parentNode;
      if (!parent || !parent.children) return;
      for (const other of [...parent.children]) {
        if (other === node) continue;
        if (String(other.className || "").indexOf(className) === -1) continue;
        if (typeof other.setAttribute === "function") other.setAttribute(STALE, "1");
        if (other.style) other.style.display = "none";
      }
    };

    /**
     * A bundle reload mounts a fresh instance without unloading the old one, so
     * a mount first reclaims everything the previous instance left behind:
     * stray triggers would otherwise pile up (one bell per reload) and painted
     * icons would keep the shipped glyph hidden.
     */
    function reclaimPrevious(doc) {
      // Older builds did not mark their nodes, so the sweep also matches the
      // plugin's own class names (nothing else in the shell uses them).
      const leftovers = [
        ...doc.querySelectorAll("[data-dsh-session-deck]"),
        ...doc.querySelectorAll("button.dsd-trigger, .dsd-project-icon, .dsd-sections, .dsd-activity"),
      ];
      for (const node of [...leftovers]) {
        const parent = node.parentNode;
        if (parent && typeof parent.querySelector === "function") {
          const svg = parent.querySelector("svg");
          if (svg && svg.style && svg.style.display === "none") svg.style.display = "";
          // A previously hidden browsing list, hidden by an older activity view.
          const scroller = typeof parent.querySelector === "function" ? parent.querySelector('[class*="_list"]') : null;
          if (scroller && scroller.style) scroller.style.display = "";
        }
        if (parent) parent.removeChild(node);
      }
    }

    const isRail = (element) => {
      const list = element && element.classList;
      if (!list) return false;
      for (const name of list) if (name === "rail" || name.slice(-5) === "_rail") return true;
      return false;
    };

    /**
     * Everything the plugin paints: the project icon, the row triggers (pin on
     * every row, customize on project rows) and the pinned band at the top of
     * the workspace list.
     *
     * All of it is additive DOM work on top of the shipped markup: rows the user
     * never touched keep exactly the icon and buttons the shell rendered, and
     * `dispose` puts every touched node back.
     */
    function mountSidebar(doc, store, picker, navigate, dataFace, readLanguage, onStatus) {
      const painted = new Map();
      const iconTriggers = new Map();
      const pinTriggers = new Map();
      let sectionsNode = null;
      let sectionsSignature = "";
      let widgetsNode = null;
      let frame = 0;
      let observer = null;
      let unsubscribe = null;

      const stop = (event) => {
        if (!event) return;
        if (typeof event.stopPropagation === "function") event.stopPropagation();
        if (typeof event.preventDefault === "function") event.preventDefault();
      };

      const projectIconOf = (workspaceId, label) => {
        const custom = store.get(workspaceId) || store.get(nameKeyOf(label));
        return custom || "📁";
      };

      /** Session rows inherit the icon of the project group they sit under. */
      const projectOfSessionRow = () => {
        const map = new Map();
        let current = "";
        for (const row of doc.querySelectorAll("[data-row-key]")) {
          const key = row.getAttribute("data-row-key") || "";
          if (key.slice(0, 10) === "workspace:") current = key.slice(10);
          else if (key.slice(0, 8) === "session:") map.set(key.slice(8), current);
        }
        return map;
      };

      const collect = () => {
        const projects = [];
        const sessions = [];
        const ownsSession = projectOfSessionRow();
        const projectLabels = new Map();

        for (const row of doc.querySelectorAll('[data-row-key^="workspace:"]')) {
          const workspaceId = (row.getAttribute("data-row-key") || "").slice("workspace:".length);
          const seat = firstBySuffix(row, ["_folder"]);
          if (!seat) continue;
          const svg = seat.querySelector("svg");
          if (!svg) continue;
          const label = textOf(firstBySuffix(row, ["_title"])) || textOf(row);
          projectLabels.set(workspaceId, label);
          projects.push({
            kind: "project",
            pinnable: true,
            row,
            seat,
            svg,
            label,
            id: workspaceId,
            storageKey: workspaceId,
            fromStrip: true,
            glyph: store.get(workspaceId) || store.get(nameKeyOf(label)),
            icon: projectIconOf(workspaceId, label),
          });
        }

        for (const svg of doc.querySelectorAll('svg[class*="_rowIcon"], svg[class*="_rowIconSelected"]')) {
          const row = svg.parentElement || svg.parentNode;
          if (!row) continue;
          const label = textOf(firstBySuffix(row, ["_rowName"]));
          if (label.length === 0) continue;
          const key = nameKeyOf(label);
          projects.push({
            kind: "project",
            pinnable: false,
            row,
            seat: row,
            svg,
            label,
            id: key,
            storageKey: key,
            fromStrip: false,
            glyph: store.get(key),
            icon: store.get(key) || "📁",
          });
        }

        for (const row of doc.querySelectorAll('[data-row-key^="session:"]')) {
          const sessionId = (row.getAttribute("data-row-key") || "").slice("session:".length);
          if (firstBySuffix(row, ["_rowActions"]) === null) continue;
          const label = textOf(firstBySuffix(row, ["_title"])) || textOf(row);
          const projectId = ownsSession.get(sessionId) || "";
          sessions.push({
            kind: "session",
            pinnable: true,
            row,
            id: sessionId,
            label,
            projectId,
            projectLabel: projectLabels.get(projectId) || "",
            icon: projectId ? projectIconOf(projectId, projectLabels.get(projectId) || "") : "💬",
          });
        }

        return { projects, sessions };
      };

      /* -------------------------------------------------- project icon seat */

      const unpaint = (svg) => {
        const entry = painted.get(svg);
        if (!entry) return;
        entry.svg.style.display = entry.previousDisplay;
        if (entry.keptVisible) entry.seat.style.removeProperty("display");
        if (entry.span.parentNode) entry.span.parentNode.removeChild(entry.span);
        painted.delete(svg);
      };

      const paint = (target) => {
        const existing = painted.get(target.svg);
        if (!target.glyph) {
          unpaint(target.svg);
          return;
        }
        if (existing) {
          if (existing.span.textContent !== target.glyph) existing.span.textContent = target.glyph;
          if (existing.span.parentNode !== target.seat) target.seat.insertBefore(existing.span, target.svg);
          existing.storageKey = target.storageKey;
          existing.label = target.label;
          return;
        }
        const span = doc.createElement("span");
        mark(span);
        span.className = "dsd-project-icon";
        span.textContent = target.glyph;
        span.setAttribute("role", "button");
        span.setAttribute("tabindex", "0");
        span.title = t("change");
        span.setAttribute("aria-label", t("change"));
        const entry = {
          svg: target.svg,
          seat: target.seat,
          span,
          label: target.label,
          storageKey: target.storageKey,
          previousDisplay: target.svg.style.display,
          keptVisible: false,
        };
        span.addEventListener("mousedown", stop);
        span.addEventListener("click", (event) => {
          stop(event);
          picker.open(span, entry);
        });
        span.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            stop(event);
            picker.open(span, entry);
          }
        });
        target.seat.insertBefore(span, target.svg);
        target.svg.style.display = "none";
        // The shipped project row hides its folder seat while hovered; an inline
        // !important keeps the chosen icon reachable (and clickable).
        if (target.fromStrip) {
          target.seat.style.setProperty("display", "inline-flex", "important");
          entry.keptVisible = true;
        }
        painted.set(target.svg, entry);
      };

      /* ------------------------------------------------------- row triggers */

      /**
       * One button in the row's own hover strip, styled from the strip's own
       * icon button so it is indistinguishable from the shipped controls.
       */
      const makeTrigger = (target, options) => {
        const strip = firstBySuffix(target.row, ["_rowActions"]);
        const host = strip || target.row;
        const template = strip ? strip.querySelector("button") : null;
        if (!strip && host.classList) host.classList.add("dsd-projrow");
        const button = mark(doc.createElement("button"));
        button.type = "button";
        if (template) button.className = template.className;
        button.classList.add("dsd-trigger");
        if (options.extraClass) button.classList.add(options.extraClass);
        if (!strip) button.classList.add("dsd-inline-trigger");
        button.innerHTML = options.glyph;
        button.title = options.label;
        button.setAttribute("aria-label", options.label);
        if (options.pressed !== undefined) button.setAttribute("aria-pressed", String(options.pressed));
        button.addEventListener("mousedown", stop);
        button.addEventListener("click", (event) => {
          stop(event);
          options.onClick();
        });
        host.appendChild(button);
        return button;
      };

      const ensureIconTrigger = (target) => {
        const existing = iconTriggers.get(target.svg);
        if (existing && existing.button.isConnected) {
          existing.target = target;
          existing.button.title = t("change");
          existing.button.setAttribute("aria-label", t("change"));
          return;
        }
        const button = makeTrigger(target, {
          glyph: TRIGGER_SVG,
          label: t("change"),
          onClick: () => picker.open(button, target),
        });
        iconTriggers.set(target.svg, { button, target });
      };

      const ensurePinTrigger = (target) => {
        const key = target.kind + ":" + target.id;
        const pinned = target.kind === "project"
          ? store.isPinnedProject(target.id)
          : store.isPinnedSession(target.id);
        const existing = pinTriggers.get(key);
        if (existing && existing.button.isConnected) {
          existing.target = target;
          existing.pinned = pinned;
          if (existing.rendered !== pinned) {
            existing.button.innerHTML = starSvg(pinned);
            existing.rendered = pinned;
          }
          existing.button.classList.toggle("dsd-trigger-on", pinned);
          existing.button.setAttribute("aria-pressed", String(pinned));
          existing.button.title = pinned ? t("unpin") : t("pin");
          return;
        }
        const button = makeTrigger(target, {
          glyph: starSvg(pinned),
          label: pinned ? t("unpin") : t("pin"),
          pressed: pinned,
          onClick: () => {
            store.togglePin(target.kind, {
              id: target.id,
              title: target.label,
              icon: target.icon,
            });
          },
        });
        if (pinned) button.classList.add("dsd-trigger-on");
        pinTriggers.set(key, { button, target, pinned, rendered: pinned });
      };

      /**
       * Hide/show the CELL that holds the browsing list. Only the activity view
       * does that: it replaces the whole browsing surface. Collapsing 项目 must
       * keep the cell (and therefore our own section headers) on screen.
       */
      let listCell = null;
      let listCellDefault = "";

      const syncListVisibility = () => {
        const area = doc.querySelector('[class*="_listArea"]');
        if (!area) return;
        if (listCell === null || !listCell.isConnected) {
          const scroller = findScroller(area);
          let host = scroller;
          while (host && host.parentNode && host.parentNode !== area) host = host.parentNode;
          listCell = host && host.parentNode === area ? host : scroller || null;
          if (listCell) listCellDefault = listCell.style.display;
        }
        if (!listCell) return;
        // ONLY the activity view hides the whole cell. Collapsing 项目 hides the
        // shipped rows through a class on the scroller — hiding the cell as well
        // would take our own section headers down with it and leave no way back.
        listCell.style.display = activityOpen ? "none" : listCellDefault;
      };

      /* --------------------------------------------------- activity view */

      let activityOpen = false;
      let activityNode = null;
      let activitySignature = "";

      /**
       * The workspace header's icon row (view options / add directory, next to
       * the search button). Three lookups, most specific first, so a build that
       * renames either class still gets a bell.
       */
      /** Prefer the icon row inside the sidebar's own section header. */
      const headerScore = (node) => {
        let score = 0;
        if (typeof node.closest === "function") {
          if (node.closest('[class*="_sectionHeader"]')) score += 2;
          if (node.closest('[class*="_listArea"]')) score += 1;
        }
        if (node.offsetParent !== undefined && node.offsetParent !== null) score += 1;
        return score;
      };

      const headerCandidates = () =>
        [...doc.querySelectorAll('[class*="_headerActions"]')];

      const isVisible = (node) =>
        node.offsetParent === undefined ? true : node.offsetParent !== null;

      /**
       * The bell's home is the row that carries the search glyph: the shipped
       * section header holds [label][search][icon actions], so appending there
       * lands the bell at the far right of the same visible row — no guessing
       * which of several `headerActions` in the document is the real one.
       */
      const anchorKind = { kind: "" };

      const headerActions = () => {
        const search = doc.querySelector('[class*="_searchButton"]');
        const header = search && typeof search.closest === "function"
          ? search.closest('[class*="_sectionHeader"]')
          : null;
        if (header && isVisible(header)) {
          anchorKind.kind = "search";
          return header;
        }

        const candidates = headerCandidates();
        // A document can hold several rows with this class (hidden panes keep
        // theirs mounted). Paint the bell into a VISIBLE one.
        const visible = candidates.filter(isVisible);
        const pool = visible.length > 0 ? visible : candidates;
        let best = null;
        let bestScore = -1;
        for (const node of pool) {
          const score = headerScore(node);
          if (score > bestScore) {
            best = node;
            bestScore = score;
          }
        }
        if (best) {
          anchorKind.kind = "actions";
          return best;
        }

        const fallback = doc.querySelector('[class*="_sectionHeader"]');
        if (fallback) anchorKind.kind = "header";
        return fallback || null;
      };

      /** Create the bell once; every later pass only updates and re-seats it. */
      const buildBell = (host) => {
        const template = host.querySelector("button");
        const button = doc.createElement("button");
        mark(button);
        button.type = "button";
        // Copying the shipped trigger's classes keeps the button native: same
        // size, colour, hover and focus treatment as search / view options / add.
        if (template) button.className = template.className;
        button.classList.add("dsd-trigger");
        button.innerHTML = BELL_SVG(activityOpen);
        button.addEventListener("mousedown", stop);
        button.addEventListener("click", (event) => {
          stop(event);
          activityOpen = !activityOpen;
          schedule();
        });
        return button;
      };

      /**
       * Seat the bell as the LAST cell of the header row — right next to the
       * three shipped icons, which is where the user wants it.
       *
       * It is a sibling of the icon group, never a child of it: that group is
       * `max-width:60px` (exactly two 28px icons plus their gap) with
       * `overflow:hidden`, so a third icon inside it would be clipped. The header
       * itself lays its cells out with `gap:4px` — the same gap the icon group
       * uses — so a sibling lands with identical spacing.
       */
      const seatBell = (host) => {
        if (host === null) return;
        const row = classMatches(host, "_headerActions") && host.parentNode ? host.parentNode : host;
        if (bellButton.parentNode !== row) row.appendChild(bellButton);
      };

      const ensureBell = () => {
        const host = headerActions();
        if (!host) return;
        if (!bellButton) bellButton = mark(buildBell(host));
        // A newer instance retired this bell: stand down for good. Without this
        // the two instances would trade the row forever (each re-appends what
        // the other removed).
        if (
          typeof bellButton.getAttribute === "function" &&
          bellButton.getAttribute("data-dsh-session-deck-stale") === "1"
        ) {
          return;
        }
        if (bellRendered !== activityOpen) {
          bellButton.innerHTML = BELL_SVG(activityOpen);
          bellRendered = activityOpen;
        }
        bellButton.classList.toggle("dsd-trigger-on", activityOpen);
        bellButton.setAttribute("aria-pressed", String(activityOpen));
        bellButton.title = t("activityBell");
        bellButton.setAttribute("aria-label", t("activityBell"));
        // Exactly one bell, re-seated whenever the header row is re-rendered.
        seatBell(host);
        // A live page can hold instances from earlier bundle loads (the shell
        // does not unload them). The newest one is authoritative: strays are
        // hidden, never detached — detaching would make their owner re-append
        // it on its next pass and the two would trade the row forever.
        // Take the row over: every other bell here belongs to an older instance
        // — retire it (marker + hidden) so its owner stops re-seating it.
        for (const node of [...host.querySelectorAll("button")]) {
          if (node === bellButton) continue;
          if (!classMatches(node, "dsd-trigger")) continue;
          if (typeof node.setAttribute === "function") node.setAttribute("data-dsh-session-deck-stale", "1");
          if (node.style) node.style.display = "none";
        }
      };

      /**
       * Day headings the way Codex labels them: 今天 / 昨天, then the weekday for
       * the past week, then an absolute date.
       */
      const groupLabel = (time) => {
        if (!time) return t("earlier");
        const now = new Date();
        const date = new Date(time);
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        if (time >= midnight) return t("today");
        if (time >= midnight - 86400000) return t("yesterday");
        if (time >= midnight - 6 * 86400000) {
          const names = t("weekdays");
          return Array.isArray(names) ? names[date.getDay()] : t("earlier");
        }
        return language === "zh"
          ? (date.getMonth() + 1) + "月" + date.getDate() + "日"
          : (date.getMonth() + 1) + "/" + date.getDate();
      };

      const relative = (time) => {
        if (!time) return "";
        const delta = Date.now() - time;
        if (delta < 60000) return t("justNow");
        if (delta < 3600000) return Math.floor(delta / 60000) + t("minutesShort");
        if (delta < 86400000) return Math.floor(delta / 3600000) + t("hoursShort");
        return Math.floor(delta / 86400000) + t("daysShort");
      };

      /**
       * One entry, laid out like Codex's activity rows: glyph, then a two-line
       * body — title with the project on its right, then the stamp line.
       */
      const buildActivityRow = (entry) => {
        const row = doc.createElement("div");
        row.className = "dsd-activity-row";
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        row.title = entry.projectTitle ? entry.projectTitle + " · " + entry.title : entry.title;

        const glyph = entry.running
          ? buildSpinner(doc, t("running") + " · " + entry.title)
          : (() => {
              const node = doc.createElement("span");
              node.className = "dsd-activity-glyph";
              node.textContent = entry.projectId ? projectIconOf(entry.projectId, entry.projectTitle) : "💬";
              return node;
            })();

        const body = doc.createElement("div");
        body.className = "dsd-activity-body";

        const line = doc.createElement("div");
        line.className = "dsd-activity-line";
        const name = doc.createElement("span");
        name.className = "dsd-activity-name";
        name.textContent = entry.title;
        line.appendChild(name);
        if (entry.projectTitle) {
          const source = doc.createElement("span");
          source.className = "dsd-activity-source";
          source.textContent = entry.projectTitle;
          line.appendChild(source);
        }

        const meta = doc.createElement("div");
        meta.className = "dsd-activity-meta";
        const stamp = doc.createElement("span");
        stamp.className = "dsd-activity-stamp";
        stamp.textContent = entry.time ? relative(entry.time) : "";
        if (entry.preview) {
          // Codex shows the thread's latest content under its title.
          const snippet = doc.createElement("span");
          snippet.className = "dsd-activity-preview";
          snippet.textContent = entry.preview;
          meta.appendChild(snippet);
        }
        meta.appendChild(stamp);
        if (entry.running) {
          // The leading ring already says "running"; the line just labels it.
          const state = doc.createElement("span");
          state.className = "dsd-activity-state";
          state.style.marginLeft = "auto";
          const label = doc.createElement("span");
          label.textContent = t("running");
          state.appendChild(label);
          meta.appendChild(state);
        }

        body.appendChild(line);
        body.appendChild(meta);
        row.appendChild(glyph);
        row.appendChild(body);
        row.addEventListener("click", () => {
          // Codex behaviour: picking a conversation shows it in the main column
          // and leaves the activity view where it is — you can keep browsing.
          navigate.openSession(entry.id);
        });
        return row;
      };

      const renderActivity = () => {
        const area = doc.querySelector('[class*="_listArea"]');
        const entries = activityOpen ? dataFace.recents(60) : [];
        const signature = activityOpen ? JSON.stringify([language, entries]) : "closed";
        const previousSignature = activitySignature;
        activitySignature = signature;

        if (!activityOpen || !area) {
          syncListVisibility();
          if (activityNode && activityNode.parentNode) activityNode.parentNode.removeChild(activityNode);
          activityNode = null;
          activitySignature = signature;
          return;
        }

        // The recent list replaces the browsing list (and with it the pinned
        // band, which lives inside the same scroller) while it is open.
        syncListVisibility();
        if (signature === previousSignature && activityNode && activityNode.parentNode === area) return;

        const node = mark(doc.createElement("div"));
        node.className = "dsd-activity";
        const head = doc.createElement("div");
        head.className = "dsd-activity-head";
        const title = doc.createElement("span");
        title.className = "dsd-activity-title";
        title.textContent = t("activity");
        const close = doc.createElement("button");
        close.type = "button";
        close.className = "dsd-pin-action";
        close.textContent = "✕";
        close.title = t("close");
        close.setAttribute("aria-label", t("close"));
        close.addEventListener("mousedown", stop);
        close.addEventListener("click", (event) => {
          stop(event);
          activityOpen = false;
          schedule();
        });
        head.appendChild(title);
        head.appendChild(close);
        node.appendChild(head);

        if (entries.length === 0) {
          const empty = doc.createElement("div");
          empty.className = "dsd-activity-empty";
          empty.textContent = t("activityEmpty");
          node.appendChild(empty);
        } else {
          let currentGroup = null;
          for (const entry of entries) {
            const label = groupLabel(entry.time);
            if (label !== currentGroup) {
              currentGroup = label;
              const group = doc.createElement("div");
              group.className = "dsd-activity-group";
              group.textContent = label;
              node.appendChild(group);
            }
            node.appendChild(buildActivityRow(entry));
          }
        }

        if (activityNode && activityNode.parentNode) activityNode.parentNode.removeChild(activityNode);
        activityNode = node;
        area.insertBefore(node, area.firstChild);
      };

      let bellButton = null;
      let bellRendered = false;

      /**
       * Diagnostic status. It is published through a null-rendering slot entry
       * whose id carries the values, so the shell's own Slot inspection can be
       * asked "is the header row found, how many bells are in it, is the list in
       * rail mode" without a debugger attached.
       */
      const reportStatus = () => {
        if (typeof onStatus !== "function") return;
        const host = headerActions();
        const allBells = host
          ? [...host.querySelectorAll("button")].filter((node) => classMatches(node, "dsd-trigger"))
          : [];
        const bells = allBells.filter((node) => !(node.style && node.style.display === "none")).length;
        const candidates = headerCandidates();
        const rect = host && typeof host.getBoundingClientRect === "function"
          ? host.getBoundingClientRect()
          : null;
        const box = rect
          ? "box" + Math.round(rect.width) + "x" + Math.round(rect.height) + "x" + Math.round(rect.left) + "x" + Math.round(rect.top)
          : "box0";
        onStatus([
          "cand" + candidates.length,
          "vis" + candidates.filter(isVisible).length,
          "host" + (host ? 1 : 0),
          "vis" + (host && isVisible(host) ? 1 : 0),
          "bell" + bells,
          "retired" + allBells.filter(
            (node) => node.getAttribute && node.getAttribute("data-dsh-session-deck-stale") === "1",
          ).length,
          "at" + (anchorKind.kind || "none"),
          "tree" + dataFace.treeFacts(),
          "data" + dataFace.dataFacts(),


          box,
          "rail" + (host && host.closest && isRail(host.closest('[class*="_root"]')) ? 1 : 0),
        ].join("."));
      };

      /* ------------------------------------------------------ pinned band */

      /**
       * The band lives INSIDE the list's scroll container (the module `list`
       * element, whose children are the project groups), so it scrolls with the
       * projects as one surface instead of floating above them. `.listArea` is
       * only the fallback for a build whose scroller cannot be identified.
       */
      const findScroller = (area) => {
        for (const node of area.querySelectorAll("*")) {
          const list = node.classList;
          if (!list) continue;
          for (const name of list) {
            if (name === "list" || name.slice(-5) === "_list") return node;
          }
        }
        return null;
      };

      const pinnedAnchor = () => {
        const area = doc.querySelector('[class*="_listArea"]');
        if (!area) return null;
        const root = area.parentNode;
        if (root && isRail(root)) return null;
        return findScroller(area) || area;
      };

      const buildPinRow = (entry, kind) => {
        const row = doc.createElement("div");
        row.className = "dsd-pin-row";
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        row.title = entry.title || entry.id;
        const title = doc.createElement("span");
        title.className = "dsd-pin-title";
        title.textContent = entry.title || entry.id;
        // A conversation that is working shows the shell's own running ring in
        // the leading seat — same as it does in the project list.
        const icon = kind === "session" && entry.running
          ? buildSpinner(doc, t("running") + " · " + (entry.title || entry.id))
          : (() => {
              const node = doc.createElement("span");
              node.className = "dsd-pin-icon";
              node.textContent = entry.icon || (kind === "project" ? "📁" : "💬");
              return node;
            })();

        if (kind === "project") {
          // A pinned project is a disclosure, exactly like the project row in
          // the shipped list: click it to unfold its conversations right here.
          // The chevron takes the icon's seat on hover, so it costs no width and
          // the row keeps the shared grid.
          const open = store.isExpanded(entry.id);
          const caret = buildCaret(doc, "dsd-chevron", open);
          row.classList.add("dsd-pin-project");
          if (open) row.classList.add("dsd-pin-row-open");
          row.appendChild(caret);
        }

        const tag = doc.createElement("span");
        tag.className = "dsd-pin-kind";
        tag.textContent = kind === "project" ? t("project") : t("session");
        const action = doc.createElement("button");
        action.type = "button";
        action.className = "dsd-pin-action";
        action.textContent = "✕";
        action.title = t("unpin");
        action.setAttribute("aria-label", t("unpin"));
        action.addEventListener("mousedown", stop);
        action.addEventListener("click", (event) => {
          stop(event);
          store.togglePin(kind, { id: entry.id });
        });
        row.addEventListener("click", () => {
          if (kind === "project") store.toggleExpanded(entry.id);
          else navigate.openSession(entry.id);
        });
        row.appendChild(icon);
        row.appendChild(title);
        row.appendChild(tag);
        row.appendChild(action);
        return row;
      };

      /** The conversations nested under a pinned, unfolded project. */
      const buildProjectSessions = (entry, data) => {
        const nodes = [];
        const sessions = dataFace.sessionsOf(entry.id, dataFace.read());
        if (sessions.length === 0) {
          const empty = doc.createElement("div");
          empty.className = "dsd-pin-empty";
          empty.textContent = t("noSessions");
          nodes.push(empty);
          return nodes;
        }
        for (const session of sessions) {
          const row = doc.createElement("div");
          row.className = "dsd-pin-row dsd-pin-sub";
          row.setAttribute("role", "button");
          row.setAttribute("tabindex", "0");
          row.title = session.title;
          const icon = session.running
            ? buildSpinner(doc, t("running") + " · " + session.title)
            : (() => {
                const node = doc.createElement("span");
                node.className = "dsd-pin-icon";
                node.textContent = entry.icon || "📁";
                return node;
              })();
          const title = doc.createElement("span");
          title.className = "dsd-pin-title";
          title.textContent = session.title;
          row.appendChild(icon);
          row.appendChild(title);
          row.addEventListener("click", () => navigate.openSession(session.id));
          nodes.push(row);
        }
        return nodes;
      };

      /** One collapsible section header: triangle + label + optional count. */
      const buildSectionHead = (label, count, open, onToggle) => {
        const head = mark(doc.createElement("div"));
        head.className = "dsd-section-head";
        head.setAttribute("role", "button");
        head.setAttribute("tabindex", "0");
        head.setAttribute("aria-expanded", String(open));
        head.title = label + " · " + t("collapseSection");
        head.appendChild(buildCaret(doc, "dsd-section-caret", open));
        const text = doc.createElement("span");
        text.className = "dsd-section-label";
        text.textContent = label;
        head.appendChild(text);
        if (count !== null) {
          const badge = doc.createElement("span");
          badge.className = "dsd-section-count";
          badge.textContent = String(count);
          head.appendChild(badge);
        }
        head.addEventListener("click", onToggle);
        return head;
      };

      /**
       * The sidebar's own sections, in the shipped list's scroll container so the
       * whole column scrolls as one surface:
       *   [置顶 head][pinned rows][separator][项目 head][ …shipped project list… ]
       * Collapsing 项目 hides the shipped rows through a class on the scroller —
       * they belong to React, so nothing is removed, only hidden.
       */
      const isStale = (node) => {
        const stale = Boolean(node) &&
          typeof node.getAttribute === "function" &&
          node.getAttribute("data-dsh-session-deck-stale") === "1";
        if (stale && node.style) node.style.display = "none";
        return stale;
      };

      const renderSections = () => {
        // A newer instance owns the page: leave it alone and stop rendering.
        if (isStale(sectionsNode)) return;
        const anchor = pinnedAnchor();
        const pinnedCollapsed = store.isPinnedCollapsed();
        const projectsCollapsed = store.isWorkspaceCollapsed();
        const live = dataFace.read();

        /**
         * Resolve every pinned row against the LIVE stores — a renamed
         * conversation, a new project title or a running turn shows up here the
         * moment the shell knows about it, whether or not the underlying row is
         * currently rendered anywhere. The stored snapshot is only a fallback,
         * and is refreshed with whatever we resolve.
         */
        const projects = store.pinnedProjects().map((entry) => {
          const title = dataFace.workspaceTitle(entry.id) || entry.title;
          const icon = store.get(entry.id) || store.get(nameKeyOf(title)) || "📁";
          return { id: entry.id, title, icon };
        });
        const sessions = store.pinnedSessions().map((entry) => {
          const summary = dataFace.sessionSummary(entry.id);
          const workspaceId = dataFace.workspaceOfSession(entry.id);
          const workspaceTitle = workspaceId ? dataFace.workspaceTitle(workspaceId) : "";
          const icon = workspaceId ? projectIconOf(workspaceId, workspaceTitle) : (entry.icon || "💬");
          return {
            id: entry.id,
            title: (summary && summary.title) || entry.title,
            icon,
            running: Boolean(summary && summary.running),
          };
        });
        for (const entry of projects) store.syncPin("project", { id: entry.id, title: entry.title, icon: entry.icon });
        for (const entry of sessions) {
          store.syncPin("session", { id: entry.id, title: entry.title, icon: entry.icon });
        }

        if (anchor) anchor.classList.toggle("dsd-projects-collapsed", projectsCollapsed);

        const projectCount = doc.querySelectorAll('[data-row-key^="workspace:"]').length;
        const signature = JSON.stringify([
          language,
          pinnedCollapsed,
          projectsCollapsed,
          projects,
          sessions,
          projectCount,
          projects.map((entry) => (store.isExpanded(entry.id)
            ? [entry.id, dataFace.sessionsOf(entry.id, dataFace.read()).map((session) => session.id)]
            : [entry.id, null])),
        ]);

        if (anchor === null) {
          if (sectionsNode && sectionsNode.parentNode) sectionsNode.parentNode.removeChild(sectionsNode);
          sectionsNode = null;
          sectionsSignature = "";
          return;
        }
        if (signature === sectionsSignature && sectionsNode && sectionsNode.parentNode === anchor) return;

        const node = mark(doc.createElement("div"));
        node.className = "dsd-sections";

        if (projects.length > 0 || sessions.length > 0) {
          node.appendChild(buildSectionHead(
            t("pinned"),
            projects.length + sessions.length,
            !pinnedCollapsed,
            () => store.togglePinnedCollapsed(),
          ));
          if (!pinnedCollapsed) {
            for (const entry of projects) {
              node.appendChild(buildPinRow(entry, "project"));
              if (store.isExpanded(entry.id)) {
                for (const child of buildProjectSessions(entry)) node.appendChild(child);
              }
            }
            for (const entry of sessions) node.appendChild(buildPinRow(entry, "session"));
          }
          const separator = doc.createElement("div");
          separator.className = "dsd-pin-sep";
          separator.setAttribute("aria-hidden", "true");
          node.appendChild(separator);
        }

        node.appendChild(buildSectionHead(
          t("projects"),
          projectCount,
          !projectsCollapsed,
          () => store.toggleWorkspaceCollapsed(),
        ));

        if (sectionsNode && sectionsNode.parentNode) sectionsNode.parentNode.removeChild(sectionsNode);
        sectionsNode = node;
        sectionsSignature = signature;
        anchor.insertBefore(node, anchor.firstChild);
      };

      /**
       * The bottom widgets (quota cards, 上下文洞察, 使用统计 …) get their own
       * collapsible 组件 header, inserted at the top of the sidebar's foot area;
       * the settings/account row below stays untouched.
       */
      const renderWidgetsSection = () => {
        const foot = doc.querySelector('[class*="_footArea"]');
        if (!foot) {
          if (widgetsNode && widgetsNode.parentNode) widgetsNode.parentNode.removeChild(widgetsNode);
          widgetsNode = null;
          const footActions = firstBySuffix(doc.querySelector('[class*="_footArea"]') || doc.body, ["_footerActions"]);
          if (footActions && footActions.style) footActions.style.removeProperty("display");
          return;
        }
        const actions = firstBySuffix(foot, ["_footerActions"]);
        const widgetCount = actions ? actions.children.length : 0;
        if (widgetCount === 0) {
          if (widgetsNode && widgetsNode.parentNode) widgetsNode.parentNode.removeChild(widgetsNode);
          widgetsNode = null;
          if (actions) actions.style.removeProperty("display");
          return;
        }
        const collapsed = store.isWidgetsCollapsed();
        if (!widgetsNode || !widgetsNode.isConnected) {
          widgetsNode = buildSectionHead(
            t("widgets"),
            null,
            !collapsed,
            () => store.toggleWidgetsCollapsed(),
          );
          foot.insertBefore(widgetsNode, foot.firstChild);
        } else {
          widgetsNode.setAttribute("aria-expanded", String(!collapsed));
          const caret = widgetsNode.querySelector(".dsd-section-caret");
          if (caret) caret.classList.toggle("dsd-caret-open", !collapsed);
        }
        if (actions) actions.style.display = collapsed ? "none" : "";
      };

      /* ------------------------------------------------------------ passes */

      const scan = () => {
        frame = 0;
        // Instances from earlier bundle loads (an update, a profile change) are
        // still alive and still painting into this same sidebar. Everything is
        // rendered first, then every copy but ours is hidden — a stack of
        // duplicate section headers used to survive until the next restart.
        // The locale service can mount after this plugin; re-read the language on
        // every pass so the copy self-corrects without a reload.
        if (typeof readLanguage === "function") {
          const next = readLanguage();
          if (next !== language) language = next;
        }
        const { projects, sessions } = collect();

        for (const target of projects) {
          paint(target);
          if (target.pinnable) ensurePinTrigger(target);
          ensureIconTrigger(target);
        }
        for (const target of sessions) ensurePinTrigger(target);

        // Refresh the stored labels/icons of pins that are currently rendered,
        // so renaming or re-iconing a project follows into the pinned band.
        for (const target of projects) {
          if (target.pinnable) store.syncPin("project", { id: target.id, title: target.label, icon: target.icon });
        }
        for (const target of sessions) {
          store.syncPin("session", { id: target.id, title: target.label, icon: target.icon });
        }

        const liveIconSeats = new Set(projects.map((target) => target.svg));
        for (const [svg, record] of [...iconTriggers.entries()]) {
          if (liveIconSeats.has(svg) && svg.isConnected) continue;
          if (record.button.parentNode) record.button.parentNode.removeChild(record.button);
          iconTriggers.delete(svg);
        }
        const livePinKeys = new Set([
          ...projects.filter((target) => target.pinnable).map((target) => "project:" + target.id),
          ...sessions.map((target) => "session:" + target.id),
        ]);
        for (const [key, record] of [...pinTriggers.entries()]) {
          if (livePinKeys.has(key) && record.button.isConnected) continue;
          if (record.button.parentNode) record.button.parentNode.removeChild(record.button);
          pinTriggers.delete(key);
        }
        for (const svg of [...painted.keys()]) {
          if (!liveIconSeats.has(svg) || !svg.isConnected) unpaint(svg);
        }

        renderSections();
        renderWidgetsSection();
        ensureBell();
        renderActivity();
        hideSiblings(sectionsNode, "dsd-sections");
        hideSiblings(activityNode, "dsd-activity");
        hideSiblings(widgetsNode, "dsd-section-head");
        reportStatus();
      };

      const schedule = () => {
        if (frame !== 0) return;
        const view = doc.defaultView;
        frame = view && typeof view.requestAnimationFrame === "function"
          ? view.requestAnimationFrame(scan)
          : setTimeout(scan, 60);
      };

      const targetForNode = (node) => {
        if (!node || typeof node.closest !== "function") return null;
        const { projects } = collect();
        const row = node.closest('[data-row-key^="workspace:"]');
        if (row) {
          const hit = projects.find((entry) => entry.row === row);
          if (hit) return hit;
        }
        const seat = node.closest('[role="listitem"]');
        if (seat) {
          const svg = seat.querySelector('svg[class*="_rowIcon"], svg[class*="_rowIconSelected"]');
          if (svg) {
            const hit = projects.find((entry) => entry.svg === svg);
            if (hit) return hit;
          }
        }
        return null;
      };

      const onContextMenu = (event) => {
        const target = targetForNode(event.target);
        if (!target) return;
        stop(event);
        picker.open(event.target, target);
      };

      if (typeof MutationObserver === "function") {
        observer = new MutationObserver(schedule);
        observer.observe(doc.body, { childList: true, subtree: true });
      }
      doc.addEventListener("contextmenu", onContextMenu, true);
      unsubscribe = store.subscribe(schedule);
      scan();

      return {
        refresh: schedule,
        dispose: () => {
          picker.close();
          if (unsubscribe) unsubscribe();
          if (observer) observer.disconnect();
          doc.removeEventListener("contextmenu", onContextMenu, true);
          const view = doc.defaultView;
          if (frame !== 0 && view && typeof view.cancelAnimationFrame === "function") {
            view.cancelAnimationFrame(frame);
          }
          for (const svg of [...painted.keys()]) unpaint(svg);
          for (const [, record] of [...iconTriggers.entries()]) {
            if (record.button.parentNode) record.button.parentNode.removeChild(record.button);
          }
          for (const [, record] of [...pinTriggers.entries()]) {
            if (record.button.parentNode) record.button.parentNode.removeChild(record.button);
          }
          iconTriggers.clear();
          pinTriggers.clear();
          if (sectionsNode && sectionsNode.parentNode) sectionsNode.parentNode.removeChild(sectionsNode);
          sectionsNode = null;
          sectionsSignature = "";
          if (bellButton && bellButton.parentNode) bellButton.parentNode.removeChild(bellButton);
          bellButton = null;
          syncListVisibility();
          if (activityNode && activityNode.parentNode) activityNode.parentNode.removeChild(activityNode);
          activityNode = null;
          activitySignature = "";
        },
      };
    }

    /* --------------------------------------------------------------- apply */

    function injectStyles(doc) {
      if (doc.querySelector('style[data-plugin="' + PLUGIN_ID + '"]') !== null) return;
      const tag = doc.createElement("style");
      tag.dataset.plugin = PLUGIN_ID;
      tag.textContent = STYLE_TEXT;
      doc.head.appendChild(tag);
    }

    /**
     * Client entry: the plugin is a pure DOM surface (no slots, no client
     * services), so it mounts on any composition and cannot shadow shipped UI.
     */
    /**
     * Liveness beacon: a null-rendering entry in a list slot the shell mounts with
     * every conversation. It paints nothing — it exists so the running client can
     * be asked, from the outside, which build of this plugin it is actually
     * running (see the plugin's README).
     */
    function mountBeacon(ctx, status) {
      const slots = ctx && typeof ctx.get === "function" ? safe(() => ctx.get("slots"), undefined) : undefined;
      if (!slots || typeof slots.inject !== "function") return undefined;
      const key = "conversation.composer.dock";
      const id = "session-deck-probe" + (status ? "." + status : "");
      return safe(() => slots.inject(key, () => slots.register(
        { name: key, id },
        () => null,
      )), undefined);
    }

    function apply(ctx) {
      if (typeof document === "undefined" || !document.body) return undefined;
      const disposers = [];
      try {
        injectStyles(document);
        reclaimPrevious(document);
        const store = createStore();

        /**
         * Navigation goes through the same client service the shipped sidebar
         * uses; when a composition does not provide it we fall back to the row
         * itself (click the rendered row / scroll it into view).
         */
        const uiService = () => (ctx && typeof ctx.get === "function" ? safe(() => ctx.get("uiWorkspace"), undefined) : undefined);
        const rowFor = (key) => document.querySelector('[data-row-key="' + key + '"]');
        const navigate = {
          openSession(sessionId) {
            const svc = uiService();
            if (svc && typeof svc.openSession === "function") {
              const done = safe(() => {
                svc.openSession(sessionId);
                return true;
              }, false);
              if (done) return;
            }
            const row = rowFor("session:" + sessionId);
            if (row && typeof row.click === "function") row.click();
          },
          openWorkspace(workspaceId) {
            const svc = uiService();
            if (svc && typeof svc.openWorkspace === "function") {
              const done = safe(() => {
                svc.openWorkspace(workspaceId);
                return true;
              }, false);
              if (done) return;
            }
            const row = rowFor("workspace:" + workspaceId);
            if (row && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "nearest" });
          },
        };

        // The locale service may only be reachable through the scoped context
        // `ctx.inject` hands us, so the discovered instance is remembered and
        // every later read uses it as the hint.
        let discoveredLocale = ctx && typeof ctx.get === "function"
          ? safe(() => ctx.get("locale"), undefined)
          : undefined;
        const readLanguage = () => detectLanguage(ctx, discoveredLocale);
        language = readLanguage();

        let overlay = null;
        const refresh = () => {
          if (overlay !== null) overlay.refresh();
        };
        const picker = createPicker(document, store, refresh);
        const data = createDataFace(ctx, refresh, store);
        // Version + DOM probe: re-registered whenever the reported status
        // changes, so `session-deck-probe.<status>` is always the live answer.
        const probe = { dispose: null, status: "" };
        const reportProbe = (status) => {
          if (status === probe.status) return;
          probe.status = status;
          if (probe.dispose) safe(() => probe.dispose(), undefined);
          probe.dispose = mountBeacon(ctx, status) || null;
        };
        disposers.push(() => {
          if (probe.dispose) safe(() => probe.dispose(), undefined);
        });
        reportProbe("boot");

        overlay = mountSidebar(document, store, picker, navigate, data, readLanguage, reportProbe);
        disposers.push(() => data.dispose());
        disposers.push(() => overlay.dispose());

        // Follow the harness's own language. The locale service may mount after
        // this plugin does, so the subscription is installed through
        // `ctx.inject(['locale'], …)` — which runs as soon as the service is live
        // (and again if it is replaced) — and every scan re-reads the language as
        // a second safety net.
        const followLocale = (service) => {
          if (service) discoveredLocale = service;
          const next = readLanguage();
          if (next !== language) {
            language = next;
            refresh();
          }
          if (service && typeof service.subscribe === "function") {
            const dispose = safe(() => service.subscribe(() => {
              const value = readLanguage();
              if (value === language) return;
              language = value;
              refresh();
            }), undefined);
            if (typeof dispose === "function") disposers.push(dispose);
          }
        };
        const reflectiveLocale = ctx && typeof ctx.get === "function"
          ? safe(() => ctx.get("locale"), undefined)
          : undefined;
        if (ctx && typeof ctx.inject === "function") {
          safe(() => ctx.inject(["locale"], (scoped) => {
            const service = scoped && scoped.locale
              ? scoped.locale
              : ctx && typeof ctx.get === "function"
                ? safe(() => ctx.get("locale"), undefined)
                : undefined;
            followLocale(service);
          }), undefined);
        } else {
          followLocale(reflectiveLocale);
        }
      } catch (error) {
        console.warn("[dsh-session-deck] could not mount:", error);
      }
      return () => {
        for (const dispose of disposers.splice(0)) {
          safe(() => dispose(), undefined);
        }
      };
    }

    return (module.exports = { name: "session-deck", inject: [], apply });
  },
});
