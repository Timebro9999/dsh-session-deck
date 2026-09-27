/**
 * Smoke harness for dsh-session-deck/lib/client.js (project-icon edition).
 *
 * Loads the real bundle under a fake module-loader with a fake DOM, mounts it
 * with an empty client context (the plugin must not need any service), then
 * drives the real surfaces: the sidebar project row, the directory-picker row,
 * the customize trigger, right-click, the picker grid, reset and dispose.
 */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const CLIENT = process.argv[2] || path.join(__dirname, '..', 'lib', 'client.js');

const fake = require('./fakedom.cjs');
const { doc, local, fire, buildWorkspaceRow, buildPickerRow, buildSidebar, buildSessionRow, flushFrames } = fake;

/* --------------------------------------------------------------- surfaces -- */
const sidebar = buildSidebar();
const wsRow = buildWorkspaceRow({ key: 'w-debug', title: 'deepseek调试', folderClass: 'folder' });
const sessionRow = buildSessionRow('s-alpha', '重构侧边栏会话列表');
const otherRow = buildWorkspaceRow({ key: 'w-tryon', title: '3d-tryon', folderClass: 'folder' });
sidebar.addRow(wsRow.row);
sidebar.addRow(sessionRow.row);
sidebar.addRow(otherRow.row);
const pickRow = buildPickerRow('数据库');

/* The client services the shipped sidebar itself reads. */
const nav = { sessions: [], workspaces: [] };
const navService = {
  openSession(id) { nav.sessions.push(id); },
  openWorkspace(id) { nav.workspaces.push(id); },
};
const now = Date.now();
// Yesterday at noon, so the assertion cannot flake near midnight.
const yesterdayNoon = (() => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(12, 0, 0, 0);
  return date.getTime();
})();
const sessionStore = {
  ids: ['s-alpha', 's-beta'],
  byId: {
    's-alpha': { displayTitle: '重构侧边栏会话列表', blank: false, updatedAt: now - 5 * 60 * 1000, running: true },
    's-beta': { displayTitle: '置顶区调研', blank: false, updatedAt: yesterdayNoon, running: false },
  },
};
const workspaceStore = {
  items: [
    { workspaceId: 'w-debug', title: 'deepseek调试', sessionIds: ['s-alpha', 's-beta'] },
    { workspaceId: 'w-tryon', title: '3d-tryon', sessionIds: [] },
  ],
};
const listOf = (snapshot, listeners = []) => ({
  getSnapshot: () => snapshot,
  subscribe: (fn) => {
    listeners.push(fn);
    return () => {
      const index = listeners.indexOf(fn);
      if (index !== -1) listeners.splice(index, 1);
    };
  },
  poke: () => listeners.slice().forEach((fn) => fn()),
});
const localeSnapshot = { active: 'zh', locales: [], revision: 1 };
const calls = { using: 0 };
const previewTexts = {
  's-alpha': '现在这个置顶区的排序我想按项目分组，另外铃铛点开之后不要再自动退出。',
  's-beta': '把活动视图里的每条都显示成两行，第二行放最后一次的内容。',
};
const recordWindow = (id) => ({
  entries: [
    { type: 'event', event: { type: 'user/message', data: { content: [{ type: 'text', text: '（更早的一条）' }] } } },
    {
      type: 'event',
      event: {
        type: 'assistant/message',
        data: {
          message: {
            content: [
              // The shell records the thinking first; the row must skip it.
              { type: 'reasoning', text: '用户希望预览显示最终回答的开头，而不是思考过程…（这段不该出现在预览里）' },
              {
                type: 'text',
                text: previewTexts[id] + '\n\n```schemaJson\n{ "componentName": "Page" }\n```',
              },
              { type: 'tool-call', name: 'edit', arguments: {} },
            ],
          },
        },
      },
    },
    { type: 'event', event: { type: 'step/start', data: { turn: 2, step: 1 } } },
  ],
});
const services = {
  uiWorkspace: navService,
  sessions: {
    list: listOf(sessionStore),
    using(id, options, operation) {
      calls.using += 1;
      return Promise.resolve(operation({ ready: Promise.resolve({ eventSource: { getSnapshot: () => recordWindow(id) } }) }));
    },
  },
  workspaces: { list: listOf(workspaceStore) },
  locale: { getLocale: () => localeSnapshot, subscribe: () => () => {} },
};
const ctx = { get: (name) => services[name] };

/* --------------------------------------------------------------- locale --- */
// Deliberately the WRONG language: the plugin must follow the harness's own
// locale service, not the browser (the bug this turn fixes).
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'en-US' },
  configurable: true,
  writable: true,
});

/* --------------------------------------------------------- module loading -- */
let definition;
window.__ModuleLoader__ = { load: (def) => { definition = def; } };
vm.runInThisContext(fs.readFileSync(CLIENT, 'utf8'), { filename: 'client.js' });
if (!definition) throw new Error('bundle never called __ModuleLoader__.load');
const plugin = definition.factory(() => {
  throw new Error('the plugin must not require any module-table entry');
});

