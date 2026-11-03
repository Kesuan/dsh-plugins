/**
 * Client half of the Godot Debug bundle.
 *
 * This bundle is a right-Sidebar Web preview, not a global work panel:
 * - `conversation.session.header.actions` contributes a small entry that is
 *   visible only when the current Session's working directory belongs to a
 *   Godot project.
 * - `sidebarRightTabs` declares one page type whose body embeds the debug Web
 *   export in an iframe.
 * - `sidebar.right.pane.tab` renders that page, with build/rebuild controls and
 *   a compact browser-console panel.
 */
window.__ModuleLoader__.load({
	id: '@local/dsh-godot-debug',
	factory(require) {
		const React = require('react');
		const h = React.createElement;

		const NS = 'godotPreview';
		const TAB_ID = '@local/dsh-godot-debug/preview';
		const TAB_KIND = 'godotPreview';
		const MAX_RENDER_LINES = 500;
		const MAX_LOG_CHARS = 200_000;

		const en = {
			tabTitle: 'Godot Preview',
			headerAction: 'Godot Preview',
			openPreview: 'Open Godot Web preview',
			guideDescription: 'Preview this Session’s Godot project in the right Sidebar.',
			checkingProject: 'Checking the Session project…',
			notGodot: 'This Session is not a Godot project.',
			notGodotHint: 'Open a Session whose working directory contains project.godot to use the preview.',
			projectUnavailable: 'The Session project is unavailable.',
			project: 'Project',
			building: 'Building Web preview…',
			buildingHint: 'Compiling the debug Web export. This usually takes a few seconds.',
			ready: 'Live preview',
			buildFailed: 'Web build failed',
			rebuild: 'Rebuild',
			retry: 'Retry',
			openExternal: 'Open in browser',
			console: 'Console',
			problemsOnly: 'Problems only',
			allOutput: 'All output',
			emptyLogs: 'No console output yet.',
			errors: '{count} errors',
			warnings: '{count} warnings',
			hideConsole: 'Collapse console',
			showConsole: 'Expand console',
			connectionError: 'Preview unavailable: {message}',
			logUnavailable: 'Console unavailable: {message}',
			genericError: 'Action failed: {message}',
			projectChanged: 'The Session project changed. Rebuilding…',
			startedAt: 'Building…',
		};

		const zh = {
			tabTitle: 'Godot 预览',
			headerAction: 'Godot 预览',
			openPreview: '打开 Godot Web 预览',
			guideDescription: '在右侧侧边栏预览当前会话的 Godot 项目。',
			checkingProject: '正在检查当前会话的项目…',
			notGodot: '当前会话不是 Godot 项目。',
			notGodotHint: '请打开一个工作目录包含 project.godot 的会话。',
			projectUnavailable: '当前会话的项目不可用。',
			project: '项目',
			building: '正在构建 Web 预览…',
			buildingHint: '正在编译调试版 Web 导出，通常需要几秒钟。',
			ready: '实时预览',
			buildFailed: 'Web 构建失败',
			rebuild: '重新构建',
			retry: '重试',
			openExternal: '在浏览器打开',
			console: '控制台',
			problemsOnly: '只看问题',
			allOutput: '全部输出',
			emptyLogs: '暂无控制台输出。',
			errors: '{count} 个错误',
			warnings: '{count} 个警告',
			hideConsole: '收起控制台',
			showConsole: '展开控制台',
			connectionError: '预览不可用：{message}',
			logUnavailable: '无法读取控制台：{message}',
			genericError: '操作失败：{message}',
			projectChanged: '会话项目已变化，正在重新构建…',
			startedAt: '正在构建…',
		};

		/** Build a sidebar-sized game-controller glyph. */
		function ControllerGlyph({ size = 18 }) {
			return h(
				'svg',
				{
					viewBox: '0 0 24 24',
					width: size,
					height: size,
					fill: 'none',
					stroke: 'currentColor',
					strokeWidth: 1.7,
					strokeLinecap: 'round',
					strokeLinejoin: 'round',
					'aria-hidden': true,
					style: { display: 'block', flex: '0 0 auto' },
				},
				h('path', {
					d: 'M7.2 7.2h9.6c2.4 0 4.3 2 4.3 4.5v3.1c0 1.8-1.4 3.2-3.2 3.2-1 0-1.9-.5-2.5-1.3l-.8-1.1H9.4l-.8 1.1c-.6.8-1.5 1.3-2.5 1.3-1.8 0-3.2-1.4-3.2-3.2v-3.1c0-2.5 1.9-4.5 4.3-4.5Z',
				}),
				h('path', { d: 'M8 10v4M6 12h4' }),
				h('circle', { cx: 16.3, cy: 11.1, r: 0.9, fill: 'currentColor', stroke: 'none' }),
				h('circle', { cx: 18.2, cy: 13, r: 0.9, fill: 'currentColor', stroke: 'none' }),
			);
		}

		/** Classify console lines for filtering and counters. */
		function lineKind(line) {
			if (/\b(script error|user error|assertion failed|error)\b/i.test(line)) return 'error';
			if (/\b(warning|warn)\b/i.test(line)) return 'warn';
			return '';
		}

		/** Bound client-side log retention. */
		function trimEntries(entries) {
			let total = entries.reduce((sum, entry) => sum + String(entry.text ?? '').length, 0);
			let start = 0;
			while (total > MAX_LOG_CHARS && start < entries.length - 1) {
				total -= String(entries[start].text ?? '').length;
				start += 1;
			}
			return start === 0 ? entries : entries.slice(start);
		}

		/**
		 * The Host reports the project's design resolution so the preview iframe
		 * can take the game's own aspect ratio. A malformed value stays `null`
		 * and the frame fills the stage (the engine's own stretch letterboxes).
		 */
		function normalizeViewport(value) {
			const width = Number(value?.width);
			const height = Number(value?.height);
			if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
				return null;
			}
			return { width, height };
		}

		/**
		 * Detect whether one Session's working directory is inside a Godot
		 * project. The Host reads the durable Session header and walks upward to
		 * `project.godot`, so this also works for cold Sessions.
		 */
		function useProjectContext(sessionId) {
			const [context, setContext] = React.useState({ status: 'loading' });
			React.useEffect(() => {
				let disposed = false;
				let timer = 0;
				const load = async () => {
					try {
						const response = await fetch(
							`/local/godot-debug/context?sessionId=${encodeURIComponent(sessionId)}`,
							{ cache: 'no-store' },
						);
						const data = await response.json().catch(() => ({}));
						if (disposed) return;
						if (!response.ok || data.ok !== true) {
							throw new Error(data.message || `HTTP ${response.status}`);
						}
						if (data.available === true && typeof data.projectPath === 'string') {
							setContext({
								status: 'ready',
								projectPath: data.projectPath,
								projectName:
									typeof data.projectName === 'string' && data.projectName !== ''
										? data.projectName
										: data.projectPath.split('/').filter(Boolean).at(-1) || 'Godot',
								viewport: normalizeViewport(data.viewport),
							});
						} else {
							setContext({ status: 'unavailable', reason: data.reason });
						}
						timer = window.setTimeout(load, 8_000);
					} catch (reason) {
						if (disposed) return;
						setContext((current) =>
							current.status === 'ready'
								? current
								: { status: 'error', message: reason instanceof Error ? reason.message : String(reason) },
						);
						timer = window.setTimeout(load, 8_000);
					}
				};
				void load();
				return () => {
					disposed = true;
					window.clearTimeout(timer);
				};
			}, [sessionId]);
			return context;
		}

		/** Follow one Web build's browser-console entries. */
		function useWebLogs(web) {
			const [entries, setEntries] = React.useState([]);
			const [error, setError] = React.useState(null);
			const buildIdRef = React.useRef('');
			const cursorRef = React.useRef(0);

			React.useEffect(() => {
				const buildId = typeof web?.buildId === 'string' ? web.buildId : '';
				if (buildId === '') {
					buildIdRef.current = '';
					cursorRef.current = 0;
					setEntries([]);
					setError(null);
					return;
				}
				if (buildIdRef.current !== buildId) {
					buildIdRef.current = buildId;
					cursorRef.current = 0;
					setEntries([]);
					setError(null);
				}
				let disposed = false;
				let timer = 0;
				const tick = async () => {
					try {
						const url = new URL('/local/godot-web/logs', window.location.href);
						url.searchParams.set('buildId', buildId);
						if (cursorRef.current > 0) url.searchParams.set('after', String(cursorRef.current));
						const response = await fetch(url, { cache: 'no-store' });
						const data = await response.json().catch(() => ({}));
						if (disposed) return;
						if (!response.ok || data.ok !== true) {
							throw new Error(data.error || `HTTP ${response.status}`);
						}
						const next = Array.isArray(data.logs) ? data.logs : [];
						if (next.length > 0) setEntries((current) => trimEntries([...current, ...next]));
						if (typeof data.cursor === 'number') cursorRef.current = data.cursor;
						setError(null);
						timer = window.setTimeout(tick, 800);
					} catch (reason) {
						if (disposed) return;
						setError(reason instanceof Error ? reason.message : String(reason));
						timer = window.setTimeout(tick, 2_000);
					}
				};
				void tick();
				return () => {
					disposed = true;
					window.clearTimeout(timer);
				};
			}, [web?.buildId]);

			return { entries, error };
		}

		/**
		 * Keep the current Web build in sync with one project. An existing ready
		 * build for the same path is reused; otherwise this starts a build
		 * automatically. Explicit rebuilds use the same path.
		 */
		function useWebPreview(projectPath) {
			const [web, setWeb] = React.useState(null);
			const [building, setBuilding] = React.useState(false);
			const [error, setError] = React.useState(null);
			const generationRef = React.useRef(0);

			const build = React.useCallback(async () => {
				if (typeof projectPath !== 'string' || projectPath === '') return;
				const generation = ++generationRef.current;
				setBuilding(true);
				setError(null);
				try {
					const response = await fetch('/local/godot-web/build', {
						method: 'POST',
						headers: {
							'content-type': 'application/json',
							'x-dsh-godot-debug': '1',
						},
						body: JSON.stringify({ projectPath }),
					});
					const data = await response.json().catch(() => ({}));
					if (generation !== generationRef.current) return;
					if (!response.ok || data.ok !== true) {
						throw new Error(data.message || `HTTP ${response.status}`);
					}
					setWeb(data.web);
				} catch (reason) {
					if (generation !== generationRef.current) return;
					setError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					if (generation === generationRef.current) setBuilding(false);
				}
			}, [projectPath]);

			React.useEffect(() => {
				let disposed = false;
				const generation = ++generationRef.current;
				setWeb(null);
				setError(null);
				setBuilding(false);
				if (typeof projectPath !== 'string' || projectPath === '') return;
				const readState = async () => {
					const response = await fetch('/local/godot-web/state', { cache: 'no-store' });
					return response.json().catch(() => ({}));
				};
				const waitForExistingBuild = async () => {
					for (let attempt = 0; attempt < 45; attempt += 1) {
						await new Promise((resolve) => window.setTimeout(resolve, 1_000));
						if (disposed || generation !== generationRef.current) return;
						const data = await readState();
						if (data.web?.status === 'ready' && data.web.projectPath === projectPath && typeof data.web.url === 'string') {
							setWeb(data.web);
							return;
						}
						if (data.web?.status === 'failed') {
							setError(data.web.error || 'Web build failed');
							return;
						}
					}
					if (!disposed && generation === generationRef.current) setError('Web build timed out');
				};
				const openLatest = async () => {
					try {
						const data = await readState();
						if (disposed || generation !== generationRef.current) return;
						if (data.ok === true && data.web?.projectPath === projectPath) {
							if (data.web.status === 'ready' && typeof data.web.url === 'string') {
								setWeb(data.web);
								return;
							}
							if (data.web.status === 'building') {
								await waitForExistingBuild();
								return;
							}
						}
					} catch {
						// Fall through to a build.
					}
					if (!disposed && generation === generationRef.current) void build();
				};
				void openLatest();
				return () => {
					disposed = true;
				};
			}, [projectPath, build]);

			return { web, building, error, rebuild: build };
		}

		/** The header action: visible only when this Session's cwd is a Godot project. */
		function GodotPreviewAction({ sessionId, openPreview, t }) {
			const context = useProjectContext(sessionId);
			if (context.status !== 'ready') return null;
			return h(
				React.Fragment,
				null,
				h('style', null, STYLES),
				h(
					'button',
					{
						type: 'button',
						className: 'gp-header-action',
						title: t('openPreview'),
						'aria-label': t('openPreview'),
						onClick: openPreview,
					},
					h(ControllerGlyph, { size: 14 }),
					h('span', { className: 'gp-header-action-label' }, t('headerAction')),
				),
			);
		}

		/** One centered state body for loading, unavailable, and error cases. */
		function StateBody({ title, detail, actionLabel, onAction }) {
			return h(
				'div',
				{ className: 'gp-state', role: 'status' },
				h(ControllerGlyph, { size: 30 }),
				h('strong', null, title),
				detail ? h('span', null, detail) : null,
				actionLabel && onAction
					? h('button', { type: 'button', className: 'gp-button gp-button-primary', onClick: onAction }, actionLabel)
					: null,
			);
		}

		/**
		 * One guide card in the right Sidebar. It renders only for sessions that
		 * resolve to a Godot project; other sessions leave the cell empty.
		 */
		function GodotGuideEntry({ sessionId, useTabInfo, t }) {
			const context = useProjectContext(sessionId);
			const { tab } = useTabInfo();
			if (context.status !== 'ready') return null;
			return h(
				React.Fragment,
				null,
				h('style', null, STYLES),
				h(
					'button',
					{
						type: 'button',
						className: 'gp-guide-entry',
						onClick: () => tab.actions.openTab(TAB_KIND, { replaceTab: true }),
					},
					h('span', { className: 'gp-guide-icon' }, h(ControllerGlyph, { size: 22 })),
					h(
						'span',
						{ className: 'gp-guide-text' },
						h('strong', null, t('tabTitle')),
						h('span', null, t('guideDescription')),
					),
				),
			);
		}

		/**
		 * The right-Sidebar page. It resolves its project from the owning Session
		 * (not from navigation parameters), so a restored tab still works.
		 */
		function GodotPreviewTab({ sessionId, t }) {
			const context = useProjectContext(sessionId);
			const preview = useWebPreview(context.status === 'ready' ? context.projectPath : null);
			const logs = useWebLogs(preview.web);
			const [logsOpen, setLogsOpen] = React.useState(true);
			const [problemsOnly, setProblemsOnly] = React.useState(false);
			const consoleRef = React.useRef(null);

			const text = React.useMemo(
				() => logs.entries.map((entry) => String(entry.text ?? '')).join(''),
				[logs.entries],
			);
			const lines = React.useMemo(() => text.replace(/\r/g, '').split('\n'), [text]);
			const errorCount = React.useMemo(
				() => lines.reduce((count, line) => count + (lineKind(line) === 'error' ? 1 : 0), 0),
				[lines],
			);
			const warningCount = React.useMemo(
				() => lines.reduce((count, line) => count + (lineKind(line) === 'warn' ? 1 : 0), 0),
				[lines],
			);
			const visibleLines = React.useMemo(() => {
				const filtered = problemsOnly ? lines.filter((line) => lineKind(line) !== '') : lines;
				return filtered.slice(-MAX_RENDER_LINES);
			}, [lines, problemsOnly]);

			const followOutput = React.useCallback(() => {
				const node = consoleRef.current;
				if (node !== null) node.scrollTop = node.scrollHeight;
			}, []);
			React.useEffect(() => {
				followOutput();
			}, [logs.entries, followOutput, problemsOnly]);

			if (context.status === 'loading') {
				return h(
					React.Fragment,
					null,
					h('style', null, STYLES),
					h('div', { className: 'gp-root' }, h(StateBody, { title: t('checkingProject') })),
				);
			}
			if (context.status === 'unavailable' || context.status === 'error') {
				return h(
					React.Fragment,
					null,
					h('style', null, STYLES),
					h(
						'div',
						{ className: 'gp-root' },
						h(StateBody, {
							title: context.status === 'error' ? t('projectUnavailable') : t('notGodot'),
							detail: context.status === 'error' ? t('connectionError', { message: context.message }) : t('notGodotHint'),
						}),
					),
				);
			}

			const busy = preview.building;
			const web = preview.web;
			const viewport = context.viewport ?? null;
			const stage = busy
				? h(
						'div',
						{ className: 'gp-state gp-state-build' },
						h(ControllerGlyph, { size: 30 }),
						h('strong', null, t('building')),
						h('span', null, t('buildingHint')),
					)
				: preview.error !== null
					? h(StateBody, {
							title: t('buildFailed'),
							detail: preview.error,
							actionLabel: t('retry'),
							onAction: () => void preview.rebuild(),
						})
					: web !== null && typeof web.url === 'string'
						? h('iframe', {
								className: 'gp-frame',
								'data-ratio': viewport === null ? undefined : '',
								style:
									viewport === null
										? undefined
										: {
												'--gp-w': String(viewport.width),
												'--gp-h': String(viewport.height),
												aspectRatio: `${viewport.width} / ${viewport.height}`,
											},
								src: web.url,
								title: t('tabTitle'),
								allow: 'autoplay; fullscreen; gamepad',
								sandbox: 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads',
								referrerPolicy: 'no-referrer',
							})
						: h(StateBody, { title: t('projectUnavailable'), detail: t('notGodotHint') });

			return h(
				'div',
				{ className: 'gp-root' },
				h('style', null, STYLES),
				h(
					'div',
					{ className: 'gp-head' },
					h(
						'div',
						{ className: 'gp-heading' },
						h('span', { className: 'gp-glyph' }, h(ControllerGlyph, { size: 18 })),
						h(
							'div',
							{ className: 'gp-heading-text' },
							h('strong', { title: context.projectName }, context.projectName),
							h('code', { title: context.projectPath }, context.projectPath),
						),
					),
					h(
						'div',
						{ className: 'gp-head-actions' },
						h(
							'button',
							{
								type: 'button',
								className: 'gp-button',
								disabled: busy,
								onClick: () => void preview.rebuild(),
							},
							t('rebuild'),
						),
						h(
							'button',
							{
								type: 'button',
								className: 'gp-button',
								disabled: web === null || typeof web.url !== 'string',
								onClick: () => {
									if (web !== null && typeof web.url === 'string') window.open(web.url, '_blank', 'noopener');
								},
							},
							t('openExternal'),
						),
					),
				),
				h('div', { className: 'gp-stage' }, stage),
				h(
					'div',
					{ className: `gp-console${logsOpen ? ' gp-console-open' : ''}` },
					h(
						'div',
						{ className: 'gp-console-head' },
						h(
							'button',
							{
								type: 'button',
								className: 'gp-console-toggle',
								'aria-expanded': logsOpen,
								onClick: () => setLogsOpen((open) => !open),
							},
							t(logsOpen ? 'hideConsole' : 'showConsole'),
						),
						errorCount > 0 ? h('span', { className: 'gp-count gp-count-error' }, t('errors', { count: String(errorCount) })) : null,
						warningCount > 0
							? h('span', { className: 'gp-count gp-count-warn' }, t('warnings', { count: String(warningCount) }))
							: null,
						h(
							'button',
							{
								type: 'button',
								className: `gp-text-button${problemsOnly ? ' gp-text-button-active' : ''}`,
								'aria-pressed': problemsOnly,
								onClick: () => setProblemsOnly((value) => !value),
							},
							t(problemsOnly ? 'problemsOnly' : 'allOutput'),
						),
					),
					logs.error === null ? null : h('p', { className: 'gp-inline-error' }, t('logUnavailable', { message: logs.error })),
					logsOpen
						? h(
								'div',
								{ ref: consoleRef, className: 'gp-console-body', role: 'log' },
								text === ''
									? h('div', { className: 'gp-console-empty' }, t('emptyLogs'))
									: visibleLines.map((line, index) =>
											h(
												'div',
												{
													key: `${index}-${line.slice(0, 16)}`,
													className: `gp-line${lineKind(line) === '' ? '' : ` gp-line-${lineKind(line)}`}`,
												},
												line === '' ? '\u00a0' : line,
											),
										),
							)
						: null,
				),
			);
		}

		const STYLES = `
.gp-root {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsh-font-family-text-default, inherit);
  font-size: 12px;
}
.gp-header-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 26px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}
.gp-header-action:hover { background: var(--dsw-alias-interactive-bg-hover); }
.gp-header-action:focus-visible { outline: none; box-shadow: 0 0 0 var(--dsw-focus-ring-width) var(--dsw-focus-ring-color); }
.gp-guide-entry {
  display: flex;
  align-items: center;
  gap: 14px;
  box-sizing: border-box;
  width: 380px;
  max-width: 100%;
  min-height: 56px;
  padding: 14px 20px;
  border: .5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-xl);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.gp-guide-entry:hover { background: var(--dsw-alias-interactive-bg-hover); }
.gp-guide-entry:focus-visible { outline: none; box-shadow: 0 0 0 var(--dsw-focus-ring-width) var(--dsw-focus-ring-color); }
.gp-guide-icon { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; flex: 0 0 auto; color: var(--dsw-alias-label-secondary); }
.gp-guide-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.gp-guide-text strong { font-size: 14px; font-weight: 500; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp-guide-text span { color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
  min-height: 44px;
  padding: 6px 9px 6px 11px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.gp-heading { display: flex; align-items: center; gap: 8px; min-width: 0; }
.gp-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  flex: 0 0 auto;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-brand-primary);
}
.gp-heading-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.gp-heading-text strong { font-size: 12px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp-heading-text code { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9.5px; }
.gp-head-actions { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; }
.gp-button {
  min-height: 26px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 10.5px;
  white-space: nowrap;
  cursor: pointer;
}
.gp-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.gp-button:focus-visible { outline: none; box-shadow: 0 0 0 var(--dsw-focus-ring-width) var(--dsw-focus-ring-color); }
.gp-button:disabled { opacity: .45; cursor: default; }
.gp-button-primary { border-color: transparent; background: var(--dsw-alias-brand-primary); color: var(--dsw-static-neutral-00); }
.gp-stage { display: flex; flex: 1 1 auto; align-items: center; justify-content: center; min-height: 0; overflow: hidden; background: var(--dsw-static-neutral-1000); }
.gp-frame { display: block; width: 100%; height: 100%; border: 0; background: var(--dsw-static-neutral-1000); }
/* Give the iframe the game's authored aspect ratio. The engine sizes the Web
   canvas from the iframe, and stretch/aspect=expand makes the viewport follow
   the canvas, so a frame that matches the design resolution keeps the level's
   framing exact: no letterbox bars, no stretched lens. The min() picks the
   largest frame that still fits when the Sidebar is narrower than the game. */
@supports (width: 1cqw) {
  .gp-stage { container-type: size; }
  .gp-frame[data-ratio] {
    width: min(100cqw, calc(100cqh * var(--gp-w) / var(--gp-h)));
    height: auto;
    max-width: 100%;
    max-height: 100%;
  }
}
.gp-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  min-height: 0;
  padding: 24px 18px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
  line-height: 1.55;
  text-align: center;
}
.gp-state strong { color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 650; }
.gp-state span { max-width: 300px; }
.gp-state-build { background: var(--dsw-alias-bg-layer-1); }
.gp-console {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  border-top: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.gp-console-open { height: 170px; }
.gp-console-head {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-height: 16px;
  padding: 5px 8px 0;
  flex-wrap: wrap;
}
.gp-console-toggle {
  margin-right: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
}
.gp-console-toggle:hover { color: var(--dsw-alias-label-primary); }
.gp-count { padding: 1px 5px; border-radius: 999px; font-size: 10px; font-variant-numeric: tabular-nums; }
.gp-count-error { background: var(--dsw-alias-interactive-bg-hover-danger); color: var(--dsw-alias-state-error-primary); }
.gp-count-warn { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 13%, transparent); color: var(--dsw-alias-state-warn-primary); }
.gp-text-button {
  padding: 0 5px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
}
.gp-text-button:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.gp-text-button-active { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-active); }
.gp-inline-error { margin: 4px 8px 0; color: var(--dsw-alias-state-error-primary); font-size: 10.5px; }
.gp-console-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 6px 9px 9px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  line-height: 1.55;
}
.gp-console-empty { color: var(--dsw-alias-label-secondary); font-family: var(--dsh-font-family-text-default, inherit); }
.gp-line { white-space: pre-wrap; overflow-wrap: anywhere; }
.gp-line-error { color: var(--dsw-alias-state-error-primary); }
.gp-line-warn { color: var(--dsw-alias-state-warn-primary); }
`;

		return {
			inject: ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs'],
			apply(ctx) {
				ctx.effect(
					() => ctx.locale.register(NS, { en, zh }),
					'godot-preview: dictionaries',
				);
				const t = ctx.locale.bind(NS);

				ctx.effect(
					() =>
						ctx.sidebarRightTabs.register({
							id: TAB_ID,
							kind: TAB_KIND,
							priority: 'extension',
							keepMounted: true,
							title: () => t('tabTitle'),
							guide: [
								{
									id: 'godot-preview',
									order: 20,
									title: () => t('tabTitle'),
									description: () => t('guideDescription'),
								},
							],
						}),
					'godot-preview: right sidebar tab type',
				);

				ctx.slots.inject('sidebar.right.tab.guide.entry', () =>
					ctx.slots.register(
						{
							name: 'sidebar.right.tab.guide.entry',
							key: TAB_ID,
							locale: NS,
						},
						GodotGuideEntry,
					),
				);

				ctx.slots.inject('sidebar.right.pane.tab', () =>
					ctx.slots.register(
						{
							name: 'sidebar.right.pane.tab',
							key: TAB_ID,
							locale: NS,
						},
						GodotPreviewTab,
					),
				);

				ctx.slots.inject('conversation.session.header.actions', () =>
					ctx.slots.register(
						{
							name: 'conversation.session.header.actions',
							id: 'godot-preview',
							order: 30,
							locale: NS,
							inject: () => ({
								openPreview: () => ctx.sidebarRight.openTab(TAB_KIND),
							}),
						},
						GodotPreviewAction,
					),
				);
			},
		};
	},
});
