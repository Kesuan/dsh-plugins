import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./client.js', import.meta.url), 'utf8');
const packageId = '@local/dsh-theme-jellyfish';

// Exercise the real client entry at its service boundary. No DOM or React renderer.
function activate({ desktop = true, stored = 'jelee', shape = null, storageFails = false,
  legacyAccent = null, legacyShape = null, appearance = null, motion = null, reduced = false, hostAppearance = 'dark', restoreAppearance = null } = {}) {
  let plugin;
  const registrations = [];
  const cleanups = [];
  const layers = new Map();
  const writes = [];
  let reads = 0;
  let generation = 0;
  const saved = new Map([
    ['dsh-theme-jellyfish.hostAppearance', restoreAppearance],
    ['dsh-theme-jellyfish.appearance', appearance],
    ['dsh-theme-jellyfish.motion', motion],
    ['dsh-theme-jellyfish.accent', stored],
    ['dsh-theme-jellyfish.shape', shape],
    ['animal-island-stationery-preview.accent', legacyAccent],
    ['animal-island-stationery-preview.shape', legacyShape],
  ]);
  const disposedLayers = [];
  const storage = {
    removeItem(key) { if(storageFails)throw Error("unavailable");saved.delete(key); },
    getItem(key) { reads++; if (storageFails) throw Error('unavailable'); return saved.get(key) ?? null; },
    setItem(key, value) {
      writes.push([key, value]);
      if (storageFails) throw Error('unavailable');
      saved.set(key, value);
    },
  };
  const events = { window: new Map(), media: new Map(), document: new Map(), theme: new Map() };
  const target = (map) => ({ addEventListener: (event, fn) => map.set(event, fn), removeEventListener: (event, fn) => { if(map.get(event)===fn)map.delete(event); } });
  const media = { matches: reduced, ...target(events.media) };
  const document = { hidden: false, ...target(events.document) };
  const window = {
    ...target(events.window), matchMedia: () => media,
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
  vm.runInNewContext(source, { window, document, console: { log() {} } });
  assert.equal(reads, 0, 'module factory must not read browser preferences');
  const themeWrites = [];
  let snapshot = { preference: hostAppearance, active: { colorScheme: hostAppearance === 'light' ? 'light' : 'dark' }, themes: [{id:'light'},{id:'dark'}] };
  const changeHost = (preference) => { snapshot = { ...snapshot, preference, active: {colorScheme: preference === 'light' ? 'light' : 'dark'} };events.theme.get('theme/change')?.(snapshot); };
  const context = {
    on(name,fn) {events.theme.set(name,fn);return ()=>events.theme.delete(name);},
    locale: { register: () => () => {}, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }), bind: () => (key) => key },
    theme: {
      getTheme: () => snapshot,
      setTheme(preference) { themeWrites.push(preference);changeHost(preference); },
      overrideTokens(id, tokens) {
        assert.equal(id, packageId);
        const entry = { tokens, generation: ++generation };
        layers.set(id, entry);
        return () => {
          disposedLayers.push(entry.generation);
          if (layers.get(id) === entry) layers.delete(id);
        };
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
    get reads() { return reads; },
    get generation() { return generation; },
    registrations, writes, saved, disposedLayers, events, media, document, storage, themeWrites, changeHost, getHost: () => snapshot,
    dispose() { for (const cleanup of cleanups.splice(0).reverse()) cleanup?.(); },
    layers,
  };
}

// The JELEE direction paints translucent glass over a gradient, so tokens are
// a mix of #rrggbb and rgba(). Both forms resolve to straight sRGB channels.
function channels(color) {
  if (typeof color === 'object') return color;
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(color);
  if (rgba) {
    const result = { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] };
    for (const channel of [result.r, result.g, result.b]) {
      assert.ok(Number.isFinite(channel) && channel >= 0 && channel <= 255, `invalid RGB: ${color}`);
    }
    assert.ok(Number.isFinite(result.a) && result.a >= 0 && result.a <= 1, `invalid alpha: ${color}`);
    return result;
  }
  assert.match(color, /^#[\da-f]{6}(?:[\da-f]{2})?$/i);
  const values = color.slice(1).match(/../g).map((v) => parseInt(v, 16));
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
  assert.equal(background.a, 1, 'flatten the backdrop before stacking another translucent surface');
  // Do not round channels: rounding must not turn a value just below 4.5 into a pass.
  const channel = (fg, bg) => fg * foreground.a + bg * (1 - foreground.a);
  return { r: channel(foreground.r, background.r), g: channel(foreground.g, background.g),
    b: channel(foreground.b, background.b), a: 1 };
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}


function visit(node) {
  return node && typeof node === 'object' ? [node, ...(node.children ?? []).flatMap(visit)] : [];
}
function skin(app) {
  const tree=app.registrations.find(x=>x.options.id==='jellyfish-skin').component();
  return visit(tree).find(x=>x.type==='style').children.join('');
}
function cssBlock(css, selector) {
  const start=css.indexOf(selector); assert.ok(start>=0, selector);
  const open=css.indexOf('{',start); let depth=1; let end=open+1;
  while(depth && end<css.length) {if(css[end]==='{')depth++;if(css[end]==='}')depth--;end++;}
  return css.slice(open+1,end-1);
}

test('fixed mode palette and soft contours ignore old stored options without deleting them',()=>{
  const a=activate({stored:'yoru',shape:'round'}); const b=activate({stored:'mei',shape:'classic',storageFails:true});
  assert.deepEqual(JSON.parse(JSON.stringify(a.tokens)),JSON.parse(JSON.stringify(b.tokens)));
  for(const app of [a,b]) {
    assert.equal(app.reads,3); assert.deepEqual(app.writes,[['dsh-theme-jellyfish.hostAppearance','dark']]);
    assert.equal(app.tokens['--dsw-alias-brand-primary'].light,'#7fd6ff');
    assert.equal(app.tokens['--dsw-alias-brand-primary'].dark,'#7fd6ff');
    assert.equal(app.tokens['--dsw-radius-panel'].light,'24px');
    assert.equal(app.tokens['--dsw-radius-panel'].dark,'24px');
    assert.ok(app.registrations.some(x=>x.options.id==='jellyfish-appearance'));
  }
  assert.equal(a.saved.get('dsh-theme-jellyfish.accent'),'yoru'); a.dispose();b.dispose();
});

test('one theme layer and five registrations cleanly dispose; browsers remain untouched',()=>{
  const app=activate(); assert.equal(app.layers.size,1); assert.equal(app.registrations.length,5);
  app.dispose(); assert.equal(app.layers.size,0); assert.equal(app.registrations.length,0);
  const browser=activate({desktop:false}); assert.equal(browser.tokens,undefined); assert.equal(browser.registrations.length,0);assert.equal(browser.reads,0);
});

test('all generic panel backgrounds are opaque in both modes so dialogs cannot leak chat text',()=>{
 const app=activate();
 for(const scheme of ['light','dark'])for(const name of ['bg-base','bg-layer-1','bg-layer-2','bg-layer-3','bg-overlay','bg-module-platform','toast-bg','tooltip-bg','menu-group-header-fill']) {
   const color=app.tokens['--dsw-alias-'+name][scheme]; assert.equal(channels(color).a,1,scheme+'/'+name);
 }
 for(const scheme of ['light','dark'])assert.equal(channels(app.tokens['--dsw-menu-surface-fill'][scheme]).a,1);
 const css=skin(app);
 assert.match(cssBlock(css,'\n[data-composer-card]'),/background-color:\s*var\(--dsw-alias-bg-layer-1\)/);
 app.dispose();
});

test('plugins page header drops its opaque band without hiding host controls',()=>{
  const app=activate();const css=skin(app);
  const selector='body:has(.jf-skin) [data-plugin-bar]::before';
  const start=css.indexOf(selector);assert.ok(start>=0,'scoped override exists');
  const head=css.slice(start,css.indexOf('{',start));
  assert.match(head,/body:has\(\.jf-skin\) \[data-plugin-bar\]::after/);
  assert.match(cssBlock(css,selector),/display:\s*none\s*!important/);
  assert.doesNotMatch(css,/\[data-plugin-bar\]\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(css,/data-plugin-toolbar/);
  app.dispose();
});

test('native Windows overlay and DOM titlebar share the same opaque top color token',()=>{
 const app=activate();const token=app.tokens['--dsw-specific-sidebar-fill'];
 assert.equal(token.light,'#347ccf');assert.equal(token.dark,'#347ccf');
 for(const scheme of ['light','dark'])assert.equal(channels(token[scheme]).a,1);
 const css=skin(app);
 assert.match(cssBlock(css,`body:has(.jf-skin[data-jf-appearance="purple"]) [class*='_frame'] [class*='_sidebarCol']`),/--dsw-specific-sidebar-fill:\s*transparent/);
 assert.match(cssBlock(css,`body:has(.jf-skin[data-jf-appearance="blue"]) [class*='_frame'] [class*='_sidebarCol']`),/--dsw-specific-sidebar-fill:\s*transparent/);
 assert.doesNotMatch(source,/setTitleBarOverlay|ipcRenderer|windowsAppearance/); app.dispose();
});

test('brand uses the exact requested official SVG rather than replacement text',async()=>{
 const app=activate();const row=app.registrations.find(x=>x.options.id==='jellyfish-brand-name');assert.equal(row.options.priority,-1);
 const nodes=visit(row.component());const image=nodes.find(x=>x.type==='img');assert.equal(image.props.alt,'JELEE');
 const original=await readFile(new URL('./jelee-logo.svg',import.meta.url),'utf8');
 assert.equal(Buffer.from(image.props.src.split(',')[1],'base64').toString('utf8'),original);
 assert.match(original,/viewBox="0 0 516.36 84.72"/);assert.doesNotMatch(original,/<script|<foreignObject|\son\w+=|href=/i);
 assert.equal(nodes.filter(x=>x.children?.includes('HARNESS')).length,1);assert.equal(image.props.width,108);app.dispose();
});

test('hero and sidebar jellyfish still forward host geometry and use one ink',()=>{
 const app=activate();for(const id of ['jellyfish-mark','jellyfish-hero-mark']) {
  const row=app.registrations.find(x=>x.options.id===id);const tree=row.component({size:36,className:'host-mark'});
  assert.equal(tree.props.width,36);assert.equal(tree.props.height,36);assert.equal(tree.props.className,'host-mark');
  for(const n of visit(tree))for(const k of ['fill','stroke'])if(n.props[k]!==undefined)assert.ok(['currentColor','none'].includes(n.props[k]));
 }app.dispose();
});

test('night matches sampled PROFILE anchors; light stays bright and neither central column gets a veil',()=>{
 const app=activate();const css=skin(app);
 const day=cssBlock(css,'\nbody {'),night=cssBlock(css,'body:has(.jf-skin[data-jf-appearance="blue"])');
 for(const hex of ['#9191f5','#b49df2','#d3a7f1','#ebaff0'])assert.ok(day.includes(hex));
 for(const hex of ['#347ccf','#24589e','#102d63','#000a32'])assert.ok(night.includes(hex));
 assert.match(day,/--jf-column-fill:\s*transparent/);assert.match(night,/--jf-column-fill:\s*transparent/);
 // Website-like bright canvas is an explicit aesthetic choice, not an AA claim.
 assert.ok(contrast('#ffffff','#9191f5')<4.5);app.dispose();
});

test('light has static shooting stars and outlined stars but no sea or fish',()=>{
 const app=activate();const css=skin(app);const light=cssBlock(css,'body:has(.jf-skin[data-jf-appearance="purple"]) {');
 assert.match(light,/--jf-floor:\s*none/);assert.match(light,/--jf-fish:\s*none/);
 const decoded=decodeURIComponent(light);assert.ok(decoded.includes('L61 35'));assert.ok(decoded.includes('M8 92L51 49M57 43'));
 assert.match(cssBlock(css,'.jf-swimmer'),/display:\s*none/);
 assert.match(cssBlock(css,'body:has(.jf-skin[data-jf-appearance="blue"]) .jf-swimmer'),/display:\s*block/);app.dispose();
});

test('bubbles and fish remain inert, deterministic and stop under reduced motion',()=>{
 const app=activate();const tree=app.registrations.find(x=>x.options.id==='jellyfish-skin').component();
 const child=visit(tree).find(x=>typeof x.type==='function');const field=child.type();
 assert.equal(field.props['aria-hidden'],true);assert.deepEqual(field,child.type());
 assert.equal(visit(field).filter(x=>x.props.className==='jf-bubble').length,52);
 assert.equal(visit(field).filter(x=>x.props.className==='jf-swimmer').length,10);
 const css=skin(app);assert.match(cssBlock(css,'.jf-atmosphere'),/pointer-events:\s*none/);
 assert.match(cssBlock(css,'@media (prefers-reduced-motion: reduce)'),/animation:\s*none/);
 assert.match(cssBlock(css,'@media (forced-colors: active)'),/\.jf-atmosphere\s*\{\s*display:\s*none/);
 assert.doesNotMatch(source,/setInterval|particlesJS/); app.dispose();
});

test('stable code, menu and tooltip surfaces retain 4.5:1 reading contrast',()=>{
 const app=activate();const t=app.tokens;
 for(const scheme of ['light','dark']) {
  for(const token of ['--dsw-menu-surface-fill','--dsw-alias-tooltip-bg','--dsw-alias-bg-overlay'])assert.ok(contrast(t['--dsw-alias-label-primary'][scheme],t[token][scheme])>=4.5,token);
  const bg=t['--dsw-static-neutral-bluish-'+(scheme==='light'?'50':'900')][scheme];
  for(const key of ['constant','string','comment','keyword','parameter','function','string-expression','punctuation','link'])assert.ok(contrast(t['--shiki-token-'+key][scheme],bg)>=4.5,scheme+'/'+key);
 }app.dispose();
});

test('font preferences remain default-only, all tokens are paired, gradients are valid',()=>{
 const app=activate();const t=app.tokens;
 assert.match(t['--dsh-font-family-text-default'].light,/Baloo 2/);assert.match(t['--dsh-font-family-code-default'].light,/Space Mono/);
 assert.ok(!Object.keys(t).some(x=>/font-family-(text|code)$/.test(x)));
 for(const [name,pair] of Object.entries(t))for(const scheme of ['light','dark']) {assert.equal(typeof pair[scheme],'string',name);assert.doesNotMatch(pair[scheme],/undefined|NaN|rgba\([^)]*\)00/);}
 assert.doesNotMatch(source,/data-ds-dark-theme/);app.dispose();
});


test('both mark slots use the official thin jellyfish path without eyes or PAGE TOP lettering',async()=>{
 const raw=await readFile(new URL('./jelee-jellyfish.svg',import.meta.url),'utf8');
 const expected=/<path\s[^>]*d="([^"]+)"/.exec(raw)[1].replace(/\s+/g,' ');
 const app=activate();
 for(const id of ['jellyfish-mark','jellyfish-hero-mark']) {
  const tree=app.registrations.find(x=>x.options.id===id).component({size:40,className:'host'});
  assert.equal(tree.props.viewBox,'16 16 48 48');assert.equal(tree.props.width,40);
  const nodes=visit(tree);assert.equal(nodes.filter(x=>x.type==='path').length,1);
  assert.equal(nodes.find(x=>x.type==='path').props.d,expected);
  assert.ok(!nodes.some(x=>x.type==='circle'||x.type==='text'));
 } app.dispose();
});

