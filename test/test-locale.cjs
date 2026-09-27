/**
 * Regression harness for the "Pinned instead of 置顶" bug.
 *
 * The locale service can mount AFTER the plugin: at apply time `ctx.get('locale')`
 * is undefined and the browser language (en-US) points the wrong way, while the
 * shipped sidebar is already rendering Chinese copy. The plugin must land on
 * Chinese anyway, and must flip when the service arrives / the language changes.
 */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const fake = require('./fakedom.cjs');
const { doc, fire, buildSidebar, buildSessionRow, buildWorkspaceRow, flushFrames } = fake;

// A macOS Chrome reporting English while the app renders Chinese.
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true });
Object.defineProperty(globalThis, 'window', {
  value: Object.assign(globalThis.window || {}, {}),
  configurable: true,
  writable: true,
});

// A shell that leaves a static <html lang="en"> while rendering Chinese copy.
doc.documentElement = { lang: 'en' };

const sidebar = buildSidebar();                 // its section label reads 项目
const wsRow = buildWorkspaceRow({ key: 'w-debug', title: 'deepseek调试', folderClass: 'folder' });
const sessionRow = buildSessionRow('s-alpha', '重构侧边栏会话列表');
sidebar.addRow(wsRow.row);
sidebar.addRow(sessionRow.row);

const checks = [];
const check = (name, ok, extra) => checks.push({ name, ok: Boolean(ok), extra });

/* The locale service is NOT live yet; ctx.inject is how the plugin waits. */
let injected;
const listOf = (snapshot) => ({ getSnapshot: () => snapshot, subscribe: () => () => {} });
const services = {
  uiWorkspace: { openSession() {}, openWorkspace() {} },
  sessions: { list: listOf({ ids: ['s-alpha'], byId: { 's-alpha': { displayTitle: '重构侧边栏会话列表' } } }) },
  workspaces: { list: listOf({ items: [{ workspaceId: 'w-debug', title: 'deepseek调试', sessionIds: ['s-alpha'] }] }) },
};
let localeSnapshot = { active: 'en', locales: [], revision: 1 };
let localeListeners = [];
const ctx = {
  get: (name) => (name === 'locale' ? undefined : services[name]),
  inject: (keys, callback) => {
    injected = { keys, callback };
  },
};

let definition;
window.__ModuleLoader__ = { load: (def) => { definition = def; } };
vm.runInThisContext(
  fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'client.js'),
    'utf8',
  ),
  { filename: 'client.js' },
);
const plugin = definition.factory(() => {
  throw new Error('no module-table requires');
});
plugin.apply(ctx);

// Pin a conversation so the band exists.
const star = sessionRow.actions.children.find((child) => child.className.includes('dsd-trigger'));
fire(star, 'click');
flushFrames();

const head = () => {
  const band = doc.body.descendants().find((el) => el.className.includes('dsd-sections'));
  if (!band) return '(no band)';
  const label = band.descendants().find((el) => el.className.includes('dsd-section-label'));
  return label ? label.textContent : '(no head)';
};

check('the plugin waits for the locale service', Boolean(injected) && injected.keys[0] === 'locale');
check(
  'Chinese UI + English browser still reads 置顶',
  head() === '置顶',
  head() + ' (navigator=' + navigator.language + ')',
);

/* The service lands, reporting English. */
injected.callback({
  locale: {
    getLocale: () => localeSnapshot,
    subscribe: (fn) => {
      localeListeners.push(fn);
      return () => {
        localeListeners = localeListeners.filter((entry) => entry !== fn);
      };
    },
  },
});
flushFrames(); // the re-label rides the next animation frame
check('an English locale flips the copy', head() === 'Pinned', head());
check('the plugin subscribed to locale changes', localeListeners.length === 1, String(localeListeners.length));

/* The user switches the app language back to Chinese. */
localeSnapshot = { active: 'zh', locales: [], revision: 2 };
localeListeners.slice().forEach((fn) => fn());
flushFrames();
check('switching back to Chinese re-labels the band', head() === '置顶', head());

/* And a late service that never arrives leaves the DOM probe in charge. */
check(
  'rendered Chinese copy beats a static <html lang="en">',
  head() === '置顶',
  head() + ' (lang=' + doc.documentElement.lang + ')',
);
check(
  'the shipped sidebar label is what the probe reads',
  sidebar.root.descendants().some((el) => el.className.includes('_sectionLabel') && el.textContent === '项目'),
);

let failed = 0;
for (const entry of checks) {
  if (!entry.ok) failed += 1;
  console.log((entry.ok ? 'PASS  ' : 'FAIL  ') + entry.name + (entry.extra && !entry.ok ? '   [' + entry.extra + ']' : ''));
}
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks passed');
process.exit(failed === 0 ? 0 : 1);