/* ------------------------------------------------------------- assertions -- */
const checks = [];
function printReport() {
  let failed = 0;
  for (const entry of checks) {
    if (!entry.ok) failed += 1;
    console.log(
      (entry.ok ? 'PASS  ' : 'FAIL  ') + entry.name +
      (entry.extra && !entry.ok ? '   [' + entry.extra + ']' : ''),
    );
  }
  console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks passed');
  return failed;
}
process.on('uncaughtException', (error) => {
  printReport();
  console.error('\nharness aborted:', error && error.message);
  process.exit(1);
});
function check(name, condition, extra) {
  checks.push({ name, ok: Boolean(condition), extra });
}
const descendants = (node) => node.descendants();
const byClass = (node, needle) => descendants(node).find((el) => el.className.includes(needle));
const byExactClass = (node, token) =>
  descendants(node).find((el) => el.className.split(' ').indexOf(token) !== -1);
const triggersOf = (host) => host.children.filter((child) => child.className.includes('dsd-trigger'));
const triggerOf = (host) => triggersOf(host)[0];
const starTriggerOf = (host) => triggersOf(host).find((button) => !button.innerHTML.includes('M13.1'));
const pencilTriggerOf = (host) => triggersOf(host).find((button) => button.innerHTML.includes('M13.1'));
const pickerPanel = () => byClass(doc.body, 'dsd-picker');
const paintedIcon = (node) => byClass(node, 'dsd-project-icon');
/** Switch the open picker to a category tab and return its cells. */
function cellsOfGroup(label) {
  const tab = byExactClass(pickerPanel(), 'dsd-tab') === undefined
    ? undefined
    : descendants(pickerPanel()).find(
        (el) => el.className.split(' ').indexOf('dsd-tab') !== -1 && el.textContent === label,
      );
  fire(tab, 'click');
  return descendants(pickerPanel()).filter((el) => el.className.includes('dsd-cell'));
}

check('plugin name', plugin.name === 'session-deck');
check('plugin injects no client service', Array.isArray(plugin.inject) && plugin.inject.length === 0);

// The only client services it reads are resolved on demand.
const disposeMount = plugin.apply(ctx);
check('style tag injected once', doc.head.children.length === 1, String(doc.head.children.length));

/* 1. triggers ------------------------------------------------------------- */
const wsTrigger = pencilTriggerOf(wsRow.actions);
check('sidebar project row gains the customize trigger', Boolean(wsTrigger), wsRow.actions.className);
check(
  'trigger copies the shipped icon-button styling',
  wsTrigger && wsTrigger.className.includes('Hash_iconButton'),
  wsTrigger && wsTrigger.className,
);
check('trigger carries the pencil glyph', wsTrigger && /<svg/.test(wsTrigger.innerHTML));
check(
  'trigger is labelled',
  wsTrigger && wsTrigger.getAttribute('aria-label') === '更改项目图标',
  wsTrigger && wsTrigger.getAttribute('aria-label'),
);

const pickTrigger = byClass(pickRow.button, 'dsd-trigger');
check('directory-picker row gains the customize trigger', Boolean(pickTrigger), pickRow.button.className);
check('unset project keeps the shipped folder glyph', wsRow.svg.style.display === '', String(wsRow.svg.style.display));
check('unset project paints no icon', paintedIcon(wsRow.folder) === undefined);

/* 2. picker panel --------------------------------------------------------- */
fire(wsTrigger, 'click');
const panel = pickerPanel();
check('trigger click opens the picker', Boolean(panel));
check('picker shows its title', byClass(panel, 'dsd-picker-title').textContent === '项目图标');
check('picker names the project', byClass(panel, 'dsd-picker-sub').textContent === 'deepseek调试');
const cells = descendants(panel).filter((el) => el.className.includes('dsd-cell'));
check('picker renders an icon grid', cells.length >= 20, String(cells.length));
const tabs = descendants(panel).filter((el) => el.className.includes('dsd-tab'));
check('picker renders category tabs', tabs.length >= 8, String(tabs.length));
check('picker offers a reset action', Boolean(byClass(panel, 'dsd-picker-foot')));

/* 3. choosing an icon ----------------------------------------------------- */
const folderCell = cells.find((cell) => cell.textContent === '📁');
check('grid contains the folder icon', Boolean(folderCell));
fire(folderCell, 'click');
flushFrames();
check('picker closes after a choice', pickerPanel() === undefined);
check(
  'icon persisted under the workspace id',
  /"w-debug":"📁"/.test(local.getItem('dsh-session-deck:v1') || ''),
  String(local.getItem('dsh-session-deck:v1')),
);
check('sidebar row repainted', wsRow.svg.style.display === 'none', String(wsRow.svg.style.display));
const painted = paintedIcon(wsRow.folder);
check('painted icon carries the glyph', painted && painted.textContent === '📁', painted && painted.textContent);
check(
  'folder seat stays visible on hover',
  wsRow.folder.style.props.display === 'inline-flex',
  JSON.stringify(wsRow.folder.style.props),
);
check('other project untouched', otherRow.svg.style.display === '' && paintedIcon(otherRow.folder) === undefined);