test('dark scenery excludes both star layers and shooting stars',()=>{
 const app=activate();const block=cssBlock(skin(app),'body:has(.jf-skin[data-jf-appearance="blue"])');
 for(const variable of ['--jf-stars','--jf-small-star','--jf-streak'])assert.ok(block.includes(variable+': none;'));
 assert.match(block,/--jf-fish:\s*url/);assert.match(block,/--jf-floor:\s*url/);app.dispose();
});


function row(app) {
 const wrapper=app.registrations.find(x=>x.options.id==='jellyfish-appearance').component();
 return wrapper.type(wrapper.props);
}
function selectLook(app,value) {visit(row(app)).find(x=>x.type==='input' && x.props.value===value).props.onChange();}
function selectMotion(app,value) {visit(row(app)).find(x=>x.type==='select').props.onChange({target:{value}});}
function marker(app) {return app.registrations.find(x=>x.options.id==='jellyfish-skin').component().props;}

test('JELEE Purple/Blue persist independently and replace only one token layer',()=>{
 const app=activate({appearance:'purple'});assert.equal(marker(app)['data-jf-appearance'],'purple');
 assert.equal(app.tokens['--dsw-specific-sidebar-fill'].dark,'#9191f5');
 selectLook(app,'blue');assert.equal(app.layers.size,1);assert.equal(marker(app)['data-jf-appearance'],'blue');
 assert.equal(app.tokens['--dsw-specific-sidebar-fill'].light,'#347ccf');
 selectLook(app,'purple');assert.equal(app.generation,3);assert.equal(app.layers.size,1);
 assert.deepEqual(app.writes.filter(([key])=>key==='dsh-theme-jellyfish.appearance'),[['dsh-theme-jellyfish.appearance','blue'],['dsh-theme-jellyfish.appearance','purple']]);
 assert.equal(app.saved.get('dsh-theme-jellyfish.accent'),'jelee');
 app.dispose();assert.equal(app.layers.size,0);
});

