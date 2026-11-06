import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');

/** Stand-in for the browser `Element` the plugin brand-checks with. */
class FakeElement {}

/**
 * Build one clickable element the plugin's selectors understand.
 * @param spec - tag, title, class and href.
 * @returns the element.
 */
function element({ tag = 'DIV', title = null, className = '', href = null } = {}) {
  const node = new FakeElement();
  node.tagName = tag.toUpperCase();
  node.getAttribute = (name) => {
    if (name === 'href') return href;
    if (name === 'title') return title;
    if (name === 'class') return className;
    return null;
  };
  node.matches = (selector) =>
    selector.split(',').some((part) => {
      const rule = part.trim();
      if (rule === 'button') return node.tagName === 'BUTTON';
      if (rule === '[role="button"]') return node.getAttribute('role') === 'button';
      if (rule === '[class*="fileLink"]') return className.includes('fileLink');
      if (rule === 'a[href]') return node.tagName === 'A' && href !== null;
      if (rule === '[title]') return title !== null;
      throw new Error(`unsupported selector in test: ${rule}`);
    });
  node.closest = (selector) => (node.matches(selector) ? node : null);
  return node;
}

/** Minimal module-loader host plus the plugin's Host route. */
function makeHarness({ failFetch = false } = {}) {
  let loaded;
  const listeners = new Map();
  const opens = [];
  const errors = [];
  const window = {
    addEventListener(name, listener, capture) {
      listeners.set(name, { listener, capture });
    },
    removeEventListener(name) {
      listeners.delete(name);
    },
    __ModuleLoader__: {
      load(definition) {
        loaded = definition;
      },
    },
  };
  vm.runInNewContext(source, {
    window,
    URL,
    Element: FakeElement,
    fetch: async (url, init) => {
      if (failFetch) throw new Error('route unavailable');
      opens.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({ ok: true, opened: true }) };
    },
    console: { ...console, error: (...args) => errors.push(args.join(' ')) },
  });

  let disposer;
  loaded.factory().apply({
    effect(callback) {
      disposer = callback();
    },
  });

  return {
    get installed() { return listeners.has('click'); },
    get subscription() { return listeners.get('click'); },
    get opens() { return opens; },
    get errors() { return errors; },
    click(target, modifiers = {}) {
      const event = {
        target,
        button: 0,
        defaultPrevented: false,
        prevented: false,
        stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; },
        ...modifiers,
      };
      listeners.get('click').listener(event);
      return event;
    },
    dispose() { disposer(); },
  };
}

/** Let the fire-and-forget Host call settle. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

/** The DSH file-link button, captured from the running GUI. */
const folderButton = (title = 'plugins/tools/dsh-open-folder-link/') =>
  element({
    tag: 'button',
    className: '_fileMention_rve47_92 _fileLink_rve47_59',
    title,
  });

test('installs one capture listener and removes it on dispose', () => {
  const harness = makeHarness();
  assert.equal(harness.installed, true);
  assert.equal(harness.subscription.capture, true, 'the listener must run in capture');
  harness.dispose();
  assert.equal(harness.installed, false);
});

test('opens the folder a DSH file-link button names', () => {
  const harness = makeHarness();
  const event = harness.click(folderButton());
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.opens)), [
    {
      url: '/local/open-folder-link/open',
      body: { path: 'plugins/tools/dsh-open-folder-link/' },
    },
  ]);
  harness.dispose();
});

test('opens a Session-scoped folder address on an anchor', () => {
  const harness = makeHarness();
  const event = harness.click(
    element({ tag: 'a', href: 'dsh-resource://file/session/ses_abc/data/benchmark-collections' }),
  );
  assert.equal(event.prevented, true);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.opens.map((o) => o.body))), [
    { path: 'data/benchmark-collections' },
  ]);
  harness.dispose();
});

test('keeps the leading slash of an absolute Session path', () => {
  const harness = makeHarness();
  harness.click(element({ tag: 'a', href: 'dsh-resource://file/session/ses_abc//data/benchmark-collections' }));
  assert.deepEqual(JSON.parse(JSON.stringify(harness.opens.map((o) => o.body))), [
    { path: '/data/benchmark-collections' },
  ]);
  harness.dispose();
});

test('decodes percent-encoded segments', () => {
  const harness = makeHarness();
  harness.click(element({ tag: 'a', href: 'dsh-resource://file/session/ses_abc/docs/a%20b/c' }));
  assert.deepEqual(JSON.parse(JSON.stringify(harness.opens.map((o) => o.body))), [
    { path: 'docs/a b/c' },
  ]);
  harness.dispose();
});

test('leaves web links and modified clicks alone', () => {
  const harness = makeHarness();
  const web = harness.click(element({ tag: 'a', href: 'https://example.com/data/' }));
  const modified = harness.click(
    element({ tag: 'a', href: 'dsh-resource://file/session/ses_abc/data' }),
    { ctrlKey: true },
  );
  assert.equal(web.prevented, false);
  assert.equal(modified.prevented, false);
  assert.equal(harness.opens.length, 0);
  harness.dispose();
});

test('leaves a file link without a trailing separator to the preview', () => {
  const harness = makeHarness();
  const event = harness.click(folderButton('src/index.ts'));
  assert.equal(event.prevented, false);
  assert.equal(harness.opens.length, 0);
  harness.dispose();
});

test('ignores folder-looking titles on elements that are not file links', () => {
  const harness = makeHarness();
  const event = harness.click(element({ tag: 'DIV', title: 'some/folder/' }));
  assert.equal(event.prevented, false);
  assert.equal(harness.opens.length, 0);
  harness.dispose();
});

test('opens a trailing-slash file URL folder', () => {
  const harness = makeHarness();
  harness.click(element({ tag: 'a', href: 'file:///D:/Documents/Projects/dsh-plugins/' }));
  assert.deepEqual(JSON.parse(JSON.stringify(harness.opens.map((o) => o.body))), [
    { path: 'D:/Documents/Projects/dsh-plugins/' },
  ]);
  harness.dispose();
});

test('logs a failed Host call instead of throwing into the page', async () => {
  const harness = makeHarness({ failFetch: true });
  const event = harness.click(folderButton());
  await settle();
  assert.equal(event.prevented, true, 'the gesture is still claimed');
  assert.equal(harness.errors.length, 1);
  assert.match(harness.errors[0], /Could not open folder/);
  harness.dispose();
});
