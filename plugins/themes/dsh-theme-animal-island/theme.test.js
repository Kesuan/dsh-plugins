import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./client.js', import.meta.url), 'utf8');
const packageId = '@local/dsh-theme-animal-island';

// Exercise the real client entry at its service boundary. No DOM or React renderer.
function activate({ desktop = true, stored = 'mint', shape = null, storageFails = false } = {}) {
  let plugin;
  const registrations = [];
  const cleanups = [];
  const layers = new Map();
  const writes = [];
  let reads = 0;
  let generation = 0;
  const storage = {
    getItem(key) { reads++; if (storageFails) throw Error('unavailable'); return key.endsWith('.shape') ? shape : stored; },
    setItem(key, value) { writes.push([key, value]); if (storageFails) throw Error('unavailable'); },
  };
  const window = {
    ...(desktop ? { dshDesktop: {} } : {}),
    navigator: { userAgent: desktop ? 'DSH Electron' : 'Browser' },
    localStorage: storage,
    __ModuleLoader__: { load(entry) { plugin = entry.factory((name) => {
      assert.equal(name, 'react');
      return {
        createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
        useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
        useId: () => 'test-id',
      };
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

function channels(hex) {
  assert.match(hex, /^#[\da-f]{6}(?:[\da-f]{2})?$/i);
  const values = hex.slice(1).match(/../g).map((v) => parseInt(v, 16));
  return { r: values[0], g: values[1], b: values[2], a: values[3] === undefined ? 1 : values[3] / 255 };
}
function luminance(hex) {
  const { r, g, b } = channels(hex);
  const values = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
function composite(hex, base) {
  const foreground = channels(hex);
  const background = channels(base);
  const channel = (fg, bg) => Math.round(fg * foreground.a + bg * (1 - foreground.a));
  return `#${[channel(foreground.r, background.r), channel(foreground.g, background.g),
    channel(foreground.b, background.b)].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
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
      'state-success-primary', 'state-warn-primary', 'state-error-primary'];
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
    (name.startsWith('--dsw-alias-label-') && !name.includes('deep-diving')));
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

test('light accent consumers follow every accent, not just buttons and links', () => {
  const reference = activate();
  const lightConsumers = [
    '--dsw-static-deepseek-50',
    '--dsw-static-deepseek-100',
    '--dsw-static-deepseek-200',
    '--dsw-static-deepseek-500',
    '--dsw-alias-bg-document-selection',
    '--dsw-alias-interactive-bg-active',
    '--dsw-specific-sidebar-nav-item-active',
    '--dsw-alias-label-deep-diving',
  ];
  for (const stored of accents) {
    if (stored === 'mint') continue;
    const app = activate({ stored });
    for (const name of lightConsumers) {
      assert.notEqual(app.tokens[name].light, reference.tokens[name].light,
        `${stored} must repaint ${name}`);
    }
    app.dispose();
  }
  reference.dispose();
});

test('dark popovers, menus and toasts sit above layer 3', () => {
  const app = activate();
  const t = app.tokens;
  const layer3 = luminance(t['--dsw-alias-bg-layer-3'].dark);
  for (const name of ['--dsw-alias-bg-overlay', '--dsw-menu-surface-fill',
    '--dsw-alias-toast-bg', '--dsw-alias-tooltip-bg']) {
    assert.ok(luminance(t[name].dark) > layer3, `${name} must be elevated above layer 3`);
  }
  assert.equal(t['--dsw-alias-bg-overlay'].dark, '#4d4c47');
  app.dispose();
});

test('desktop lifecycle registers existing slots and removes every owned registration and layer', () => {
  const app = activate();
  assert.deepEqual(app.registrations.map((r) => r.options.id), ['animal-island-skin', 'animal-island-accent']);
  assert.equal(app.layers.size, 1);
  app.dispose();
  assert.equal(app.layers.size, 0);
  assert.equal(app.registrations.length, 0);
});

test('contour choices preserve the default and update and persist independently', () => {
  const app = activate({ stored: 'sky' });
  assert.equal(app.tokens['--dsw-radius-md'].light, '14px');
  const row = app.registrations.find((entry) => entry.options.id === 'animal-island-accent');
  const tree = row.component({ t: (key) => key });
  const visit = (node) => node && typeof node === 'object'
    ? [node, ...node.children.flatMap(visit)] : [];
  const radios = visit(tree).filter((node) => node.type === 'input');
  assert.equal(radios.length, 11);
  radios.find((node) => node.props.value === 'round').props.onChange();
  assert.equal(app.tokens['--dsw-radius-md'].light, '18px');
  assert.equal(app.tokens['--dsw-alias-brand-primary'].light, '#4e63cf');
  assert.deepEqual(app.writes.at(-1), ['dsh-animal-island.shape', 'round']);
  app.dispose();
  assert.equal(app.layers.size, 0);
  const restored = activate({ shape: 'soft' });
  assert.equal(restored.tokens['--dsw-radius-panel'].dark, '24px');
  restored.dispose();
  const invalid = activate({ shape: '__proto__' });
  assert.equal(invalid.tokens['--dsw-radius-md'].dark, '18px');
  invalid.dispose();
  const inaccessible = activate({ storageFails: true });
  const unavailableRow = inaccessible.registrations.find((entry) => entry.options.id === 'animal-island-accent');
  const unavailableTree = unavailableRow.component({ t: (key) => key });
  visit(unavailableTree).find((node) => node.type === 'input' && node.props.value === 'soft').props.onChange();
  assert.equal(inaccessible.tokens['--dsw-radius-md'].light, '12px');
  inaccessible.dispose();
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

test('toolbar fills stay translucent and readable as button backgrounds', () => {
  const app = activate();
  const t = app.tokens;
  for (const scheme of ['light', 'dark']) {
    const ink = t['--dsw-alias-label-primary'][scheme];
    const surfaces = ['bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-layer-3'];
    for (const name of ['button-tool-bar-fill', 'button-tool-bar-fill-invisible', 'button-tool-bar-hover']) {
      const fill = t[`--dsw-alias-${name}`][scheme];
      assert.match(fill, /^#[\da-f]{8}$/i, `${scheme}/${name}: expected an alpha fill`);
      const alpha = channels(fill).a;
      assert.ok(alpha > 0 && alpha < .2, `${scheme}/${name}: alpha ${alpha}`);
      for (const surface of surfaces) {
        const ratio = contrast(ink, composite(fill, t[`--dsw-alias-${surface}`][scheme]));
        assert.ok(ratio >= 4.5, `${scheme}/${name}/${surface}: ${ratio.toFixed(2)}:1`);
      }
    }
  }
  app.dispose();
});

test('focus ring and settings-row ink stay legible in both schemes', () => {
  const app = activate();
  const t = app.tokens;
  assert.equal(t['--dsw-focus-ring-color'].light, '#9a6f00');
  for (const scheme of ['light', 'dark']) {
    for (const surface of ['bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-layer-3']) {
      const ratio = contrast(t['--dsw-focus-ring-color'][scheme], t[`--dsw-alias-${surface}`][scheme]);
      assert.ok(ratio >= 3, `${scheme}/focus/${surface}: ${ratio.toFixed(2)}:1`);
    }
    for (const token of ['--aia-current', '--aia-hint']) {
      for (const surface of ['bg-base', 'bg-layer-1']) {
        const ratio = contrast(t[token][scheme], t[`--dsw-alias-${surface}`][scheme]);
        assert.ok(ratio >= 4.5, `${scheme}/${token}/${surface}: ${ratio.toFixed(2)}:1`);
      }
    }
  }
  app.dispose();
});

test('island syntax colours keep 4.5:1 on the code-block surface', () => {
  const app = activate();
  const t = app.tokens;
  const syntax = ['constant', 'string', 'comment', 'keyword', 'parameter', 'function',
    'string-expression', 'punctuation', 'link'];
  for (const scheme of ['light', 'dark']) {
    const background = t[`--dsw-static-neutral-bluish-${scheme === 'light' ? '50' : '900'}`][scheme];
    for (const token of syntax) {
      const ratio = contrast(t[`--shiki-token-${token}`][scheme], background);
      assert.ok(ratio >= 4.5, `${scheme}/shiki-${token}: ${ratio.toFixed(2)}:1`);
    }
  }
  app.dispose();
});