test('both host schemes retain the selected aliases and code roles in each JELEE appearance',()=>{
 for(const appearance of ['purple','blue']) {
  const app=activate({appearance});const t=app.tokens;
  for(const [key,pair] of Object.entries(t))if(!key.startsWith('--dsw-static-neutral'))assert.equal(pair.light,pair.dark,key);
  assert.equal(t['--dsw-static-neutral-bluish-50'].light,t['--dsw-static-neutral-bluish-900'].dark,'same code background');
  assert.equal(t['--dsw-static-neutral-bluish-900'].light,t['--dsw-static-neutral-bluish-50'].dark,'same code ink');
  for(const hostMode of ['light','dark']) {
   const bg=t['--dsw-static-neutral-bluish-'+(hostMode==='light'?'50':'900')][hostMode];
   for(const key of ['constant','string','comment','keyword','parameter','function','string-expression','punctuation','link'])assert.ok(contrast(t['--shiki-token-'+key][hostMode],bg)>=4.5,appearance+'/'+hostMode+'/'+key);
   for(const name of ['bg-base','bg-layer-1','bg-layer-2','bg-layer-3','bg-overlay','bg-module-platform'])assert.equal(channels(t['--dsw-alias-'+name][hostMode]).a,1);
  }
  app.dispose();
 }
});