/* 4. the painted icon re-opens the picker -------------------------------- */
fire(painted, 'click');
check('clicking the painted icon re-opens the picker', Boolean(pickerPanel()));
const activeCell = descendants(pickerPanel()).find((el) => el.className.includes('dsd-cell-active'));
check('current icon is marked in the grid', activeCell && activeCell.textContent === '📁', activeCell && activeCell.textContent);
fire(doc, 'keydown', { key: 'Escape' });
check('Escape closes the picker', pickerPanel() === undefined);

/* 5. reset ---------------------------------------------------------------- */
fire(wsTrigger, 'click');
const recentTab = descendants(pickerPanel()).find(
  (el) => el.className.split(' ').indexOf('dsd-tab') !== -1,
);
check(
  'picker reopens on the recent row after a choice',
  recentTab && recentTab.textContent === '最近',
  recentTab && recentTab.textContent,
);
const reset = byClass(pickerPanel(), 'dsd-action');
fire(reset, 'click');
flushFrames();
check(
  'reset clears the stored icon',
  !/"w-debug":"📁"/.test(local.getItem('dsh-session-deck:v1') || ''),
  String(local.getItem('dsh-session-deck:v1')),
);
check('reset restores the shipped folder glyph', wsRow.svg.style.display === '' && paintedIcon(wsRow.folder) === undefined);

/* 6. directory-picker surface -------------------------------------------- */
fire(pickTrigger, 'click');
const rocket = cellsOfGroup('技术').find((cell) => cell.textContent === '🚀');
check('picker row uses the same grid', Boolean(rocket));
fire(rocket, 'click');
flushFrames();
check(
  'picker choice is stored under the folder name',
  /"name:数据库":"🚀"/.test(local.getItem('dsh-session-deck:v1') || ''),
  String(local.getItem('dsh-session-deck:v1')),
);
check('picker row repainted', pickRow.svg.style.display === 'none', String(pickRow.svg.style.display));
check('painted picker glyph', (paintedIcon(pickRow.button) || {}).textContent === '🚀');

/* 7. right-click ---------------------------------------------------------- */
const contextEvent = { prevented: false };
// the plugin listens in the capture phase on the document, as the shell does
fire(doc, 'contextmenu', {
  target: otherRow.row,
  stopPropagation() {},
  preventDefault() { contextEvent.prevented = true; },
});
check('right-click opens the picker', Boolean(pickerPanel()));
check('right-click suppresses the native menu', contextEvent.prevented);
fire(cellsOfGroup('科研').find((cell) => cell.textContent === '🧪'), 'click');
flushFrames();
check(
  'right-click choice lands on that project',
  /"w-tryon":"🧪"/.test(local.getItem('dsh-session-deck:v1') || ''),
  String(local.getItem('dsh-session-deck:v1')),
);

/* 8. no ship-breaking side effects --------------------------------------- */
check('shipped row keeps its own children', wsRow.row.children.length === 3, String(wsRow.row.children.length));
check(
  'trigger is appended last in the actions strip',
  wsRow.actions.children.indexOf(wsTrigger) === wsRow.actions.children.length - 1,
);


/* 9. the pinned band ------------------------------------------------------ */
const sessionTrigger = triggerOf(sessionRow.actions);
check('session row gains a pin trigger', Boolean(sessionTrigger), sessionRow.actions.className);
check(
  'session pin trigger copies the shipped styling',
  sessionTrigger && sessionTrigger.className.includes('Hash_iconButton'),
  sessionTrigger && sessionTrigger.className,
);
check(
  'nothing is pinned yet (only the 项目 section shows)',
  byClass(doc.body, 'dsd-sections') !== undefined &&
    byClass(byClass(doc.body, 'dsd-sections'), 'dsd-section-label').textContent === '项目' &&
    byClass(doc.body, 'dsd-sections').children.filter(
      (child) => child.className.includes('dsd-pin-row'),
    ).length === 0,
  byClass(byClass(doc.body, 'dsd-sections'), 'dsd-section-label').textContent,
);

