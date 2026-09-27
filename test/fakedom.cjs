/* ------------------------------------------------------------- fake DOM --- */
const storage = new Map();

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = {};
    this._classes = new Set();
    this.textContent = '';
    const attrs = this.attrs;
    this.dataset = new Proxy({}, {
      set(_target, key, value) {
        attrs['data-' + String(key).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())] = String(value);
        return true;
      },
      get(_target, key) {
        return attrs['data-' + String(key).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())];
      },
    });
    this.innerHTML = '';
    this.listeners = {};
    this.style = {
      display: '',
      props: {},
      setProperty(key, value) {
        this.props[key] = value;
      },
      removeProperty(key) {
        delete this.props[key];
      },
    };
  }
  get classList() {
    const self = this;
    return {
      add(...names) {
        names.forEach((name) => self._classes.add(name));
      },
      remove(...names) {
        names.forEach((name) => self._classes.delete(name));
      },
      contains(name) {
        return self._classes.has(name);
      },
      toggle(name, on) {
        if (on) self._classes.add(name);
        else self._classes.delete(name);
      },
      [Symbol.iterator]() {
        return self._classes[Symbol.iterator]();
      },
    };
  }
  get className() {
    return [...this._classes].join(' ');
  }
  set className(value) {
    this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }
  get firstChild() {
    return this.children.length > 0 ? this.children[0] : null;
  }
  get textContentDeep() {
    return this.textContent + this.children.map((child) => child.textContentDeep).join('');
  }
  get isConnected() {
    let node = this;
    while (node.parentNode) node = node.parentNode;
    return node === doc.body || node === doc;
  }
  detach(child) {
    if (child.parentNode && child.parentNode.children) {
      const list = child.parentNode.children;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        if (list[i] === child) list.splice(i, 1);
      }
    }
    child.parentNode = null;
  }
  appendChild(child) {
    this.detach(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  insertBefore(child, ref) {
    this.detach(child);
    child.parentNode = this;
    const index = this.children.indexOf(ref);
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains(node));
  }
  setAttribute(key, value) {
    this.attrs[key] = String(value);
  }
  getAttribute(key) {
    return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null;
  }
  addEventListener(type, handler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }
  removeEventListener(type, handler) {
    const list = this.listeners[type] || [];
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }
  getBoundingClientRect() {
    return { left: 24, top: 40, bottom: 62, right: 160, width: 136, height: 22 };
  }
  focus() {
    this.focused = true;
  }
  descendants() {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
  matches(selector) {
    if (selector === '*') return true;
    if (String(selector).indexOf(',') !== -1) {
      return String(selector).split(',').some((part) => this.matches(part.trim()));
    }
    const presence = selector.match(/^\[([\w-]+)\]$/);
    if (presence) return this.getAttribute(presence[1]) !== null;
    const attr = selector.match(/^\[([\w-]+)(\^=|=)"([^"]*)"\]$/);
    if (attr) {
      const value = this.getAttribute(attr[1]);
      if (value === null) return false;
      return attr[2] === '^=' ? value.startsWith(attr[3]) : value === attr[3];
    }
    const classAttr = selector.match(/^\[class\*="([^"]+)"\]$/);
    if (classAttr) return this.className.includes(classAttr[1]);
    const typed = selector.match(/^([a-z]+)\[class\*="([^"]+)"\]$/);
    if (typed) {
      return this.tagName.toLowerCase() === typed[1] && this.className.includes(typed[2]);
    }
    const plain = selector.match(/^([a-z]+)$/);
    if (plain) return this.tagName.toLowerCase() === plain[1];
    return false;
  }
  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches && node.matches(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }
  querySelectorAll(selector) {
    return this.descendants().filter((node) => node.matches(selector));
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

const doc = new FakeElement('#document');
doc.matches = () => false;
doc.body = new FakeElement('body');
doc.body.parentNode = doc;
doc.head = new FakeElement('head');
doc.head.parentNode = doc;
doc.createElement = (tag) => new FakeElement(tag);
let frameSeq = 0;
const pendingFrames = new Map();
doc.defaultView = {
  innerWidth: 1200,
  innerHeight: 800,
  requestAnimationFrame(callback) {
    frameSeq += 1;
    pendingFrames.set(frameSeq, callback);
    return frameSeq;
  },
  cancelAnimationFrame(id) {
    pendingFrames.delete(id);
  },
  flush() {
    const callbacks = [...pendingFrames.values()];
    pendingFrames.clear();
    callbacks.forEach((callback) => callback());
  },
};
doc.addEventListener = FakeElement.prototype.addEventListener.bind(doc);
doc.removeEventListener = FakeElement.prototype.removeEventListener.bind(doc);
doc.querySelector = FakeElement.prototype.querySelector.bind(doc.body);
doc.querySelectorAll = FakeElement.prototype.querySelectorAll.bind(doc.body);

global.document = doc;
global.MutationObserver = class {
  observe() {}
  disconnect() {}
};
global.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
  },
  addEventListener() {},
  removeEventListener() {},
  innerWidth: 1200,
  innerHeight: 800,
};

function fire(element, type, extra) {
  const event = Object.assign(
    {
      target: element,
      stopPropagation() {},
      preventDefault() {},
    },
    extra || {},
  );
  for (const handler of element.listeners[type] || []) handler(event);
}

/** Build one sidebar project row exactly as the shipped component renders it. */
/** Sidebar chrome: root > sectionHeader + listArea (list rows live inside). */
function buildSidebar() {
  const root = new FakeElement('div');
  root.className = 'Hash_root Hash_wide';
  const header = new FakeElement('div');
  header.className = 'Hash_sectionHeader';
  const label = new FakeElement('span');
  label.className = 'Hash_sectionLabel Hash_wide';
  label.textContent = '项目';
  header.appendChild(label);
  const headerActions = new FakeElement('div');
  headerActions.className = 'Hash_headerActions';
  for (const kind of ['Hash_iconButton Hash_searchButton', 'Hash_iconButton Hash_addButton', 'Hash_iconButton Hash_viewOptions']) {
    const button = new FakeElement('button');
    button.className = kind;
    const svg = new FakeElement('svg');
    button.appendChild(svg);
    headerActions.appendChild(button);
  }
  header.appendChild(headerActions);
  root.appendChild(header);
  const listArea = new FakeElement('div');
  listArea.className = 'Hash_listArea';
  const treeBody = new FakeElement('div');
  treeBody.className = 'Hash_treeBody Hash_wide';
  const list = new FakeElement('div');
  list.className = 'Hash_list';
  treeBody.appendChild(list);
  listArea.appendChild(treeBody);
  root.appendChild(listArea);
  const footArea = new FakeElement('div');
  footArea.className = 'Hash_footArea';
  const footerActions = new FakeElement('div');
  footerActions.className = 'Hash_footerActions';
  for (const kind of ['Hash_quotaCard', 'Hash_statsRow', 'Hash_hindsightRow']) {
    const widget = new FakeElement('div');
    widget.className = kind;
    footerActions.appendChild(widget);
  }
  footArea.appendChild(footerActions);
  const settingsArea = new FakeElement('div');
  settingsArea.className = 'Hash_settingsArea';
  footArea.appendChild(settingsArea);
  root.appendChild(footArea);

  doc.body.appendChild(root);
  return {
    root,
    footArea,
    footerActions,
    settingsArea,
    listArea,
    treeBody,
    list,
    header,
    headerActions,
    addRow(node) {
      list.appendChild(node);
    },
  };
}

function buildWorkspaceRow({ key, title, folderClass }) {
  const row = new FakeElement('div');
  row.className = 'Hash_projectRow';
  row.setAttribute('data-row-key', 'workspace:' + key);
  const folder = new FakeElement('span');
  folder.className = 'Hash_slot Hash_' + folderClass;
  const svg = new FakeElement('svg');
  folder.appendChild(svg);
  row.appendChild(folder);
  const text = new FakeElement('span');
  text.className = 'Hash_projectText';
  const titleEl = new FakeElement('span');
  titleEl.className = 'Hash_title';
  titleEl.textContent = title;
  text.appendChild(titleEl);
  row.appendChild(text);
  const actions = new FakeElement('span');
  actions.className = 'Hash_rowActions';
  // The shipped strip carries the row's own icon buttons (the "..." menu); the
  // plugin copies the first one's classes so its trigger looks native.
  const menuTrigger = new FakeElement('button');
  menuTrigger.className = 'Hash_iconButton Hash_menuTrigger';
  actions.appendChild(menuTrigger);
  row.appendChild(actions);
  return { row, folder, svg, actions };
}

/** Build one sidebar Session row exactly as the shipped component renders it. */
function buildSessionRow(sessionId, title) {
  const row = new FakeElement('div');
  row.className = 'Hash_sessionRow';
  row.setAttribute('data-row-key', 'session:' + sessionId);
  const slot = new FakeElement('span');
  slot.className = 'Hash_slot';
  row.appendChild(slot);
  const titleEl = new FakeElement('span');
  titleEl.className = 'Hash_title';
  titleEl.textContent = title;
  row.appendChild(titleEl);
  const actions = new FakeElement('span');
  actions.className = 'Hash_rowActions';
  const shipped = new FakeElement('button');
  shipped.className = 'Hash_iconButton';
  actions.appendChild(shipped);
  row.appendChild(actions);
  return { row, title: titleEl, actions, shipped };
}

/** Build one directory-picker row (folder button with a rowIcon svg). */
function buildPickerRow(name) {
  const list = new FakeElement('div');
  list.className = 'Browse_column';
  list.setAttribute('role', 'list');
  const seat = new FakeElement('span');
  seat.setAttribute('role', 'listitem');
  const button = new FakeElement('button');
  button.className = 'Browse_row';
  const svg = new FakeElement('svg');
  svg.className = 'Browse_rowIcon';
  button.appendChild(svg);
  const nameEl = new FakeElement('span');
  nameEl.className = 'Browse_rowName';
  nameEl.textContent = name;
  button.appendChild(nameEl);
  seat.appendChild(button);
  list.appendChild(seat);
  doc.body.appendChild(list);
  return { list, button, svg };
}

module.exports = {
  doc,
  buildSidebar,
  buildSessionRow,
  flushFrames: () => doc.defaultView.flush(),
  storage,
  local: global.window.localStorage,
  fire,
  FakeElement,
  buildWorkspaceRow,
  buildPickerRow,
};