test('on/system/off motion states explain reduced motion, follow visibility and release listeners',()=>{
 const app=activate({reduced:true});assert.equal(marker(app)['data-jf-paused'],'false','explicit default on plays');
 const generation=app.generation;
 selectMotion(app,'system');assert.equal(marker(app)['data-jf-paused'],'true');
 assert.ok(visit(row(app)).some(x=>x.props.role==='status' && x.children.includes('reduced')));
 app.media.matches=false;app.events.media.get('change')();assert.equal(marker(app)['data-jf-paused'],'false');
 selectMotion(app,'off');assert.equal(marker(app)['data-jf-paused'],'true');
 selectMotion(app,'on');app.document.hidden=true;app.events.document.get('visibilitychange')();assert.equal(marker(app)['data-jf-paused'],'true');
 app.document.hidden=false;app.events.document.get('visibilitychange')();assert.equal(marker(app)['data-jf-paused'],'false');
 assert.equal(app.generation,generation,'motion never restacks colour tokens');
 app.dispose();for(const map of Object.values(app.events))assert.equal(map.size,0);
});

test('invalid storage falls back; failed saves are visible; storage events synchronize only owned preferences',()=>{
 const invalid=activate({appearance:'invalid',motion:'invalid'});assert.equal(marker(invalid)['data-jf-appearance'],'blue');assert.equal(marker(invalid)['data-jf-motion'],'on');invalid.dispose();
 const failed=activate({storageFails:true});selectLook(failed,'purple');assert.equal(marker(failed)['data-jf-appearance'],'purple');assert.ok(visit(row(failed)).some(x=>x.props.role==='alert'));failed.dispose();
 const app=activate();app.saved.set('dsh-theme-jellyfish.appearance','purple');
 app.events.window.get('storage')({key:'unrelated',storageArea:app.storage});assert.equal(marker(app)['data-jf-appearance'],'blue');
 app.events.window.get('storage')({key:'dsh-theme-jellyfish.appearance',storageArea:app.storage});assert.equal(marker(app)['data-jf-appearance'],'purple');
 app.dispose();
});