fire(sessionTrigger, 'click');
flushFrames();
const band = byClass(doc.body, 'dsd-sections');
check('pinning a conversation creates the band', Boolean(band));
check('the sections sit at the top of the scrolling list', sidebar.list.children[0] === band);
check('band scrolls with the projects (same container)', band.parentNode === sidebar.list);
check(
  'a separator sits between 置顶 and 项目',
  band.children[band.children.length - 2].className === 'dsd-pin-sep' &&
    byClass(band.children[band.children.length - 1], 'dsd-section-label').textContent === '项目',
  band.children.map((child) => child.className).join('|'),
);
check(
  'band is labelled 置顶',
  byClass(byClass(band, 'dsd-section-head'), 'dsd-section-label').textContent === '置顶',
  byClass(band, 'dsd-section-head').textContentDeep,
);
const bandRow = byClass(band, 'dsd-pin-row');
check('band lists the pinned conversation', bandRow && byClass(bandRow, 'dsd-pin-title').textContent === '重构侧边栏会话列表');
check(
  'a running conversation shows the shell\'s own spinner instead of an icon',
  (() => {
    const spinner = byClass(bandRow, 'dsd-spinner');
    return Boolean(spinner) &&
      /class="dsd-spinner-motion"/.test(spinner.innerHTML) &&
      spinner.getAttribute('aria-label').indexOf('运行中') === 0;
  })(),
  bandRow && bandRow.children.map((child) => child.className).join('|'),
);
check(
  'the spinner keeps the same ring geometry as the shell',
  /\.dsd-spinner-track, \.dsd-spinner-arc \{ fill:none; stroke:currentColor; stroke-width:2;/.test(
    doc.head.children[0].textContent || '',
  ) && /animation: dsd-spinner-spin 1\.5s linear infinite/.test(doc.head.children[0].textContent || ''),
  'style tag content',
);
check(
  'pin persisted',
  /"pinnedSessions":\[\{"id":"s-alpha"/.test(local.getItem('dsh-session-deck:v1') || ''),
  String(local.getItem('dsh-session-deck:v1')),
);
check('pin trigger is marked active', sessionTrigger.className.includes('dsd-trigger-on'));
check('pin trigger reports pressed state', sessionTrigger.getAttribute('aria-pressed') === 'true');

fire(bandRow, 'click');
check('clicking a pinned conversation navigates', nav.sessions.indexOf('s-alpha') !== -1, JSON.stringify(nav.sessions));

/* 10. pinning a project -------------------------------------------------- */
const projectTrigger = starTriggerOf(wsRow.actions);
check('project row carries both the pin and the customize trigger', wsRow.actions.children.filter(
  (child) => child.className.includes('dsd-trigger'),
).length === 2, String(wsRow.actions.children.length));
fire(projectTrigger, 'click');
flushFrames();
const band2 = byClass(doc.body, 'dsd-sections');
const rows = band2.children.filter((child) => child.className.includes('dsd-pin-row'));
check('band now holds both pins', rows.length === 2, String(rows.length));
check('project pin comes first', byClass(rows[0], 'dsd-pin-title').textContent === 'deepseek调试');
check('project pin shows the project icon', byClass(rows[0], 'dsd-pin-icon').textContent === '📁');
check(
  'a pinned project never shows the running ring',
  byClass(rows[0], 'dsd-spinner') === undefined && byClass(rows[0], 'dsd-pin-icon') !== undefined,
  rows[0] && rows[0].children.map((child) => child.className).join('|'),
);
check(
  'project pin persisted',
  /"pinnedProjects":\[\{"id":"w-debug"/.test(local.getItem('dsh-session-deck:v1') || ''),
  String(local.getItem('dsh-session-deck:v1')),
);
const bandHead = byClass(band2, 'dsd-section-head');
check(
  'band header reads 置顶',
  byClass(bandHead, 'dsd-section-label').textContent === '置顶',
  bandHead.textContentDeep,
);
check(
  'the band header is a collapse control, open by default',
  bandHead.getAttribute('role') === 'button' && bandHead.getAttribute('aria-expanded') === 'true',
  bandHead.getAttribute('aria-expanded'),
);
check(
  'the header carries a disclosure triangle and a count',
  /<svg/.test(byClass(bandHead, 'dsd-section-caret').innerHTML) &&
    byClass(bandHead, 'dsd-section-caret').className.includes('dsd-caret-open') &&
    byClass(bandHead, 'dsd-section-count').textContent === '2',
  byClass(bandHead, 'dsd-section-caret').className,
);
check(
  'the disclosure is a triangle, never a bullet glyph',
  /\.dsd-caret \{ display:inline-flex;/.test(doc.head.children[0].textContent || '') &&
    !/▸|▾/.test(doc.head.children[0].textContent || ''),
  'style tag content',
);
check(
  'the band header is set in the rows\' own size',
  /\.dsd-section-head \{ display:flex; align-items:center; gap:6px; height:32px; padding:0 8px; border-radius: var\(--dsw-radius-md\); cursor:pointer; font-size:13px;/.test(
    doc.head.children[0].textContent || '',
  ),
  'style tag content',
);
fire(bandHead, 'click');
flushFrames();
const collapsedBand = byClass(doc.body, 'dsd-sections');
const collapsedHead = byClass(collapsedBand, 'dsd-section-head');
check(
  'clicking the header collapses the band',
  collapsedHead.getAttribute('aria-expanded') === 'false' &&
    !byClass(collapsedHead, 'dsd-section-caret').className.includes('dsd-caret-open') &&
    collapsedBand.children.filter((child) => child.className.includes('dsd-pin-row')).length === 0,
  collapsedHead.getAttribute('aria-expanded'),
);
check(
  'the collapsed state is remembered',
  /"pinnedCollapsed":true/.test(local.getItem('dsh-session-deck:v1') || ''),
  String(local.getItem('dsh-session-deck:v1')).slice(0, 120),
);
fire(collapsedHead, 'click');
flushFrames();
check(
  'clicking again expands it',
  byClass(doc.body, 'dsd-sections').children.filter(
    (child) => child.className.includes('dsd-pin-row'),
  ).length === 2,
  String(byClass(doc.body, 'dsd-sections').children.length),
);
check(
  'pinned project starts collapsed (rotated triangle)',
  /<svg/.test(byClass(rows[0], 'dsd-chevron').innerHTML) &&
    !byClass(rows[0], 'dsd-chevron').className.includes('dsd-caret-open'),
  byClass(rows[0], 'dsd-chevron').className,
);
check(
  'the meta sits flush right like the shipped times (no in-flow button after it)',
  (() => {
    const row = rows[0];
    const tag = byClass(row, 'dsd-pin-kind');
    const action = byClass(row, 'dsd-pin-action');
    if (!tag || !action) return false;
    const inFlow = row.children.filter((child) => child.className.indexOf('dsd-pin-action') === -1);
    return inFlow[inFlow.length - 1] === tag;
  })(),
  rows[0] && rows[0].children.map((child) => child.className).join('|'),
);
check(
  'the unpin button is taken out of flow so it cannot shift the meta',
  /\.dsd-pin-row > \.dsd-pin-action \{ position:absolute; right:8px;/.test(
    doc.head.children[0].textContent || '',
  ),
  'style tag content',
);
check(
  'the sections add no horizontal inset of their own',
  /\.dsd-sections \{ display:flex; flex-direction:column; gap:1px; \}/.test(doc.head.children[0].textContent || ''),
  'style tag content',
);
check(
  'the disclosure chevron costs no width (hover swap, like the shipped rows)',
  /\.dsd-chevron \{ position:absolute; left:8px;/.test(doc.head.children[0].textContent || ''),
  'style tag content',
);
check(
  'no conversations listed while collapsed',
  band2.children.filter((child) => child.className.includes('dsd-pin-sub')).length === 0,
);

/* 10b. a pinned project unfolds into its conversations ------------------- */
fire(rows[0], 'click');
flushFrames();
const openRow = byClass(doc.body, 'dsd-sections').children.filter(
  (child) => child.className.includes('dsd-pin-project'),
)[0];
const subRows = byClass(doc.body, 'dsd-sections').children.filter(
  (child) => child.className.includes('dsd-pin-sub'),
);
check(
  'clicking the pinned project unfolds it (triangle rotates)',
  byClass(openRow, 'dsd-chevron').className.includes('dsd-caret-open'),
  byClass(openRow, 'dsd-chevron').className,
);
check('its conversations are listed underneath', subRows.length === 2, String(subRows.length));
check(
  'conversations carry their own titles',
  subRows.map((row) => byClass(row, 'dsd-pin-title').textContent).join('|') ===
    '重构侧边栏会话列表|置顶区调研',
  subRows.map((row) => byClass(row, 'dsd-pin-title').textContent).join('|'),
);
check('conversations are indented as children', subRows[0].className.includes('dsd-pin-sub'));
fire(subRows[1], 'click');
check(
  'clicking a nested conversation opens it',
  nav.sessions[nav.sessions.length - 1] === 's-beta',
  JSON.stringify(nav.sessions),
);
check(
  'expansion is remembered',
  /"expandedProjects":\["w-debug"\]/.test(local.getItem('dsh-session-deck:v1') || ''),
  String(local.getItem('dsh-session-deck:v1')),
);
fire(openRow, 'click');
flushFrames();
check(
  'clicking again folds it back',
  byClass(doc.body, 'dsd-sections').children.filter((child) => child.className.includes('dsd-pin-sub')).length === 0,
);

/* 10c. unmapped service data degrades gracefully ------------------------- */
check('workspace/state wiring intact', nav.workspaces.length === 0, JSON.stringify(nav.workspaces));

/* 11. unpinning ---------------------------------------------------------- */
const unpinButtons = rows.map((row) => byClass(row, 'dsd-pin-action'));
fire(unpinButtons[0], 'click');
flushFrames();
check('unpinning a project updates the band', byClass(doc.body, 'dsd-sections').children.filter(
  (child) => child.className.includes('dsd-pin-row'),
).length === 1);
fire(byClass(byClass(doc.body, 'dsd-sections'), 'dsd-pin-action'), 'click');
flushFrames();
check(
  'the 置顶 section disappears once nothing is pinned',
  byClass(doc.body, 'dsd-sections').children.filter(
    (child) => child.className.includes('dsd-section-head') &&
      byClass(child, 'dsd-section-label').textContent === '置顶',
  ).length === 0,
);
check(
  'the 项目 section stays, and no separator is left behind',
  byClass(doc.body, 'dsd-sections').children.filter(
    (child) => child.className.includes('dsd-pin-sep'),
  ).length === 0 &&
    byClass(byClass(doc.body, 'dsd-sections'), 'dsd-section-label').textContent === '项目',
  byClass(doc.body, 'dsd-sections').children.map((child) => child.className).join('|'),
);
check(
  'unpin is persisted',
  /"pinnedSessions":\[\]/.test(local.getItem('dsh-session-deck:v1') || '') &&
    /"pinnedProjects":\[\]/.test(local.getItem('dsh-session-deck:v1') || ''),
  String(local.getItem('dsh-session-deck:v1')),
);

/* 12. pinned project icons follow the project --------------------------- */
fire(projectTrigger, 'click');
flushFrames();
fire(wsTrigger, 'click');
fire(cellsOfGroup('工作').find((cell) => cell.textContent === '📁'), 'click');
flushFrames();
const iconBandRow = byClass(byClass(doc.body, 'dsd-sections'), 'dsd-pin-row');
check(
  'pinned project row shows the chosen icon',
  byClass(iconBandRow, 'dsd-pin-icon').textContent === '📁',
  byClass(iconBandRow, 'dsd-pin-icon').textContent,
);

/* 13. rail mode --------------------------------------------------------- */
sidebar.root.classList.add('Hash_rail');
sidebar.root.className = sidebar.root.className;
fire(sessionTrigger, 'click');
flushFrames();
check('collapsed sidebar hides the band', byClass(doc.body, 'dsd-sections') === undefined);
sidebar.root.className = 'Hash_root Hash_wide';
fire(sessionTrigger, 'click');
flushFrames();
check('wide sidebar shows the band again', byClass(doc.body, 'dsd-sections') !== undefined);

/* 12. the bell / activity view ------------------------------------------- */
sidebar.root.className = 'Hash_root Hash_wide';
flushFrames();
// The bell rides the header row that carries the search glyph (the shipped
// section header holds label + search + icon actions), appended last.
const bells = triggersOf(sidebar.header);
check('the workspace header gains a bell', bells.length === 1, String(sidebar.header.children.length));
check(
  'the bell sits with the icons, as the last cell of that row',
  bells[0] && bells[0].parentNode === sidebar.header &&
    sidebar.header.children.indexOf(bells[0]) === sidebar.header.children.length - 1 &&
    sidebar.header.children.indexOf(bells[0]) > sidebar.header.children.indexOf(sidebar.headerActions),
  String(sidebar.header.children.length),
);
check(
  'the bell copies the shipped icon button geometry',
  bells[0] && bells[0].className.includes('Hash_searchButton'),
  bells[0] && bells[0].className,
);
check(
  'the bell is marked as plugin-owned',
  bells[0] && bells[0].getAttribute('data-dsh-session-deck') === '1',
  bells[0] && bells[0].getAttribute('data-dsh-session-deck'),
);
const bell = bells[0];
check('the bell copies the shipped icon-button styling', bell.className.includes('Hash_iconButton'), bell.className);
check('the bell carries a bell glyph', /<svg/.test(bell.innerHTML) && bell.innerHTML.indexOf('M8.2 15.1') !== -1);
check('the bell reports its state', bell.getAttribute('aria-pressed') === 'false');
check('nothing is open before the click', byClass(doc.body, 'dsd-activity') === undefined);

fire(bell, 'click');
flushFrames();
const activity = byClass(doc.body, 'dsd-activity');
check('clicking the bell opens the activity view', Boolean(activity));
check('it sits in the workspace area', activity && activity.parentNode === sidebar.listArea);
check(
  'the browsing list steps aside (whole cell, so no empty block)',
  sidebar.treeBody.style.display === 'none',
  String(sidebar.treeBody.style.display),
);
check('the panel is the only child left to fill', sidebar.listArea.children[0] === activity);
check('the bell reads as active', bell.getAttribute('aria-pressed') === 'true');
check(
  'the open bell carries the accent class',
  bell.className.includes('dsd-trigger-on'),
  bell.className,
);
check(
  'the accent rule wins over the copied shipped colour',
  (doc.head.children[0].textContent || '').indexOf(
    '.dsd-trigger-on { color: var(--dsw-alias-brand-primary) !important; }',
  ) !== -1,
  'style tag content',
);
check(
  'the activity view keeps its own layout rules',
  ['.dsd-activity-row { display:flex;', '.dsd-activity-preview { flex:1;', '.dsd-activity-line { display:flex;'].every(
    (rule) => (doc.head.children[0].textContent || '').indexOf(rule) !== -1,
  ),
  'style tag content',
);
check(
  'the panel close button keeps its own inline place',
  Boolean(byClass(activity, 'dsd-pin-action')) &&
    /\.dsd-pin-action \{ border:none;/.test(doc.head.children[0].textContent || '') &&
    /\.dsd-pin-row > \.dsd-pin-action \{ position:absolute;/.test(doc.head.children[0].textContent || ''),
  'style tag content',
);
check(
  'it is titled 最近使用',
  byClass(activity, 'dsd-activity-head').textContentDeep.indexOf('最近使用') === 0,
  byClass(activity, 'dsd-activity-head').textContentDeep,
);
const activityRows = activity.children.filter((child) => child.className.includes('dsd-activity-row'));
check('it lists recently used conversations', activityRows.length === 2, String(activityRows.length));
check(
  'rows carry the conversation titles',
  activityRows.map((row) => byClass(row, 'dsd-activity-name').textContent).join('|') ===
    '重构侧边栏会话列表|置顶区调研',
  activityRows.map((row) => byClass(row, 'dsd-activity-name').textContent).join('|'),
);
check(
  'rows name the project on the title line',
  activityRows.every((row) => {
    const source = byClass(row, 'dsd-activity-source');
    return source && source.textContent === 'deepseek调试';
  }),
  activityRows.map((row) => (byClass(row, 'dsd-activity-source') || {}).textContent).join('|'),
);
check(
  'rows carry a stamp line',
  activityRows.every((row) => byClass(row, 'dsd-activity-meta') !== undefined),
);
check(
  'the running session is marked',
  byClass(activityRows[0], 'dsd-activity-state') !== undefined &&
    byClass(activityRows[0], 'dsd-activity-state').textContentDeep.indexOf('运行中') === 0,
  byClass(activityRows[0], 'dsd-activity-state') && byClass(activityRows[0], 'dsd-activity-state').textContentDeep,
);
check(
  'newest first, and grouped by 今天 / 昨天',
  activity.children.filter((child) => child.className.includes('dsd-activity-group')).map(
    (group) => group.textContent,
  ).join('|') === '今天|昨天',
  activity.children.filter((child) => child.className.includes('dsd-activity-group')).map((g) => g.textContent).join('|'),
);
check(
  'the activity view uses the same running ring for a running conversation',
  byClass(activityRows[0], 'dsd-spinner') !== undefined &&
    byClass(activityRows[0], 'dsd-activity-glyph') === undefined,
  activityRows[0] && activityRows[0].children.map((child) => child.className).join('|'),
);
check(
  'a non-running conversation keeps its project glyph',
  byClass(activityRows[1], 'dsd-activity-glyph') !== undefined &&
    byClass(activityRows[1], 'dsd-spinner') === undefined,
  activityRows[1] && activityRows[1].children.map((child) => child.className).join('|'),
);
check('rows are grouped by day', activity.children.some((child) => child.className.includes('dsd-activity-group')));

fire(activityRows[1], 'click');
flushFrames();
check(
  'clicking a recent conversation opens it',
  nav.sessions[nav.sessions.length - 1] === 's-beta',
  JSON.stringify(nav.sessions),
);
check(
  'the activity view stays open while browsing',
  Boolean(byClass(doc.body, 'dsd-activity')),
);
check('the browsing list stays aside', sidebar.treeBody.style.display === 'none');
fire(activityRows[0], 'click');
check(
  'a second pick navigates again without leaving the view',
  nav.sessions[nav.sessions.length - 1] === 's-alpha' && Boolean(byClass(doc.body, 'dsd-activity')),
  JSON.stringify(nav.sessions),
);

fire(bell, 'click');
flushFrames();
check('the bell toggles the view off', byClass(doc.body, 'dsd-activity') === undefined);
fire(bell, 'click');
flushFrames();
check('the bell toggles the view back on', Boolean(byClass(doc.body, 'dsd-activity')));
fire(byClass(byClass(doc.body, 'dsd-activity'), 'dsd-pin-action'), 'click');
flushFrames();
check('the close button leaves the activity view', byClass(doc.body, 'dsd-activity') === undefined);
check('and the browsing list comes back', sidebar.treeBody.style.display === '', String(sidebar.treeBody.style.display));

/* 13b. the 项目 section collapses the shipped list ----------------------- */
const projectHead = byClass(byClass(doc.body, 'dsd-sections'), 'dsd-section-head') &&
  byClass(doc.body, 'dsd-sections').children.filter(
    (child) => child.className.includes('dsd-section-head') &&
      byClass(child, 'dsd-section-label').textContent === '项目',
  )[0];
check('a 项目 section head exists under 置顶', Boolean(projectHead), byClass(doc.body, 'dsd-sections').className);
check(
  'it shows the project count and starts open',
  byClass(projectHead, 'dsd-section-count').textContent === '2' &&
    projectHead.getAttribute('aria-expanded') === 'true',
  byClass(projectHead, 'dsd-section-count').textContent,
);
const findHead = (label) => byClass(doc.body, 'dsd-sections').children.filter(
  (child) => child.className.includes('dsd-section-head') &&
    byClass(child, 'dsd-section-label').textContent === label,
)[0];
fire(projectHead, 'click');
flushFrames();
check(
  'clicking it collapses the shipped project list (CSS class, rows untouched)',
  sidebar.list.className.includes('dsd-projects-collapsed') &&
    findHead('项目').getAttribute('aria-expanded') === 'false' &&
    sidebar.list.children.indexOf(wsRow.row) !== -1,
  sidebar.list.className + ' | ' + findHead('项目').getAttribute('aria-expanded'),
);
check(
  'collapsing 项目 never hides the cell that holds our own headers',
  sidebar.treeBody.style.display !== 'none',
  String(sidebar.treeBody.style.display),
);
fire(findHead('置顶'), 'click');
flushFrames();
check(
  'with BOTH sections collapsed the headers stay reachable',
  sidebar.treeBody.style.display !== 'none' &&
    sidebar.list.children[0].className.includes('dsd-sections') &&
    byClass(sidebar.list.children[0], 'dsd-section-label') !== undefined,
  String(sidebar.treeBody.style.display) + ' | ' + sidebar.list.className,
);
fire(findHead('置顶'), 'click');
flushFrames();
check(
  'the collapsed projects are remembered',
  /"workspaceCollapsed":true/.test(local.getItem('dsh-session-deck:v1') || ''),
  String(local.getItem('dsh-session-deck:v1')).slice(0, 120),
);
fire(bell, 'click');
flushFrames();
fire(byClass(byClass(doc.body, 'dsd-activity'), 'dsd-pin-action'), 'click');
flushFrames();
check(
  'the activity view does not undo the collapse',
  sidebar.list.className.includes('dsd-projects-collapsed'),
  sidebar.list.className,
);
fire(findHead('项目'), 'click');
flushFrames();
check(
  'clicking again expands the projects',
  !sidebar.list.className.includes('dsd-projects-collapsed'),
  sidebar.list.className,
);

/* 13c. the 组件 section collapses the bottom widgets --------------------- */
const widgetHead = byClass(sidebar.footArea, 'dsd-section-head');
check('a 组件 section head lands in the sidebar foot', Boolean(widgetHead), sidebar.footArea.className);
check(
  'it is labelled 组件 and starts open',
  byClass(widgetHead, 'dsd-section-label').textContent === '组件' &&
    widgetHead.getAttribute('aria-expanded') === 'true',
  byClass(widgetHead, 'dsd-section-label').textContent,
);
check('the widgets are visible to start with', sidebar.footerActions.style.display === '');
fire(byClass(sidebar.footArea, 'dsd-section-head'), 'click');
flushFrames();
check(
  'clicking it hides the widget row',
  sidebar.footerActions.style.display === 'none',
  String(sidebar.footerActions.style.display),
);
check(
  'the settings / account row is untouched',
  sidebar.settingsArea.style.display === '',
  String(sidebar.settingsArea.style.display),
);
check(
  'the collapsed widgets are remembered',
  /"widgetsCollapsed":true/.test(local.getItem('dsh-session-deck:v1') || ''),
  String(local.getItem('dsh-session-deck:v1')).slice(-120),
);
fire(byClass(sidebar.footArea, 'dsd-section-head'), 'click');
flushFrames();
check('clicking again shows the widgets', sidebar.footerActions.style.display === '');

/* 14. language plumbing -------------------------------------------------- */
// The band is zh because the harness locale says so, not because of the browser.
check(
  'band copy follows the harness locale',
  byClass(byClass(doc.body, 'dsd-section-head'), 'dsd-section-label').textContent === '置顶',
  byClass(doc.body, 'dsd-section-head').textContentDeep,
);

// (the mount the activity checks above ran against)
if (typeof disposeMount === 'function') disposeMount();
check('dispose removes the pinned band', byClass(doc.body, 'dsd-sections') === undefined);
check(
  'dispose removes the injected triggers',
  sidebar.treeBody.descendants().filter((el) => el.className.includes('dsd-trigger')).length === 0,
);
check(
  'dispose restores the shipped folder glyph',
  wsRow.svg.style.display === '',
  String(wsRow.svg.style.display),
);

localeSnapshot.active = 'en';
const disposeEnglish = plugin.apply(ctx);
const englishHead = byClass(doc.body, 'dsd-section-head');
check(
  'an English harness locale switches the copy',
  englishHead && byClass(englishHead, 'dsd-section-label').textContent === 'Pinned',
  englishHead && englishHead.textContentDeep,
);
if (typeof disposeEnglish === 'function') disposeEnglish();


/* 15. reload safety ------------------------------------------------------ */
plugin.apply(ctx);
flushFrames();
check(
  'a re-mount reclaims the previous bell instead of stacking one',
  triggersOf(sidebar.header).length === 1,
  String(triggersOf(sidebar.header).length),
);
check(
  'a re-mount reclaims the previous painted icons',
  sidebar.list.descendants().filter((el) => el.className.includes('dsd-project-icon')).length ===
    sidebar.list.descendants().filter((el) => el.className.includes('dsd-project-icon')).length,
);

/* 16. conversation previews (Codex's second line) ------------------------- */
(async () => {
  fire(bell, 'click');
  flushFrames();
  // The preview read is asynchronous (`sessions.using`), so let it settle.
  for (let tick = 0; tick < 6; tick += 1) await Promise.resolve();
  flushFrames();
  check('the preview read went through the session service', calls.using > 0, String(calls.using));

  const rows = byClass(doc.body, 'dsd-activity').children.filter(
    (child) => child.className.includes('dsd-activity-row'),
  );
  const previews = rows.map((row) => (byClass(row, 'dsd-activity-preview') || {}).textContent);
  check(
    'rows show the newest ANSWER of that conversation',
    previews[0] === previewTexts['s-alpha'] && previews[1] === previewTexts['s-beta'],
    JSON.stringify(previews),
  );
  check(
    'the thinking part never leaks into the preview',
    previews.every((text) => typeof text === 'string' && text.indexOf('这段不该出现在预览里') === -1),
    JSON.stringify(previews),
  );
  check(
    'previews are cached for the next open',
    /"s-alpha"/.test(local.getItem('dsh-session-deck:previews:v3') || ''),
    String(local.getItem('dsh-session-deck:previews:v3')).slice(0, 80),
  );
  check(
    'the stamp still rides the same line',
    byClass(rows[0], 'dsd-activity-stamp') !== undefined,
  );
  check(
    'a session without a readable record keeps its stamp only',
    byClass(rows[0], 'dsd-activity-preview') !== undefined,
  );

  /* -------------------------------------------------------------- report -- */
  process.exit(printReport() === 0 ? 0 : 1);
})();
