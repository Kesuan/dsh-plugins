/**
 * Claude Code palette for the DSH Web UI.
 *
 * The Theme service composes a light/dark token layer over the active built-in
 * scheme. Because every entry here carries both a light and a dark value, the
 * palette re-resolves whenever the active color scheme changes — with the
 * appearance preference on `system` that means it follows the OS appearance
 * automatically, while an explicit Light or Dark preference picks the matching
 * half.
 *
 * Two layers are provided:
 *  - the warm neutral / clay / semantic primitives that the shipped alias layer
 *    references through `var(--dsw-static-*)`, which re-colors the whole UI
 *    coherently (surfaces, text, borders, menus, code blocks, syntax chrome);
 *  - explicit alias overrides where the built-in design is deliberately flat
 *    (all light surfaces are white) or where a semantic color must differ per
 *    scheme (primary action, states, hover washes, the sidebar column).
 *
 * Anthropic anchors: Claude clay #D97757, warm paper #FAF9F5, warm charcoal
 * #191817. Claude Code terminal semantics: success #2C7A39/#4EBA65,
 * error #AB2B3F/#FF6B80, warn #966C1E/#FFC107.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-theme-claude-code',
  factory(require) {
    const SOURCE = '@local/dsh-theme-claude-code';

    /** One value for both schemes (the shipped primitive ramps are scheme-independent). */
    const both = (value) => ({ light: value, dark: value });
    /** A distinct value per scheme. */
    const split = (light, dark) => ({ light, dark });

    /** Warm neutral, replacing the shipped neutral-bluish ramp. */
    const BLUISH = {
      0: '#ffffff',
      50: '#faf9f5',
      60: '#f8f7f2',
      75: '#f4f2ec',
      100: '#f0eee6',
      150: '#eae7dd',
      200: '#e3dfd3',
      300: '#d2ccbe',
      400: '#b3ac9d',
      500: '#9a9385',
      600: '#827b6e',
      700: '#6a645a',
      750: '#575249',
      800: '#45413a',
      850: '#36332d',
      875: '#2c2a25',
      900: '#25231f',
      950: '#1c1a17',
      1000: '#141413',
    };

    /** Warm gray, replacing the shipped neutral ramp (card fills, glyphs, terminal chrome). */
    const NEUTRAL = {
      0: '#ffffff',
      50: '#fbfaf7',
      100: '#f2efe7',
      150: '#ece8de',
      200: '#e6e2d7',
      250: '#dcd7ca',
      300: '#d4cfc2',
      400: '#b1ab9e',
      500: '#978f80',
      550: '#847c6d',
      600: '#6f685a',
      700: '#565046',
      800: '#36332d',
      850: '#2c2a25',
      900: '#1c1a17',
      1000: '#141413',
    };

    /** Claude clay, replacing the shipped deepseek-blue ramp (links, info, focus, file icons). */
    const CLAY = {
      50: '#fdf4ef',
      100: '#f9e6dc',
      200: '#f3cdb9',
      300: '#e9ad91',
      400: '#dd8f6d',
      450: '#cf6b44',
      500: '#c05a32',
      600: '#a94b27',
      700: '#8f3f22',
      800: '#6d3320',
      900: '#51261a',
      950: '#3a1c14',
    };

    const TOKENS = {
      // ── Typography ────────────────────────────────────────────────────────
      // Default stacks only: an explicit choice in Settings → More font settings
      // still wins. `ui-serif` is Chromium's system UI serif (New York on macOS);
      // the trailing serif covers engines without the generic family.
      '--dsh-font-family-text-default': both(
        'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
      ),
      // Claude Code is a terminal program, so code and tool output lean monospace.
      // The Nerd Font families are installed as "JetBrainsMono NFM"; the shipped
      // stack only asks for "JetBrains Mono", which does not match them.
      '--dsh-font-family-code-default': both(
        '"JetBrainsMono NFM", "SF Mono", "JetBrains Mono", "Fira Code", Consolas, "Liberation Mono", Menlo, Courier, "PingFang SC", "Microsoft YaHei", monospace',
      ),

      // ── Warm neutral ramp ─────────────────────────────────────────────────
      '--dsw-static-neutral-bluish-00': both(BLUISH[0]),
      '--dsw-static-neutral-bluish-50': both(BLUISH[50]),
      '--dsw-static-neutral-bluish-60': both(BLUISH[60]),
      '--dsw-static-neutral-bluish-75': both(BLUISH[75]),
      '--dsw-static-neutral-bluish-100': both(BLUISH[100]),
      '--dsw-static-neutral-bluish-150': both(BLUISH[150]),
      '--dsw-static-neutral-bluish-200': both(BLUISH[200]),
      '--dsw-static-neutral-bluish-300': both(BLUISH[300]),
      '--dsw-static-neutral-bluish-400': both(BLUISH[400]),
      '--dsw-static-neutral-bluish-500': both(BLUISH[500]),
      '--dsw-static-neutral-bluish-600': both(BLUISH[600]),
      '--dsw-static-neutral-bluish-700': both(BLUISH[700]),
      '--dsw-static-neutral-bluish-750': both(BLUISH[750]),
      '--dsw-static-neutral-bluish-800': both(BLUISH[800]),
      '--dsw-static-neutral-bluish-850': both(BLUISH[850]),
      '--dsw-static-neutral-bluish-875': both(BLUISH[875]),
      '--dsw-static-neutral-bluish-900': both(BLUISH[900]),
      '--dsw-static-neutral-bluish-950': both(BLUISH[950]),
      '--dsw-static-neutral-bluish-1000': both(BLUISH[1000]),

      '--dsw-static-neutral-00': both(NEUTRAL[0]),
      '--dsw-static-neutral-50': both(NEUTRAL[50]),
      '--dsw-static-neutral-100': both(NEUTRAL[100]),
      '--dsw-static-neutral-150': both(NEUTRAL[150]),
      '--dsw-static-neutral-200': both(NEUTRAL[200]),
      '--dsw-static-neutral-250': both(NEUTRAL[250]),
      '--dsw-static-neutral-300': both(NEUTRAL[300]),
      '--dsw-static-neutral-400': both(NEUTRAL[400]),
      '--dsw-static-neutral-500': both(NEUTRAL[500]),
      '--dsw-static-neutral-550': both(NEUTRAL[550]),
      '--dsw-static-neutral-600': both(NEUTRAL[600]),
      '--dsw-static-neutral-700': both(NEUTRAL[700]),
      '--dsw-static-neutral-800': both(NEUTRAL[800]),
      '--dsw-static-neutral-850': both(NEUTRAL[850]),
      '--dsw-static-neutral-900': both(NEUTRAL[900]),
      '--dsw-static-neutral-1000': both(NEUTRAL[1000]),

      // ── Claude clay ramp (brand, links, info, focus, file icons) ──────────
      '--dsw-static-deepseek-50': both(CLAY[50]),
      '--dsw-static-deepseek-100': both(CLAY[100]),
      '--dsw-static-deepseek-200': both(CLAY[200]),
      '--dsw-static-deepseek-300': both(CLAY[300]),
      '--dsw-static-deepseek-400': both(CLAY[400]),
      '--dsw-static-deepseek-450': both(CLAY[450]),
      '--dsw-static-deepseek-500': both(CLAY[500]),
      '--dsw-static-deepseek-600': both(CLAY[600]),
      '--dsw-static-deepseek-700-delete': both(CLAY[700]),
      '--dsw-static-deepseek-800': both(CLAY[800]),
      '--dsw-static-deepseek-900': both(CLAY[900]),
      '--dsw-static-deepseek-950': both(CLAY[950]),

      // ── Claude Code terminal semantics ────────────────────────────────────
      '--dsw-static-green-100': both('#e4f2e6'),
      '--dsw-static-green-400': both('#4eba65'),
      '--dsw-static-green-500': both('#2c7a39'),
      '--dsw-static-green-500-a08': both('#2c7a3914'),
      '--dsw-static-green-500-a12': both('#4eba6529'),
      '--dsw-static-green-900': both('#1e3223'),

      '--dsw-static-red-100': both('#f9e4e6'),
      '--dsw-static-red-400': both('#ff6b80'),
      '--dsw-static-red-400-a12': both('#ff6b8029'),
      '--dsw-static-red-500': both('#d24a5a'),
      '--dsw-static-red-600': both('#ab2b3f'),
      '--dsw-static-red-600-a08': both('#ab2b3f14'),
      '--dsw-static-red-900': both('#3d1a20'),

      '--dsw-static-amber-100': both('#fbf3e1'),
      '--dsw-static-amber-400': both('#e0a83e'),
      '--dsw-static-amber-500': both('#d59a34'),
      '--dsw-static-amber-600': both('#966c1e'),
      '--dsw-static-amber-900': both('#3a2e17'),

      // ── Surfaces: warm paper by day, warm charcoal by night ───────────────
      '--dsw-alias-bg-base': split('#faf9f5', '#191817'),
      '--dsw-alias-bg-layer-1': split('#ffffff', '#22211e'),
      '--dsw-alias-bg-layer-2': split('#f4f2ec', '#2a2824'),
      '--dsw-alias-bg-layer-3': split('#eeeadf', '#312f2a'),
      '--dsw-specific-sidebar-fill': split('#f0eee6', '#1f1e1b'),

      // ── Borders: warm ink at the shipped subtle strengths ─────────────────
      '--dsw-alias-border-l1': split('#1414130f', '#f5f4ef14'),
      '--dsw-alias-border-l2': split('#1414131f', '#f5f4ef24'),
      '--dsw-alias-border-l2-darkmode-thin': split('#1414131a', '#f5f4ef0f'),
      '--dsw-alias-border-l3': split('#14141329', '#f5f4ef2e'),
      '--dsw-alias-border-l4': split('#14141333', '#f5f4ef38'),

      // ── Primary action ────────────────────────────────────────────────────
      '--dsw-alias-brand-primary': split('#c05a32', '#d97757'),
      '--dsw-alias-brand-primary-new-colorprimary-new-color': split('#c05a32', '#d97757'),
      '--dsw-alias-button-primary-hover': split('#a94b27', '#e08a6c'),
      '--dsw-alias-label-primary-bluish': split('#51261a', '#faf9f5'),
      '--dsw-alias-link': split('#a94b27', '#dd8f6d'),

      // ── Interaction washes ────────────────────────────────────────────────
      '--dsw-alias-interactive-bg-hover': split('#14141310', '#f5f4ef14'),
      '--dsw-alias-interactive-bg-active': split('#1414131a', '#f5f4ef24'),
      '--dsw-alias-interactive-bg-hover-accent': split('#c05a321f', '#d977573d'),
      '--dsw-alias-interactive-bg-hover-danger': split('#ab2b3f12', '#ff6b8024'),

      // ── State colors (Claude Code semantics) ──────────────────────────────
      '--dsw-alias-state-success-primary': split('#2c7a39', '#4eba65'),
      '--dsw-alias-state-warn-primary': split('#966c1e', '#ffc107'),
      '--dsw-alias-state-error-primary': split('#ab2b3f', '#ff6b80'),
      '--dsw-alias-state-idle-primary': split('#b3ac9d', '#6a645a'),

      // ── Menus and thinking overlays (shipped literal fills) ───────────────
      '--dsw-menu-surface-fill': split('#faf9f594', '#3a373073'),
      '--dsw-alias-menu-group-header-fill': split('#faf9f5f0', '#2a2824f0'),
      '--dsw-alias-button-tool-bar-fill': both('#4a453f80'),
      '--dsw-alias-button-tool-bar-fill-invisible': both('#241f1a5c'),
      '--dsw-alias-button-tool-bar-hover': both('#4a453f99'),
      '--dsw-linear-gradient-think': split(
        'linear-gradient(180deg, #faf9f5 20.19%, #faf9f500 100%)',
        'linear-gradient(180deg, #191817 20.19%, #19181700 100%)',
      ),
      '--dsw-linear-think-select': split(
        'linear-gradient(180deg, #f4f2ec 20.19%, #f4f2ec00 100%)',
        'linear-gradient(180deg, #2a2824 20.19%, #2a282400 100%)',
      ),
    };

    return {
      inject: ['theme'],
      apply(ctx) {
        ctx.effect(
          () => ctx.theme.overrideTokens(SOURCE, TOKENS),
          'claude-code-theme-tokens',
        );
      },
    };
  },
});