test('denser scene has bounded sizes and visible speeds; purple static art stays separate',()=>{
 const app=activate();const tree=app.registrations.find(x=>x.options.id==='jellyfish-skin').component();const child=visit(tree).find(x=>typeof x.type==='function');const nodes=visit(child.type());
 const bubbles=nodes.filter(x=>x.props.className==='jf-bubble');const fish=nodes.filter(x=>x.props.className==='jf-swimmer');
 assert.equal(bubbles.length,52);assert.equal(fish.length,10);assert.equal(nodes.filter(x=>x.props.className?.startsWith('jf-star ')).length,18);assert.equal(nodes.filter(x=>x.props.className==='jf-meteor').length,4);
 for(const n of bubbles){assert.ok(parseFloat(n.props.style['--jf-duration'])<=28);assert.ok(n.props.style['--jf-opacity']>=.42);}
 assert.match(skin(app),/animation: jf-rise var\(--jf-duration\) linear infinite !important/);
 app.dispose();
});


test('forced colors can override the appearance-specific panel backgrounds',()=>{
 const app=activate();const block=cssBlock(skin(app),'@media (forced-colors: active)');
 assert.ok(block.includes('body:has(.jf-skin[data-jf-appearance]) [data-composer-card]'));
 assert.ok(block.includes('background: Canvas !important'));app.dispose();
});


