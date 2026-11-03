import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./client.js', import.meta.url), 'utf8');
const packageId = '@local/dsh-theme-animal-island';

// Exercise the real client entry at its service boundary. No DOM or React renderer.
function activate({ desktop = true, stored = 'mint', storageFails = false } = {}) {
  let plugin;
  const registrations = [];
  const cleanups = [];
  const layers = new Map();
  const writes = [];
  let reads = 0;
  let generation = 0;
  const storage = {
    getItem() { reads++; if (storageFails) throw Error('unavailable'); return stored; },
    setItem(key, value) { writes.push([key, value]); if (storageFails) throw Error('unavailable'); },
  };
  const window = {
    ...(desktop ? { dshDesktop: {} } : {}),
    navigator: { userAgent: desktop ? 'DSH Electron' : 'Browser' },
    localStorage: storage,
    __ModuleLoader__: { load(entry) { plugin = entry.factory((name) => {
      assert.equal(name, 'react');
      return {}; // components are registered as opaque functions, never rendered here
    }); } },
  };
  vm.runInNewContext(source, { window, console: { log() {} } });
  assert.equal(reads, 0, 'module factory must not read browser preferences');
  const context = {
    locale: { register: () => () => {} },
    theme: {
      overrideTokens(id, tokens) {
        assert.equal(id, packageId);
        const entry = { tokens, generation: ++generation };
        layers.set(id, entry);
        return () => { if (layers.get(id) === entry) layers.delete(id); };
      },
    },
    slots: {
      inject(name, fn) { cleanups.push(fn()); },
      register(options, component) {
        const entry = { options, component };
        registrations.push(entry);
        return () => registrations.splice(registrations.indexOf(entry), 1);
      },
    },
    effect(fn) { cleanups.push(fn()); },
  };
  plugin.apply(context);
  return {
    get tokens() { return layers.get(packageId)?.tokens; },
    registrations, writes,
    dispose() { for (const cleanup of cleanups.reverse()) cleanup?.(); },
    layers,
  };
}

function luminance(hex) {
  assert.match(hex, /^#[\da-f]{6}$/i);
  const values = hex.slice(1).match(/../g).map((v) => {
    const channel = parseInt(v, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

const accents = ['mint', 'sky', 'blossom', 'sun', 'peach', 'grape', 'leaf', 'coral'];

test('all eight stored accents produce valid paired tokens and readable night ink', () => {
  for (const stored of accents) {
    const app = activate({ stored });
    for (const [name, pair] of Object.entries(app.tokens)) {
      assert.equal(typeof pair.light, 'string', `${stored}/${name}: light`);
      assert.equal(typeof pair.dark, 'string', `${stored}/${name}: dark`);
      assert.ok(!pair.dark.includes('undefined'), `${stored}/${name}`);
    }
    const surfaces = ['bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-layer-3', 'bg-overlay'];
    const foregrounds = ['label-primary', 'label-primary-dimmed', 'label-secondary', 'link',
      'state-success-primary', 'state-warn-primary', 'state-error-primary',
      'button-tool-bar-fill', 'button-tool-bar-fill-invisible'];
    for (const surface of surfaces) {
      for (const ink of foregrounds) {
        const ratio = contrast(app.tokens[`--dsw-alias-${ink}`].dark, app.tokens[`--dsw-alias-${surface}`].dark);
        assert.ok(ratio >= 4.5, `${stored}/${ink}/${surface}: ${ratio.toFixed(2)}:1`);
      }
    }
    assert.equal(app.writes.length, 0, 'activation must not change saved preferences');
    app.dispose();
  }
});

test('night surfaces increase in luminance, menus are opaque, and light anchors stay intact', () => {
  const app = activate();
  const t = app.tokens;
  const surfaces = [t['--dsw-specific-sidebar-fill'].dark,
    ...['bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-layer-3'].map((s) => t[`--dsw-alias-${s}`].dark)];
  for (let i = 1; i < surfaces.length; i++) assert.ok(luminance(surfaces[i]) > luminance(surfaces[i - 1]));
  assert.match(t['--dsw-menu-surface-fill'].dark, /^#[\da-f]{6}$/i);
  assert.equal(t['--dsw-alias-bg-base'].light, '#f8f8f0');
  assert.equal(t['--dsw-specific-sidebar-fill'].light, '#f2ecda');
  assert.equal(t['--dsw-alias-label-primary'].light, '#794f27');
  assert.equal(t['--dsw-focus-ring-color'].dark, '#ffcc00');
  assert.ok(!Object.keys(t).some((name) => /font.*(?:code|terminal)|static-blue/.test(name)));
  app.dispose();
});

test('changing accents keeps charcoal surfaces, neutral primitives and reading ink neutral', () => {
  const reference = activate();
  const stableNames = Object.keys(reference.tokens).filter((name) =>
    name.startsWith('--dsw-static-neutral') ||
    /^--dsw-alias-bg-(base|layer-[123]|overlay|module-platform)$/.test(name) ||
    name === '--dsw-specific-sidebar-fill' ||
    name.startsWith('--dsw-alias-label-'));
  for (const stored of accents) {
    const app = activate({ stored });
    for (const name of stableNames) {
      const color = app.tokens[name].dark;
      assert.equal(color, reference.tokens[name].dark, `${stored} must not tint ${name}`);
      const channels = color.slice(1).match(/../g).map((v) => parseInt(v, 16));
      assert.ok(Math.max(...channels) - Math.min(...channels) <= 10, `${name} must remain nearly neutral`);
    }
    if (stored !== 'mint') assert.notEqual(app.tokens['--dsw-alias-interactive-bg-active'].dark,
      reference.tokens['--dsw-alias-interactive-bg-active'].dark, 'selection should still follow the accent');
    app.dispose();
  }
  reference.dispose();
});

test('desktop lifecycle registers existing slots and removes every owned registration and layer', () => {
  const app = activate();
  assert.deepEqual(app.registrations.map((r) => r.options.id), ['animal-island-skin', 'animal-island-accent']);
  assert.equal(app.layers.size, 1);
  app.dispose();
  assert.equal(app.layers.size, 0);
  assert.equal(app.registrations.length, 0);
});

test('plain browsers receive no token layer, settings row, or preference writes', () => {
  const app = activate({ desktop: false });
  assert.equal(app.layers.size, 0);
  assert.equal(app.registrations.length, 0);
  assert.equal(app.writes.length, 0);
});

test('invalid or inaccessible accent storage safely uses mint', () => {
  for (const options of [{ stored: 'unknown' }, { storageFails: true }]) {
    const app = activate(options);
    assert.equal(app.tokens['--dsw-alias-brand-primary'].dark, '#8bd5ba');
    app.dispose();
  }
});