test('both JELEE variants force real dark host branches and restore the previous preference on disposal',()=>{
 for(const appearance of ['purple','blue'])for(const hostAppearance of ['light','dark','system']) {
  const app=activate({appearance,hostAppearance});assert.equal(app.getHost().preference,'dark');
  assert.equal(marker(app)['data-jf-appearance'],appearance);
  assert.deepEqual(app.themeWrites,hostAppearance==='dark'?[]:['dark']);
  app.dispose();assert.equal(app.getHost().preference,hostAppearance);assert.equal(app.events.theme.size,0);
  assert.equal(app.saved.has('dsh-theme-jellyfish.hostAppearance'),false);
 }
});

test('Light/System attempts return to dark without recursion and the latest request is restored on disable',()=>{
 const app=activate({hostAppearance:'light'});
 app.changeHost('system');assert.equal(app.getHost().preference,'dark');
 app.changeHost('light');assert.equal(app.getHost().preference,'dark');
 const count=app.themeWrites.length;
 for(let i=0;i<5;i++)app.changeHost('dark');assert.equal(app.themeWrites.length,count);
 assert.equal(app.saved.get('dsh-theme-jellyfish.hostAppearance'),'light');
 selectLook(app,'purple');assert.equal(app.getHost().preference,'dark');
 app.dispose();assert.equal(app.getHost().preference,'light');
});

test('saved pre-lock preference survives reload and storage failures still allow in-memory restoration',()=>{
 const reloaded=activate({hostAppearance:'dark',restoreAppearance:'system'});reloaded.dispose();assert.equal(reloaded.getHost().preference,'system');
 const unavailable=activate({hostAppearance:'light',storageFails:true});assert.equal(unavailable.getHost().preference,'dark');unavailable.dispose();assert.equal(unavailable.getHost().preference,'light');
});


test('transcript cutout removes only the composer-width bottom region, with no painted backing',()=>{
 const start=source.indexOf('function transcriptCutout('),end=source.indexOf('function TranscriptCutout()',start);
 const cut=vm.runInNewContext('('+source.slice(start,end).trim()+')');
 const root={left:100,top:-400,width:1200,height:1800};
 assert.equal(cut(root,{left:200,right:1200,top:700}),'polygon(0 0, 100% 0, 100% 100%, 1100px 100%, 1100px 1100px, 100px 1100px, 100px 100%, 0 100%)');
 assert.equal(cut(root,{left:200,right:1200,top:1500}),'');
 assert.equal(cut(root,{left:1400,right:1500,top:700}),'');
 assert.equal(cut({left:100,top:0,width:400,height:800},{left:0,right:600,top:600}),'polygon(0 0, 100% 0, 100% 100%, 400px 100%, 400px 600px, 0px 600px, 0px 100%, 0 100%)');
 const app=activate();assert.ok(!skin(app).includes('isolation: isolate'));assert.ok(!skin(app).includes('bottom: -8px'));app.dispose();
});

test('cutout measurement batches scroll work and releases observers/listeners/queued frame',()=>{
 const start=source.indexOf('const TRANSCRIPT_SELECTOR'),end=source.indexOf('function JellyfishSkin()',start);
 let cleanup,clip='',raf,resizeCallback,mutationCallback;let disconnected=0,cancelled=0;
 const events=new Map();const centre={querySelector:()=>card};
 const card={getBoundingClientRect:()=>({left:200,right:1000,top:600,width:800})};
 const root={getBoundingClientRect:()=>({left:100,top:0,width:1000,height:900}),closest:()=>centre};
 const listen=(name,fn)=>events.set(name,fn),unlisten=(name)=>events.delete(name);
 const context={
  React:{useState:()=>['',(value)=>{clip=value;}],useLayoutEffect:(fn)=>{cleanup=fn();}},h:()=>null,
  ResizeObserver:class{constructor(fn){resizeCallback=fn;}observe(){}disconnect(){disconnected++;}},
  MutationObserver:class{constructor(fn){mutationCallback=fn;}observe(){}disconnect(){disconnected++;}},
  document:{body:{},querySelectorAll:()=>[root],addEventListener:listen,removeEventListener:unlisten},
  window:{addEventListener:listen,removeEventListener:unlisten},
  requestAnimationFrame:(fn)=>{assert.equal(raf,undefined);raf=fn;return 1;},cancelAnimationFrame:()=>{raf=undefined;cancelled++;}
 };
 vm.runInNewContext(source.slice(start,end)+';TranscriptCutout();',context);
 assert.ok(clip.includes('900px 600px'));
 mutationCallback([{target:{closest:()=>true}}]);assert.equal(raf,undefined,'own style must not cause a loop');
 events.get('scroll')();resizeCallback();assert.equal(typeof raf,'function');
 cleanup();assert.equal(events.size,0);assert.ok(disconnected>=2);assert.equal(cancelled,1);
});
