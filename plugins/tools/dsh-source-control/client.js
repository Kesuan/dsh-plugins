/**
 * Client half of the Source Control bundle.
 *
 * The right-Sidebar guide and header shortcut share the same page.
 * The page reads `/local/source-control/*` from
 * the Host half; it never imports another Harness Client package, so React is
 * the only runtime module it needs.
 */
window.__ModuleLoader__.load({
	id: '@local/dsh-source-control',
	factory(require) {
		const React = require('react');
		const h = React.createElement;

		const NS = 'sourceControl';
		const TAB_ID = '@local/dsh-source-control/page';
		const TAB_KIND = 'source-control';
		const API_PREFIX = '/local/source-control';
		const MUTATION_HEADER = 'x-dsh-source-control';
		const MAX_DIFF_LINES = 4000;

		const LANE_COLORS = [
			'var(--dsw-alias-brand-primary)',
			'var(--dsw-alias-state-success-primary)',
			'var(--dsw-alias-state-warn-primary)',
			'var(--dsw-alias-state-business-primary)',
			'var(--dsw-alias-state-error-primary)',
			'var(--dsw-alias-label-secondary)',
		];

		const en = {
			title: 'Source Control',
			guide: 'Review changes, stage and commit, browse history and diffs.',
			headerAction: 'Source Control',
			noRepo: 'Not a Git repository',
			noRepoHint: 'This Session’s working directory is not inside a Git repository.',
			initRepo: 'Initialize repository',
			initConfirm: 'Initialize a Git repository in this Session’s working directory?',
			initDone: 'Git repository initialized.',
			loadFailed: 'Could not read the repository: {message}',
			retry: 'Retry',
			loading: 'Reading repository…',
			refresh: 'Refresh',
			refreshFailed: 'Refresh failed: {message}',
			sync: 'Sync changes',
			syncMenu: 'More sync actions',
			fetch: 'Fetch',
			pull: 'Pull',
			push: 'Push',
			syncConfirm: 'Sync fetches remote updates, then fast-forwards or pushes the current branch when it is safe. Continue?',
			pullConfirm: 'Pull fast-forwards the current branch from its upstream. Continue?',
			pushConfirm: 'Push the current branch to its upstream. Continue?',
			fetchDone: 'Fetched remote updates.',
			pullDone: 'Pulled from upstream.',
			pushDone: 'Pushed to upstream.',
			syncDone: 'Synced with upstream.',
			syncUpToDate: 'Already up to date.',
			syncFailed: 'Sync failed: {message}',
			detached: 'Detached HEAD',
			unborn: 'No commits yet',
			ahead: '{count} ahead',
			behind: '{count} behind',
			changes: 'Changes',
			changesCount: 'Changes ({count})',
			stagedChanges: 'Staged Changes',
			stagedCount: 'Staged ({count})',
			unstagedChanges: 'Changes',
			unstagedCount: 'Changes ({count})',
			clean: 'Working tree clean',
			cleanHint: 'There are no uncommitted changes.',
			stageAll: 'Stage all',
			unstageAll: 'Unstage all',
			stage: 'Stage',
			unstage: 'Unstage',
			openDiff: 'Open diff',
			fileChanged: 'Changed file',
			commitPlaceholder: 'Message (⌘Enter to commit)',
			commit: 'Commit',
			committing: 'Committing…',
			stageAllChanges: 'Stage all changes before committing',
			commitNeedsMessage: 'Write a commit message first.',
			commitNeedsStaged: 'Stage at least one change before committing.',
			commitDone: 'Committed {hash}.',
			committingFailed: 'Commit failed: {message}',
			history: 'Graph',
			historyCount: 'Graph ({count})',
			historyEmpty: 'No commits in this repository yet.',
			loadMore: 'Load more commits',
			loadingMore: 'Loading…',
			historyFailed: 'Could not read history: {message}',
			diffStaged: 'Staged changes',
			diffUnstaged: 'Working tree',
			diffUntracked: 'Untracked file',
			diffCommit: 'Commit {rev}',
			diffTitle: 'Diff',
			back: 'Back',
			noDiff: 'No text difference to show.',
			binaryDiff: 'This is a binary file, so no text diff is shown.',
			truncatedDiff: 'This diff is too large and was truncated.',
			diffFailed: 'Could not read the diff: {message}',
			commitTitle: 'Commit',
			commitFiles: '{count} changed files',
			commitNoFiles: 'No changed files were recorded for this commit.',
			commitBody: 'Message',
			author: 'Author',
			date: 'Date',
			parents: 'Parents',
			refs: 'Refs',
			close: 'Close',
			cancel: 'Cancel',
			actionFailed: 'Action failed: {message}',
			errorDismiss: 'Dismiss',
			unbornHint: 'Create the first commit from the changes below.',
			repoRoot: 'Repository',
			workingTree: 'Working tree',
			syncUnavailable: 'Sync is unavailable for a detached HEAD or a branch without upstream.',
			noStaged: 'Nothing staged',
			showMoreRefs: '+{count}',
		};

		const zh = {
			title: '源代码管理',
			guide: '查看改动、暂存并提交，浏览提交图谱与逐文件差异。',
			headerAction: '源代码管理',
			noRepo: '不是 Git 仓库',
			noRepoHint: '当前会话的工作目录不在 Git 仓库中。',
			initRepo: '初始化仓库',
			initConfirm: '在当前会话的工作目录初始化 Git 仓库？',
			initDone: '已初始化 Git 仓库。',
			loadFailed: '读取仓库失败：{message}',
			retry: '重试',
			loading: '正在读取仓库…',
			refresh: '刷新',
			refreshFailed: '刷新失败：{message}',
			sync: '同步更改',
			syncMenu: '更多同步操作',
			fetch: '抓取',
			pull: '拉取',
			push: '推送',
			syncConfirm: '同步会先抓取远程更新，再在安全时快进拉取或推送当前分支。继续？',
			pullConfirm: '拉取会从上游快进当前分支。继续？',
			pushConfirm: '把当前分支推送到上游。继续？',
			fetchDone: '已抓取远程更新。',
			pullDone: '已从上游拉取。',
			pushDone: '已推送到上游。',
			syncDone: '已与上游同步。',
			syncUpToDate: '已是最新状态。',
			syncFailed: '同步失败：{message}',
			detached: '分离的 HEAD',
			unborn: '还没有提交',
			ahead: '{count} 个待推送',
			behind: '{count} 个待拉取',
			changes: '更改',
			changesCount: '更改（{count}）',
			stagedChanges: '已暂存的更改',
			stagedCount: '已暂存（{count}）',
			unstagedChanges: '更改',
			unstagedCount: '更改（{count}）',
			clean: '工作区干净',
			cleanHint: '没有未提交的更改。',
			stageAll: '全部暂存',
			unstageAll: '全部取消暂存',
			stage: '暂存',
			unstage: '取消暂存',
			openDiff: '查看差异',
			fileChanged: '更改的文件',
			commitPlaceholder: '消息（⌘Enter 提交）',
			commit: '提交',
			committing: '正在提交…',
			stageAllChanges: '提交前暂存全部更改',
			commitNeedsMessage: '请先输入提交消息。',
			commitNeedsStaged: '请先暂存至少一个更改。',
			commitDone: '已提交 {hash}。',
			committingFailed: '提交失败：{message}',
			history: '图表',
			historyCount: '图表（{count}）',
			historyEmpty: '这个仓库还没有提交记录。',
			loadMore: '加载更多提交',
			loadingMore: '正在加载…',
			historyFailed: '读取提交历史失败：{message}',
			diffStaged: '已暂存的更改',
			diffUnstaged: '工作区',
			diffUntracked: '未跟踪文件',
			diffCommit: '提交 {rev}',
			diffTitle: '差异',
			back: '返回',
			noDiff: '没有可显示的文本差异。',
			binaryDiff: '这是二进制文件，不显示文本差异。',
			truncatedDiff: '差异过大，已截断。',
			diffFailed: '读取差异失败：{message}',
			commitTitle: '提交详情',
			commitFiles: '{count} 个更改的文件',
			commitNoFiles: '这个提交没有记录到更改的文件。',
			commitBody: '提交消息',
			author: '作者',
			date: '日期',
			parents: '父提交',
			refs: '引用',
			close: '关闭',
			cancel: '取消',
			actionFailed: '操作失败：{message}',
			errorDismiss: '忽略',
			unbornHint: '在下方创建第一个提交。',
			repoRoot: '仓库',
			workingTree: '工作区',
			syncUnavailable: '分离的 HEAD 或没有上游的分支无法同步。',
			noStaged: '没有已暂存内容',
			showMoreRefs: '+{count}',
		};

		/** Compose class names without a utility dependency. */
		function cls(...names) {
			return names.filter(Boolean).join(' ');
		}

		/** Describe an unknown thrown value. */
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}

		/** Build the API URL for one endpoint. */
		function apiUrl(path, params) {
			const query = new URLSearchParams();
			for (const [key, value] of Object.entries(params ?? {})) {
				if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
			}
			const suffix = query.toString();
			return `${API_PREFIX}${path}${suffix === '' ? '' : `?${suffix}`}`;
		}

		/** Fetch one API response and turn a non-2xx body into an Error. */
		async function request(path, options = {}) {
			const init = { method: options.method ?? 'GET', cache: 'no-store' };
			if (options.signal !== undefined) init.signal = options.signal;
			if (options.body !== undefined) {
				init.headers = {
					'content-type': 'application/json',
					[MUTATION_HEADER]: '1',
				};
				init.body = JSON.stringify(options.body);
			}
			const response = await fetch(apiUrl(path, options.query), init);
			const data = await response.json().catch(() => ({}));
			if (!response.ok || data.ok === false) {
				throw new Error(data.message || `HTTP ${response.status}`);
			}
			return data;
		}

		/** One small inline icon frame shared by the hand-drawn glyphs below. */
		function Glyph({ size = 16, children }) {
			return h(
				'svg',
				{
					viewBox: '0 0 24 24',
					width: size,
					height: size,
					fill: 'none',
					stroke: 'currentColor',
					strokeWidth: 1.8,
					strokeLinecap: 'round',
					strokeLinejoin: 'round',
					'aria-hidden': 'true',
					style: { display: 'block', flex: '0 0 auto' },
				},
				children,
			);
		}

		function SourceControlIcon({ size = 18 }) {
			return h(
				Glyph,
				{ size },
				h('path', { d: 'M7 5v14' }),
				h('path', { d: 'M7 12c0-4 3-6 7-6h3' }),
				h('path', { d: 'M17 6v5' }),
				h('circle', { cx: 7, cy: 4.5, r: 2.2 }),
				h('circle', { cx: 7, cy: 19.5, r: 2.2 }),
				h('circle', { cx: 17, cy: 4.5, r: 2.2 }),
			);
		}

		function BranchIcon({ size = 14 }) {
			return h(
				Glyph,
				{ size },
				h('path', { d: 'M6 4v16' }),
				h('path', { d: 'M6 12c0-3.5 3-6 7-6h4' }),
				h('path', { d: 'M17 6v5' }),
				h('circle', { cx: 6, cy: 4.5, r: 1.8 }),
				h('circle', { cx: 6, cy: 19.5, r: 1.8 }),
				h('circle', { cx: 17, cy: 4.5, r: 1.8 }),
			);
		}

		function RefreshIcon({ size = 16, spinning = false }) {
			return h(
				'svg',
				{
					viewBox: '0 0 24 24',
					width: size,
					height: size,
					fill: 'none',
					stroke: 'currentColor',
					strokeWidth: 1.8,
					strokeLinecap: 'round',
					strokeLinejoin: 'round',
					'aria-hidden': 'true',
					className: spinning ? 'sc-spin' : undefined,
					style: { display: 'block', flex: '0 0 auto' },
				},
				h('path', { d: 'M20 11a8 8 0 1 0-2.4 6.8' }),
				h('path', { d: 'M20 4v7h-7' }),
			);
		}

		function SyncIcon({ size = 16, spinning = false }) {
			return h(
				'svg',
				{
					viewBox: '0 0 24 24',
					width: size,
					height: size,
					fill: 'none',
					stroke: 'currentColor',
					strokeWidth: 1.8,
					strokeLinecap: 'round',
					strokeLinejoin: 'round',
					'aria-hidden': 'true',
					className: spinning ? 'sc-spin' : undefined,
					style: { display: 'block', flex: '0 0 auto' },
				},
				h('path', { d: 'M20 7h-6V3' }),
				h('path', { d: 'M14 7a7 7 0 0 1 6 8' }),
				h('path', { d: 'M4 17h6v4' }),
				h('path', { d: 'M10 17a7 7 0 0 1-6-8' }),
			);
		}

		function ChevronIcon({ size = 12, down = false }) {
			return h(
				Glyph,
				{ size },
				h('path', { d: down ? 'm6 9 6 6 6-6' : 'm9 6 6 6-6 6' }),
			);
		}

		function PlusIcon({ size = 14 }) {
			return h(Glyph, { size }, h('path', { d: 'M12 5v14M5 12h14' }));
		}

		function MinusIcon({ size = 14 }) {
			return h(Glyph, { size }, h('path', { d: 'M5 12h14' }));
		}

		function BackIcon({ size = 16 }) {
			return h(Glyph, { size }, h('path', { d: 'm14 6-6 6 6 6' }));
		}

		function FileIcon({ size = 14 }) {
			return h(
				Glyph,
				{ size },
				h('path', { d: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z' }),
				h('path', { d: 'M14 3v6h6' }),
			);
		}

		function EllipsisIcon({ size = 16 }) {
			return h(
				Glyph,
				{ size },
				h('circle', { cx: 5, cy: 12, r: 1.2, fill: 'currentColor', stroke: 'none' }),
				h('circle', { cx: 12, cy: 12, r: 1.2, fill: 'currentColor', stroke: 'none' }),
				h('circle', { cx: 19, cy: 12, r: 1.2, fill: 'currentColor', stroke: 'none' }),
			);
		}

		function CheckIcon({ size = 14 }) {
			return h(Glyph, { size }, h('path', { d: 'm5 12 4 4L19 6' }));
		}

		function WarningIcon({ size = 16 }) {
			return h(
				Glyph,
				{ size },
				h('path', { d: 'M12 3 2.8 20h18.4Z' }),
				h('path', { d: 'M12 9v5' }),
				h('circle', { cx: 12, cy: 17, r: 0.9, fill: 'currentColor', stroke: 'none' }),
			);
		}

		/** Split a repository-relative path into its basename and directory. */
		function splitPath(path) {
			const segments = String(path).split('/');
			const name = segments.pop() || path;
			return { name, dir: segments.join('/') };
		}

		/** The letter a source-control list shows for one change. */
		function changeLetter(entry) {
			if (entry.stage === 'conflicted') return '!';
			if (entry.stage === 'untracked') return 'U';
			return entry.index || '?';
		}

		/** The semantic kind used for the row's colour. */
		function changeKind(entry) {
			if (entry.stage === 'conflicted') return 'conflicted';
			if (entry.stage === 'untracked') return 'untracked';
			return entry.kind || 'unknown';
		}

		/** The label used for one diff source. */
		function stageLabel(stage, t) {
			if (stage === 'staged') return t('diffStaged');
			if (stage === 'untracked') return t('diffUntracked');
			return t('diffUnstaged');
		}

		/** Format an ISO timestamp for a compact list row. */
		function formatDate(iso) {
			const date = new Date(iso);
			if (Number.isNaN(date.getTime())) return String(iso ?? '');
			return date.toLocaleString(undefined, {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			});
		}

		/** Format a full date for the commit detail pane. */
		function formatFullDate(iso) {
			const date = new Date(iso);
			if (Number.isNaN(date.getTime())) return String(iso ?? '');
			return date.toLocaleString();
		}

		/** Turn `%D` refs into up to three display chips. */
		function refChips(refs) {
			return (refs ?? []).filter((ref) => typeof ref === 'string' && ref !== '');
		}

		/**
		 * Compute lane positions for the loaded history window.
		 *
		 * A parent outside the window ends the lane at its commit instead of
		 * holding a slot forever. The current HEAD is seeded on lane zero so the
		 * main line stays at the left edge.
		 */
		function buildGraphRows(commits) {
			const present = new Set(commits.map((commit) => commit.hash));
			const lanes = [];
			const head = commits.find((commit) => refsContainHead(commit.refs));
			if (head !== undefined) lanes.push(head.hash);
			const rows = [];
			for (const commit of commits) {
				const before = lanes.slice();
				let lane = lanes.indexOf(commit.hash);
				if (lane < 0) {
					lane = lanes.indexOf(null);
					if (lane < 0) {
						lanes.push(null);
						lane = lanes.length - 1;
					}
				}
				const parents = Array.isArray(commit.parents) ? commit.parents : [];
				const parentLanes = [];
				if (parents.length > 0) {
					const first = lanes.indexOf(parents[0]);
					if (first >= 0 && first !== lane) {
						lanes[lane] = null;
						parentLanes.push(first);
					} else if (present.has(parents[0])) {
						lanes[lane] = parents[0];
					} else {
						lanes[lane] = null;
					}
				} else {
					lanes[lane] = null;
				}
				for (let index = 1; index < parents.length; index += 1) {
					const parent = parents[index];
					if (!present.has(parent)) continue;
					let slot = lanes.indexOf(parent);
					if (slot < 0) {
						slot = lanes.indexOf(null);
						if (slot < 0) {
							lanes.push(parent);
							slot = lanes.length - 1;
						} else {
							lanes[slot] = parent;
						}
					}
					parentLanes.push(slot);
				}
				rows.push({ commit, lane, parentLanes, before, after: lanes.slice() });
			}
			let width = 1;
			for (const row of rows) width = Math.max(width, row.before.length, row.after.length);
			for (const row of rows) row.width = width;
			return rows;
		}

		/** Whether one decoration list marks HEAD. */
		function refsContainHead(refs) {
			return Array.isArray(refs) && refs.some((ref) => String(ref).includes('HEAD'));
		}

		/** Draw one commit's graph cell. */
		function GraphCell({ row, height = 28 }) {
			const depth = Math.max(row.before.length, row.after.length, 1);
			const laneCount = Math.min(Math.max(row.width ?? depth, 1), 6);
			const width = 8 + laneCount * 10;
			const middle = height / 2;
			const x = (lane) => 8 + Math.min(lane, 5) * 10;
			const color = (lane) => LANE_COLORS[lane % LANE_COLORS.length];
			const children = [];
			for (let lane = 0; lane < depth; lane += 1) {
				const above = lane < row.before.length ? row.before[lane] : null;
				const below = lane < row.after.length ? row.after[lane] : null;
				const hasTop = above !== null && above !== undefined;
				const hasBottom = below !== null && below !== undefined;
				if (!hasTop && !hasBottom) continue;
				if (!hasTop && row.parentLanes.includes(lane)) continue;
				const y1 = hasTop ? 0 : middle;
				const y2 = hasBottom ? height : middle;
				if (y1 !== y2) {
					children.push(
						h('line', {
							key: `lane-${lane}`,
							x1: x(lane),
							y1,
							x2: x(lane),
							y2,
							style: { stroke: color(lane) },
							strokeWidth: 2,
							strokeLinecap: 'round',
						}),
					);
				}
			}
			for (const parentLane of row.parentLanes) {
				if (parentLane === row.lane) continue;
				children.push(
					h('path', {
						key: `edge-${parentLane}`,
						d: `M ${x(row.lane)} ${middle} C ${x(row.lane)} ${height}, ${x(parentLane)} ${middle}, ${x(parentLane)} ${height}`,
						fill: 'none',
						style: { stroke: color(parentLane) },
						strokeWidth: 2,
						strokeLinecap: 'round',
					}),
				);
			}
			children.push(
				h('circle', {
					key: 'dot',
					cx: x(row.lane),
					cy: middle,
					r: 3.6,
					style: { fill: 'var(--dsw-alias-bg-base)', stroke: color(row.lane) },
					strokeWidth: 2,
				}),
			);
			return h(
				'svg',
				{
					className: 'sc-graph',
					width,
					height,
					viewBox: `0 0 ${width} ${height}`,
					'aria-hidden': 'true',
				},
				children,
			);
		}

		/** Convert a unified diff into rows with old/new line numbers. */
		function parseUnifiedDiff(text) {
			const lines = String(text).replace(/\r\n/g, '\n').split('\n');
			const rows = [];
			let oldLine = 0;
			let newLine = 0;
			let inHeader = true;
			for (const raw of lines) {
				if (
					inHeader &&
					(raw.startsWith('diff --git ') ||
					raw.startsWith('index ') ||
					raw.startsWith('--- ') ||
					raw.startsWith('+++ ') ||
					raw.startsWith('new file mode ') ||
					raw.startsWith('deleted file mode ') ||
					raw.startsWith('old mode ') ||
					raw.startsWith('new mode ') ||
					raw.startsWith('similarity index ') ||
					raw.startsWith('dissimilarity index ') ||
					raw.startsWith('rename from ') ||
					raw.startsWith('rename to '))
				) {
					continue;
				}
				if (raw.startsWith('@@')) {
					inHeader = false;
					const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
					oldLine = match === null ? 0 : Number(match[1]);
					newLine = match === null ? 0 : Number(match[2]);
					rows.push({ kind: 'hunk', text: raw, old: null, next: null });
					continue;
				}
				if (raw.startsWith('+')) {
					rows.push({ kind: 'add', text: raw.slice(1), old: null, next: newLine });
					newLine += 1;
					continue;
				}
				if (raw.startsWith('-')) {
					rows.push({ kind: 'del', text: raw.slice(1), old: oldLine, next: null });
					oldLine += 1;
					continue;
				}
				if (raw.startsWith('\\')) {
					rows.push({ kind: 'meta', text: raw, old: null, next: null });
					continue;
				}
				rows.push({ kind: 'context', text: raw, old: oldLine, next: newLine });
				oldLine += 1;
				newLine += 1;
			}
			return rows;
		}

		/** A small status letter with its semantic colour. */
		function StatusLetter({ entry }) {
			return h(
				'span',
				{ className: 'sc-letter', 'data-kind': changeKind(entry), title: entry.kind },
				changeLetter(entry),
			);
		}

		/** One file row in the change list. */
		function FileRow({ entry, t, busy, onOpen, onStage, onUnstage }) {
			const path = splitPath(entry.path);
			const canStage = entry.stage !== 'staged';
			const actionLabel = canStage ? t('stage') : t('unstage');
			const activate = () => onOpen(entry);
			return h(
				'div',
				{
					className: 'sc-file-row',
					role: 'button',
					tabIndex: 0,
					title: entry.origPath === undefined ? entry.path : `${entry.origPath} → ${entry.path}`,
					onClick: activate,
					onKeyDown: (event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							activate();
						}
					},
				},
				h(FileIcon, { size: 14 }),
				h(
					'span',
					{ className: 'sc-file-text' },
					h('span', { className: 'sc-file-name' }, path.name),
					path.dir === '' ? null : h('span', { className: 'sc-file-dir' }, path.dir),
				),
				h(
					'span',
					{ className: 'sc-file-actions' },
					h(
						'button',
						{
							type: 'button',
							className: 'sc-row-action',
							title: actionLabel,
							'aria-label': actionLabel,
							disabled: busy,
							onClick: (event) => {
								event.stopPropagation();
								if (canStage) onStage([entry.path]);
								else onUnstage([entry.path]);
							},
						},
						canStage ? h(PlusIcon, { size: 13 }) : h(MinusIcon, { size: 13 }),
					),
				),
				h(StatusLetter, { entry }),
			);
		}

		/** The change list, grouped by index and working tree. */
		function ChangesSection({ status, t, busy, onOpen, onStage, onUnstage }) {
			const [open, setOpen] = React.useState(true);
			const staged = status.entries.filter((entry) => entry.stage === 'staged');
			const unstaged = status.entries.filter((entry) => entry.stage !== 'staged');
			const total = status.counts.staged + status.counts.unstaged + status.counts.untracked + status.counts.conflicted;
			return h(
				'section',
				{ className: 'sc-section' },
				h(
					'div',
					{ className: 'sc-section-head' },
					h(
						'button',
						{
							type: 'button',
							className: 'sc-section-toggle',
							'aria-expanded': open,
							onClick: () => setOpen((value) => !value),
						},
						h(ChevronIcon, { size: 12, down: open }),
						h('span', { className: 'sc-section-title' }, t('changes')),
						h('span', { className: 'sc-count' }, String(total)),
					),
					unstaged.length > 0
						? h(
								'button',
								{
									type: 'button',
									className: 'sc-text-button',
									disabled: busy,
									onClick: () => onStage(unstaged.map((entry) => entry.path)),
								},
								t('stageAll'),
							)
						: null,
					staged.length > 0
						? h(
								'button',
								{
									type: 'button',
									className: 'sc-text-button',
									disabled: busy,
									onClick: () => onUnstage(staged.map((entry) => entry.path)),
								},
								t('unstageAll'),
							)
						: null,
				),
				open
					? total === 0
						? h(
								'div',
								{ className: 'sc-clean' },
								h('span', { className: 'sc-clean-icon' }, h(CheckIcon, { size: 15 })),
								h(
									'span',
									null,
									h('strong', null, t('clean')),
									h('span', null, t('cleanHint')),
								),
							)
						: h(
								React.Fragment,
								null,
								staged.length > 0
									? h(
											React.Fragment,
											null,
											h(
												'div',
												{ className: 'sc-group-head' },
												h('span', null, t('stagedChanges')),
												h('span', { className: 'sc-count' }, String(staged.length)),
											),
											staged.map((entry) =>
												h(FileRow, {
													key: `staged:${entry.path}`,
													entry,
													t,
													busy,
													onOpen,
													onStage,
													onUnstage,
												}),
											),
										)
									: null,
								unstaged.length > 0
									? h(
											React.Fragment,
											null,
											h(
												'div',
												{ className: 'sc-group-head' },
												h('span', null, t('unstagedChanges')),
												h('span', { className: 'sc-count' }, String(unstaged.length)),
											),
											unstaged.map((entry) =>
												h(FileRow, {
													key: `unstaged:${entry.path}:${entry.kind}`,
													entry,
													t,
													busy,
													onOpen,
													onStage,
													onUnstage,
												}),
											),
										)
									: null,
							)
					: null,
			);
		}

		/** The message box below the change list. */
		function CommitBox({ status, t, busy, message, setMessage, stageAll, setStageAll, onCommit }) {
			const staged = status.counts.staged;
			const canCommit = message.trim() !== '' && (stageAll || staged > 0) && busy === null;
			return h(
				'div',
				{ className: 'sc-commit-box' },
				h('textarea', {
					className: 'sc-commit-input',
					value: message,
					placeholder: t('commitPlaceholder'),
					rows: 3,
					'aria-label': t('commitPlaceholder'),
					onChange: (event) => setMessage(event.target.value),
					onKeyDown: (event) => {
						if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
							event.preventDefault();
							if (canCommit) onCommit();
						}
					},
				}),
				h(
					'div',
					{ className: 'sc-commit-row' },
					h(
						'label',
						{ className: 'sc-check-label' },
						h('input', {
							type: 'checkbox',
							checked: stageAll,
							onChange: (event) => setStageAll(event.target.checked),
						}),
						h('span', null, t('stageAllChanges')),
					),
					h('span', { className: 'sc-commit-hint' }, staged === 0 ? t('noStaged') : String(staged)),
					h(
						'button',
						{
							type: 'button',
							className: 'sc-primary-button',
							disabled: !canCommit,
							onClick: onCommit,
						},
						busy === 'commit' ? t('committing') : t('commit'),
					),
				),
				status.repo?.unborn === true ? h('div', { className: 'sc-commit-hint' }, t('unbornHint')) : null,
			);
		}

		/** One ref chip in a history row. */
		function RefChip({ value }) {
			const text = String(value);
			const isHead = text.includes('HEAD');
			const isTag = text.startsWith('tag: ');
			const label = isTag ? text.slice(5) : text.replace(/^HEAD -> /, '');
			return h(
				'span',
				{
					className: 'sc-ref',
					'data-kind': isHead ? 'head' : isTag ? 'tag' : 'remote',
					title: text,
				},
				label,
			);
		}

		/** The commit graph and its rows. */
		function HistorySection({ history, t, loading, hasMore, loadingMore, onOpenCommit, onLoadMore }) {
			const [open, setOpen] = React.useState(true);
			const commits = history?.commits ?? [];
			const rows = React.useMemo(() => buildGraphRows(commits), [commits]);
			return h(
				'section',
				{ className: 'sc-section sc-history-section' },
				h(
					'div',
					{ className: 'sc-section-head' },
					h(
						'button',
						{
							type: 'button',
							className: 'sc-section-toggle',
							'aria-expanded': open,
							onClick: () => setOpen((value) => !value),
						},
						h(ChevronIcon, { size: 12, down: open }),
						h('span', { className: 'sc-section-title' }, t('history')),
						h('span', { className: 'sc-count' }, String(commits.length)),
					),
				),
				open
					? h(
							'div',
							{ className: 'sc-history' },
							loading && commits.length === 0
								? h('div', { className: 'sc-inline-loading' }, t('loading'))
								: null,
							!loading && commits.length === 0
								? h('div', { className: 'sc-history-empty' }, t('historyEmpty'))
								: null,
							rows.map((row) =>
								h(
									'button',
									{
										key: row.commit.hash,
										type: 'button',
										className: 'sc-commit-row',
										title: row.commit.subject,
										onClick: () => onOpenCommit(row.commit.hash),
									},
									h(GraphCell, { row }),
									h(
										'span',
										{ className: 'sc-commit-main' },
										h(
											'span',
											{ className: 'sc-commit-subject' },
											row.commit.subject,
										),
										h(
											'span',
											{ className: 'sc-commit-meta' },
											h('code', null, row.commit.short),
											h('span', null, row.commit.author),
											h('span', null, formatDate(row.commit.date)),
											refChips(row.commit.refs).slice(0, 3).map((ref) =>
												h(RefChip, { key: ref, value: ref }),
											),
										),
									),
								),
							),
							hasMore
								? h(
										'button',
										{
											type: 'button',
											className: 'sc-load-more',
											disabled: loadingMore,
											onClick: onLoadMore,
										},
										loadingMore ? t('loadingMore') : t('loadMore'),
									)
								: null,
						)
					: null,
			);
		}

		/** A banner for the latest mutation result or failure. */
		function Banner({ kind, message, onDismiss, t }) {
			return h(
				'div',
				{ className: cls('sc-banner', `sc-banner-${kind}`), role: kind === 'error' ? 'alert' : 'status' },
				kind === 'error' ? h(WarningIcon, { size: 15 }) : h(CheckIcon, { size: 15 }),
				h('span', { className: 'sc-banner-text' }, message),
				onDismiss === undefined || onDismiss === null
					? null
					: h(
							'button',
							{
								type: 'button',
								className: 'sc-banner-dismiss',
								'aria-label': t('errorDismiss'),
								title: t('errorDismiss'),
								onClick: onDismiss,
							},
							'×',
						),
			);
		}

		/** A tiny confirmation dialog that belongs to this panel. */
		function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel, t }) {
			React.useEffect(() => {
				const onKey = (event) => {
					if (event.key === 'Escape') onCancel();
				};
				window.addEventListener('keydown', onKey);
				return () => window.removeEventListener('keydown', onKey);
			}, [onCancel]);
			return h(
				'div',
				{ className: 'sc-modal-backdrop', role: 'presentation', onMouseDown: (event) => event.stopPropagation() },
				h(
					'div',
					{
						className: 'sc-modal',
						role: 'dialog',
						'aria-modal': 'true',
						'aria-labelledby': 'sc-modal-title',
					},
					h('h3', { id: 'sc-modal-title' }, title),
					h('p', null, body),
					h(
						'div',
						{ className: 'sc-modal-actions' },
						h(
							'button',
							{ type: 'button', className: 'sc-text-button', onClick: onCancel },
							t('cancel'),
						),
						h(
							'button',
							{ type: 'button', className: 'sc-primary-button', autoFocus: true, onClick: onConfirm },
							confirmLabel,
						),
					),
				),
			);
		}

		/** A loading, error, or empty state for the whole page. */
		function StatePanel({ kind, title, detail, actionLabel, onAction, t, children }) {
			return h(
				'div',
				{ className: 'sc-state' },
				kind === 'error' ? h(WarningIcon, { size: 22 }) : kind === 'loading' ? h('span', { className: 'sc-spinner' }) : h(SourceControlIcon, { size: 24 }),
				h('strong', null, title),
				detail === undefined ? null : h('span', null, detail),
				actionLabel !== undefined && onAction !== undefined
					? h('button', { type: 'button', className: 'sc-primary-button', onClick: onAction }, actionLabel)
					: null,
				children,
			);
		}

		/** One API read with cancellation tied to the component's lifetime. */
		function useApiRead(sessionId, path, query, deps) {
			const [state, setState] = React.useState({ phase: 'loading', data: null, error: null });
			const [epoch, setEpoch] = React.useState(0);
			React.useEffect(() => {
				const controller = new AbortController();
				setState((current) => (current.data === null ? { phase: 'loading', data: null, error: null } : current));
				request(path, { query: { sessionId, ...query }, signal: controller.signal }).then(
					(data) => {
						if (!controller.signal.aborted) setState({ phase: 'ready', data, error: null });
					},
					(error) => {
						if (!controller.signal.aborted) setState({ phase: 'error', data: null, error: messageOf(error) });
					},
				);
				return () => controller.abort();
				// The caller passes the query fields that identify this read.
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, [sessionId, path, ...deps, epoch]);
			return {
				...state,
				retry: () => {
					setState({ phase: 'loading', data: null, error: null });
					setEpoch((value) => value + 1);
				},
			};
		}

		/** Read status and history together, with a quiet background refresh. */
		function useGitData(sessionId) {
			const [status, setStatus] = React.useState({ phase: 'loading', data: null, error: null });
			const [history, setHistory] = React.useState({ phase: 'loading', data: null, error: null });
			const [refreshing, setRefreshing] = React.useState(false);
			const inFlight = React.useRef(null);

			const refresh = React.useCallback(
				async (quiet = false) => {
					inFlight.current?.abort();
					const controller = new AbortController();
					inFlight.current = controller;
					if (!quiet) setRefreshing(true);
					try {
						const nextStatus = await request('/status', {
							query: { sessionId },
							signal: controller.signal,
						});
						if (controller.signal.aborted) return;
						setStatus({ phase: 'ready', data: nextStatus, error: null });
						if (nextStatus.repo === null) {
							setHistory({ phase: 'ready', data: null, error: null });
							return;
						}
						const nextHistory = await request('/history', {
							query: { sessionId, limit: 30 },
							signal: controller.signal,
						});
						if (controller.signal.aborted) return;
						setHistory({ phase: 'ready', data: nextHistory, error: null });
					} catch (error) {
						if (controller.signal.aborted) return;
						const message = messageOf(error);
						setStatus((current) =>
							current.data === null
								? { phase: 'error', data: null, error: message }
								: { ...current, error: message },
						);
						setHistory((current) =>
							current.data === null
								? { phase: 'error', data: null, error: message }
								: { ...current, error: message },
						);
					} finally {
						if (!controller.signal.aborted) setRefreshing(false);
					}
				},
				[sessionId],
			);

			React.useEffect(() => {
				void refresh(true);
				const timer = window.setInterval(() => {
					if (document.visibilityState === 'visible') void refresh(true);
				}, 15_000);
				const onFocus = () => void refresh(true);
				window.addEventListener('focus', onFocus);
				return () => {
					window.clearInterval(timer);
					window.removeEventListener('focus', onFocus);
					inFlight.current?.abort();
				};
			}, [refresh]);

			return { status, history, refreshing, refresh };
		}

		/** The page's branch/repository header and its actions. */
		function RepoHeader({
			status,
			t,
			refreshing,
			syncBusy,
			menuOpen,
			setMenuOpen,
			onRefresh,
			onSync,
			onMenuAction,
		}) {
			const repo = status?.repo ?? null;
			const branchLabel = repo === null ? '' : repo.detached ? t('detached') : repo.branch || t('unborn');
			return h(
				'div',
				{ className: 'sc-head' },
				h(
					'div',
					{ className: 'sc-repo-line' },
					h('span', { className: 'sc-repo-glyph' }, h(SourceControlIcon, { size: 17 })),
					h('span', { className: 'sc-repo-name', title: repo?.root ?? '' }, repo?.name ?? t('title')),
					h(
						'span',
						{ className: 'sc-head-actions' },
						h(
							'button',
							{
								type: 'button',
								className: 'sc-icon-button',
								title: t('refresh'),
								'aria-label': t('refresh'),
								disabled: refreshing || syncBusy,
								onClick: onRefresh,
							},
							h(RefreshIcon, { size: 15, spinning: refreshing }),
						),
						repo === null
							? null
							: h(
									'div',
									{ className: 'sc-menu-anchor' },
									h(
										'button',
										{
											type: 'button',
											className: 'sc-icon-button',
											title: t('sync'),
											'aria-label': t('sync'),
											disabled: syncBusy !== null,
											onClick: onSync,
										},
										h(SyncIcon, { size: 15, spinning: syncBusy !== null }),
									),
									h(
										'button',
										{
											type: 'button',
											className: 'sc-icon-button',
											title: t('syncMenu'),
											'aria-label': t('syncMenu'),
											'aria-haspopup': 'menu',
											'aria-expanded': menuOpen,
											disabled: syncBusy !== null,
											onClick: () => setMenuOpen((value) => !value),
										},
										h(EllipsisIcon, { size: 15 }),
									),
									menuOpen
										? h(
												'div',
												{ className: 'sc-menu', role: 'menu' },
												[
													['fetch', t('fetch')],
													['pull', t('pull')],
													['push', t('push')],
													['sync', t('sync')],
												].map(([mode, label]) =>
													h(
														'button',
														{
															key: mode,
															type: 'button',
															role: 'menuitem',
															className: 'sc-menu-item',
															onClick: () => onMenuAction(mode),
														},
														label,
													),
												),
											)
										: null,
								),
					),
				),
				repo === null
					? null
					: h(
							'div',
							{ className: 'sc-branch-line' },
							h(
								'span',
								{ className: 'sc-branch-pill', title: repo.upstream ?? repo.branch },
								h(BranchIcon, { size: 12 }),
								h('span', { className: 'sc-branch-name' }, branchLabel),
							),
							repo.ahead > 0 ? h('span', { className: 'sc-ahead-behind sc-ahead' }, t('ahead', { count: String(repo.ahead) })) : null,
							repo.behind > 0 ? h('span', { className: 'sc-ahead-behind sc-behind' }, t('behind', { count: String(repo.behind) })) : null,
							h('span', { className: 'sc-repo-path', title: repo.root }, repo.root),
						),
			);
		}

		/** Rendered when the Session workspace is not a repository. */
		function NoRepoState({ t, onInit, cwd }) {
			return h(
				'div',
				{ className: 'sc-state' },
				h(SourceControlIcon, { size: 26 }),
				h('strong', null, t('noRepo')),
				h('span', null, t('noRepoHint')),
				cwd === undefined ? null : h('code', { className: 'sc-state-path', title: cwd }, cwd),
				h(
					'button',
					{ type: 'button', className: 'sc-primary-button', onClick: onInit },
					t('initRepo'),
				),
			);
		}

		/** The unified diff viewer. */
		function DiffView({ sessionId, request, t, onBack }) {
			const state = useApiRead(
				sessionId,
				'/diff',
				{ path: request.path, stage: request.stage, rev: request.rev },
				[request.path, request.stage, request.rev],
			);
			const lines = React.useMemo(() => {
				if (state.data?.diff === undefined || state.data.diff === '') return [];
				return parseUnifiedDiff(state.data.diff);
			}, [state.data]);
			const shown = lines.slice(0, MAX_DIFF_LINES);
			return h(
				'div',
				{ className: 'sc-subpage' },
				h(
					'div',
					{ className: 'sc-subhead' },
					h(
						'button',
						{ type: 'button', className: 'sc-icon-button', title: t('back'), 'aria-label': t('back'), onClick: onBack },
						h(BackIcon, { size: 16 }),
					),
					h(FileIcon, { size: 16 }),
					h(
						'span',
						{ className: 'sc-subhead-text' },
						h('strong', { title: request.path }, splitPath(request.path).name),
						h('span', null, request.stage === 'commit' ? t('diffCommit', { rev: String(request.rev).slice(0, 7) }) : stageLabel(request.stage, t)),
					),
				),
				state.phase === 'loading'
					? h(StatePanel, { kind: 'loading', title: t('loading') })
					: state.phase === 'error'
						? h(StatePanel, {
								kind: 'error',
								title: t('diffFailed', { message: state.error }),
								actionLabel: t('retry'),
								onAction: state.retry,
							})
						: h(
								'div',
								{ className: 'sc-diff' },
								state.data.binary ? h('div', { className: 'sc-diff-note' }, t('binaryDiff')) : null,
								state.data.truncated ? h('div', { className: 'sc-diff-note' }, t('truncatedDiff')) : null,
								lines.length === 0 && !state.data.binary
									? h('div', { className: 'sc-diff-note' }, t('noDiff'))
									: null,
								lines.length > MAX_DIFF_LINES
									? h('div', { className: 'sc-diff-note' }, t('truncatedDiff'))
									: null,
								h(
									'div',
									{ className: 'sc-diff-scroll' },
									shown.map((line, index) =>
										h(
											'div',
											{ key: String(index), className: 'sc-diff-line', 'data-kind': line.kind },
											h('span', { className: 'sc-lineno' }, line.old === null ? '' : String(line.old)),
											h('span', { className: 'sc-lineno' }, line.next === null ? '' : String(line.next)),
											h('span', { className: 'sc-code' }, line.text === '' ? '\u00a0' : line.text),
										),
									),
								),
							),
			);
		}

		/** The commit detail viewer. */
		function CommitView({ sessionId, rev, t, onBack, onOpenFile }) {
			const state = useApiRead(sessionId, '/commit', { rev }, [rev]);
			const commit = state.data?.commit;
			return h(
				'div',
				{ className: 'sc-subpage' },
				h(
					'div',
					{ className: 'sc-subhead' },
					h(
						'button',
						{ type: 'button', className: 'sc-icon-button', title: t('back'), 'aria-label': t('back'), onClick: onBack },
						h(BackIcon, { size: 16 }),
					),
					h(SourceControlIcon, { size: 16 }),
					h(
						'span',
						{ className: 'sc-subhead-text' },
						h('strong', null, t('commitTitle')),
						h('span', null, String(rev).slice(0, 7)),
					),
				),
				state.phase === 'loading'
					? h(StatePanel, { kind: 'loading', title: t('loading') })
					: state.phase === 'error'
						? h(StatePanel, { kind: 'error', title: t('loadFailed', { message: state.error }), actionLabel: t('retry'), onAction: state.retry })
						: h(
								'div',
								{ className: 'sc-commit-detail' },
								h('h2', { className: 'sc-detail-subject' }, commit.subject),
								h(
									'div',
									{ className: 'sc-detail-meta' },
									h('code', null, commit.short),
									h('span', null, `${t('author')}: ${commit.author}`),
									h('span', null, `${t('date')}: ${formatFullDate(commit.date)}`),
								),
								(commit.parents ?? []).length > 0
									? h(
											'div',
											{ className: 'sc-detail-row' },
											h('span', { className: 'sc-detail-label' }, t('parents')),
											(commit.parents ?? []).map((parent) =>
												h('code', { key: parent, className: 'sc-parent' }, parent.slice(0, 7)),
											),
										)
									: null,
								(commit.refs ?? []).length > 0
									? h(
											'div',
											{ className: 'sc-detail-row' },
											h('span', { className: 'sc-detail-label' }, t('refs')),
											(commit.refs ?? []).map((ref) => h(RefChip, { key: ref, value: ref })),
										)
									: null,
								commit.body === ''
									? null
									: h(
											'div',
											{ className: 'sc-detail-body' },
											h('span', { className: 'sc-detail-label' }, t('commitBody')),
											h('pre', null, commit.body),
										),
								h(
									'div',
									{ className: 'sc-detail-section-title' },
									t('commitFiles', { count: String(state.data.files.length) }),
								),
								state.data.files.length === 0
									? h('div', { className: 'sc-diff-note' }, t('commitNoFiles'))
									: state.data.files.map((file) =>
											h(
												'button',
												{
													key: `${file.status}:${file.path}`,
													type: 'button',
													className: 'sc-commit-file',
													onClick: () => onOpenFile(file),
												},
												h('span', { className: 'sc-letter', 'data-kind': file.kind }, file.status),
												h(
													'span',
													{ className: 'sc-file-text' },
													h('span', { className: 'sc-file-name' }, splitPath(file.path).name),
													splitPath(file.path).dir === ''
														? null
														: h('span', { className: 'sc-file-dir' }, splitPath(file.path).dir),
												),
											),
										),
							),
			);
		}

		/** The main source-control page. */
		function SourceControlTab({ sessionId, t }) {
			const { status, history, refreshing, refresh } = useGitData(sessionId);
			const [view, setView] = React.useState({ type: 'list' });
			const [busy, setBusy] = React.useState(null);
			const [error, setError] = React.useState(null);
			const [notice, setNotice] = React.useState(null);
			const [confirm, setConfirm] = React.useState(null);
			const [menuOpen, setMenuOpen] = React.useState(false);
			const [message, setMessage] = React.useState('');
			const [stageAll, setStageAll] = React.useState(false);
			const [older, setOlder] = React.useState([]);
			const [extraHasMore, setExtraHasMore] = React.useState(null);
			const [loadingMore, setLoadingMore] = React.useState(false);
			const menuRef = React.useRef(null);

			React.useEffect(() => {
				if (notice === null) return undefined;
				const timer = window.setTimeout(() => setNotice(null), 4_000);
				return () => window.clearTimeout(timer);
			}, [notice]);

			React.useEffect(() => {
				if (!menuOpen) return undefined;
				const onPointerDown = (event) => {
					if (menuRef.current !== null && !menuRef.current.contains(event.target)) setMenuOpen(false);
				};
				document.addEventListener('pointerdown', onPointerDown);
				return () => document.removeEventListener('pointerdown', onPointerDown);
			}, [menuOpen]);

			const perform = React.useCallback(
				async (kind, operation, successText) => {
					setBusy(kind);
					setError(null);
					try {
						const result = await operation();
						await refresh(true);
						setOlder([]);
						setExtraHasMore(null);
						if (successText !== undefined) setNotice(successText(result));
						return true;
					} catch (failure) {
						setError(messageOf(failure));
						return false;
					} finally {
						setBusy(null);
					}
				},
				[refresh],
			);

			const stage = React.useCallback(
				(paths) =>
					perform('stage', () => request('/stage', { method: 'POST', body: { sessionId, paths } })),
				[perform, sessionId],
			);
			const unstage = React.useCallback(
				(paths) =>
					perform('unstage', () => request('/unstage', { method: 'POST', body: { sessionId, paths } })),
				[perform, sessionId],
			);

			const commit = React.useCallback(async () => {
				if (message.trim() === '') {
					setError(t('commitNeedsMessage'));
					return;
				}
				const staged = status.data?.counts?.staged ?? 0;
				if (!stageAll && staged === 0) {
					setError(t('commitNeedsStaged'));
					return;
				}
				const ok = await perform(
					'commit',
					() => request('/commit', { method: 'POST', body: { sessionId, message, stageAll } }),
					(result) => t('commitDone', { hash: result.commit?.hash ?? '' }),
				);
				if (ok) {
					setMessage('');
					setStageAll(false);
				}
			}, [message, perform, sessionId, stageAll, status.data, t]);

			const runSync = React.useCallback(
				async (mode) => {
					setMenuOpen(false);
					await perform(
						'sync',
						() => request('/sync', { method: 'POST', body: { sessionId, mode } }),
						(result) => {
							if (result.action === 'fetch') return t('fetchDone');
							if (result.action === 'pull') return t('pullDone');
							if (result.action === 'push') return t('pushDone');
							if (result.action === 'none') return t('syncUpToDate');
							return t('syncDone');
						},
					);
				},
				[perform, sessionId, t],
			);

			const askSync = React.useCallback(
				(mode) => {
					setMenuOpen(false);
					if (mode === 'fetch') {
						void runSync('fetch');
						return;
					}
					const key = mode === 'pull' ? 'pullConfirm' : mode === 'push' ? 'pushConfirm' : 'syncConfirm';
					const label = mode === 'pull' ? t('pull') : mode === 'push' ? t('push') : t('sync');
					setConfirm({
						title: label,
						body: t(key),
						confirmLabel: label,
						onConfirm: () => void runSync(mode),
					});
				},
				[runSync, t],
			);

			const askInit = React.useCallback(() => {
				setConfirm({
					title: t('initRepo'),
					body: t('initConfirm'),
					confirmLabel: t('initRepo'),
					onConfirm: () =>
						void perform(
							'init',
							() => request('/init', { method: 'POST', body: { sessionId } }),
							() => t('initDone'),
						),
				});
			}, [perform, sessionId, t]);

			const openDiff = React.useCallback((entry) => {
				setView({
					type: 'diff',
					request: {
						path: entry.path,
						stage: entry.stage,
						rev: null,
						title: entry.path,
					},
				});
			}, []);

			const openCommit = React.useCallback((hash) => {
				setView({ type: 'commit', rev: hash });
			}, []);

			const loadMore = React.useCallback(async () => {
				const existing = [...(history.data?.commits ?? []), ...older];
				setLoadingMore(true);
				try {
					const next = await request('/history', {
						query: { sessionId, limit: 30, skip: existing.length },
					});
					const seen = new Set(existing.map((item) => item.hash));
					setOlder((current) => [...current, ...next.commits.filter((item) => !seen.has(item.hash))]);
					setExtraHasMore(next.hasMore === true);
				} catch (failure) {
					setError(messageOf(failure));
				} finally {
					setLoadingMore(false);
				}
			}, [history.data, older, sessionId]);

			if (view.type === 'diff') {
				return h(DiffView, {
					sessionId,
					request: view.request,
					t,
					onBack: () => setView(view.backTo ?? { type: 'list' }),
				});
			}
			if (view.type === 'commit') {
				return h(CommitView, {
						sessionId,
						rev: view.rev,
						t,
						onBack: () => setView({ type: 'list' }),
						onOpenFile: (file) =>
							setView({
								type: 'diff',
								request: { path: file.path, stage: 'commit', rev: view.rev, title: file.path },
								backTo: { type: 'commit', rev: view.rev },
							}),
					});
			}

			const data = status.data;
			const mergedHistory =
				history.data === null
					? null
					: { ...history.data, commits: [...(history.data.commits ?? []), ...older] };
			const headerError = status.phase === 'ready' ? status.error ?? history.error : null;

			return h(
				'div',
				{ className: 'sc-root' },
					h(RepoHeader, {
						status: data,
						t,
						refreshing,
						syncBusy: busy === 'sync' ? 'sync' : null,
						menuOpen,
						setMenuOpen,
						onRefresh: () => void refresh(),
						onSync: () => askSync('sync'),
						onMenuAction: askSync,
					}),
					error === null ? null : h(Banner, { kind: 'error', message: t('actionFailed', { message: error }), onDismiss: () => setError(null), t }),
					notice === null ? null : h(Banner, { kind: 'success', message: notice, onDismiss: () => setNotice(null), t }),
					headerError === null ? null : h(Banner, { kind: 'error', message: t('loadFailed', { message: headerError }), onDismiss: null, t }),
					h(
						'div',
						{ className: 'sc-scroll' },
						status.phase === 'loading'
							? h(StatePanel, { kind: 'loading', title: t('loading') })
							: status.phase === 'error'
								? h(StatePanel, {
										kind: 'error',
										title: t('loadFailed', { message: status.error }),
										actionLabel: t('retry'),
										onAction: () => void refresh(),
									})
								: data?.repo === null
									? h(NoRepoState, { t, onInit: askInit, cwd: data?.cwd })
									: h(
											React.Fragment,
											null,
											h(ChangesSection, {
												status: data,
												t,
												busy: busy !== null,
												onOpen: openDiff,
												onStage: stage,
												onUnstage: unstage,
											}),
											h(CommitBox, {
												status: data,
												t,
												busy,
												message,
												setMessage,
												stageAll,
												setStageAll,
												onCommit: () => void commit(),
											}),
											history.phase === 'error'
												? h(StatePanel, {
														kind: 'error',
														title: t('historyFailed', { message: history.error }),
														actionLabel: t('retry'),
														onAction: () => void refresh(),
													})
												: h(HistorySection, {
														history: mergedHistory,
														t,
														loading: history.phase === 'loading',
														hasMore: extraHasMore === null ? mergedHistory?.hasMore === true : extraHasMore,
														loadingMore,
														onOpenCommit: openCommit,
														onLoadMore: () => void loadMore(),
													}),
										),
					),
					confirm === null
						? null
						: h(ConfirmDialog, {
								title: confirm.title,
								body: confirm.body,
								confirmLabel: confirm.confirmLabel,
								t,
								onCancel: () => setConfirm(null),
								onConfirm: () => {
									const action = confirm.onConfirm;
									setConfirm(null);
									void action();
								},
							}),
			);
		}

		/** The guide card offered by the right Sidebar's add control. */
		function GuideEntry({ sessionId, useTabInfo, t }) {
			const { tab } = useTabInfo();
			return h(
				'button',
				{
					type: 'button',
					className: 'sc-guide-entry',
					onClick: () => tab.actions.openTab(TAB_KIND, { replaceTab: true }),
				},
				h('span', { className: 'sc-guide-icon' }, h(SourceControlIcon, { size: 22 })),
				h(
					'span',
					{ className: 'sc-guide-text' },
					h('strong', null, t('title')),
					h('span', null, t('guide')),
				),
			);
		}

		/** The compact action next to the Session title. */
		function HeaderAction({ t, openSourceControl }) {
			return h(
				'button',
				{
					type: 'button',
					className: 'sc-header-action',
					title: t('headerAction'),
					'aria-label': t('headerAction'),
					onClick: openSourceControl,
				},
				h(SourceControlIcon, { size: 14 }),
				h('span', { className: 'sc-header-action-label' }, t('headerAction')),
			);
		}

		const STYLES = `
.sc-root, .sc-subpage {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsh-font-family-text-default, inherit);
  font-size: 12px;
}
.sc-root { position: relative; }
.sc-head {
  flex: none;
  padding: 9px 10px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.sc-repo-line { display: flex; align-items: center; gap: 7px; min-height: 26px; }
.sc-repo-glyph { display: inline-flex; color: var(--dsw-alias-brand-primary); }
.sc-repo-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 650;
}
.sc-head-actions { margin-left: auto; display: flex; align-items: center; gap: 1px; flex: none; }
.sc-branch-line { display: flex; align-items: center; gap: 5px; min-width: 0; margin-top: 4px; }
.sc-branch-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 55%;
  padding: 1px 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  font-weight: 600;
}
.sc-branch-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-ahead-behind { flex: none; padding: 0 3px; font-size: 10px; font-variant-numeric: tabular-nums; }
.sc-ahead { color: var(--dsw-alias-state-warn-primary); }
.sc-behind { color: var(--dsw-alias-state-business-primary); }
.sc-repo-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9.5px;
}
.sc-icon-button {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.sc-icon-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.sc-icon-button:focus-visible { outline: none; box-shadow: 0 0 0 var(--dsw-focus-ring-width) var(--dsw-focus-ring-color); }
.sc-icon-button:disabled { opacity: .45; cursor: default; }
.sc-menu-anchor { position: relative; display: inline-flex; align-items: center; }
.sc-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 30;
  min-width: 132px;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: var(--dsw-shadow-lv2);
}
.sc-menu-item {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  text-align: left;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.sc-menu-item:hover { background: var(--dsw-alias-interactive-bg-hover); }
.sc-menu-item:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.sc-scroll { flex: 1; min-height: 0; overflow: auto; padding-bottom: 14px; }
.sc-section { border-bottom: 1px solid var(--dsw-alias-border-l1); }
.sc-section-head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 6px 0 4px;
  background: var(--dsw-alias-bg-base);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: .035em;
  text-transform: uppercase;
}
.sc-section-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
  padding: 0 2px;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.sc-section-toggle:hover { color: var(--dsw-alias-label-primary); }
.sc-section-toggle:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.sc-section-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-count {
  flex: none;
  min-width: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-tertiary);
  text-align: center;
  font-size: 9.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}
.sc-text-button {
  flex: none;
  padding: 2px 5px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10px;
  letter-spacing: 0;
  text-transform: none;
  cursor: pointer;
}
.sc-text-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.sc-text-button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.sc-text-button:disabled { opacity: .45; cursor: default; }
.sc-group-head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 9.5px;
  letter-spacing: .035em;
  text-transform: uppercase;
}
.sc-file-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 23px;
  padding: 0 6px 0 9px;
  color: inherit;
  cursor: pointer;
  outline: none;
}
.sc-file-row:hover, .sc-file-row:focus-visible { background: var(--dsw-alias-interactive-bg-hover); }
.sc-file-row:focus-visible { box-shadow: inset 0 0 0 2px var(--dsw-alias-brand-primary); }
.sc-file-text { display: flex; align-items: baseline; gap: 5px; min-width: 0; flex: 1; overflow: hidden; }
.sc-file-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; }
.sc-file-dir { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary); font-size: 9.5px; }
.sc-file-actions { display: inline-flex; flex: none; opacity: 0; }
.sc-file-row:hover .sc-file-actions, .sc-file-row:focus-within .sc-file-actions { opacity: 1; }
.sc-row-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 19px;
  height: 19px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.sc-row-action:hover { background: var(--dsw-alias-bg-base); color: var(--dsw-alias-brand-primary); }
.sc-row-action:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.sc-letter {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
}
.sc-letter[data-kind='modified'], .sc-letter[data-kind='typechange'] { color: var(--dsw-alias-state-warn-primary); }
.sc-letter[data-kind='added'], .sc-letter[data-kind='untracked'] { color: var(--dsw-alias-state-success-primary); }
.sc-letter[data-kind='deleted'], .sc-letter[data-kind='conflicted'] { color: var(--dsw-alias-state-error-primary); }
.sc-letter[data-kind='renamed'], .sc-letter[data-kind='copied'] { color: var(--dsw-alias-state-business-primary); }
.sc-clean { display: flex; align-items: flex-start; gap: 8px; padding: 14px 12px; color: var(--dsw-alias-label-tertiary); }
.sc-clean-icon { display: inline-flex; color: var(--dsw-alias-state-success-primary); margin-top: 1px; }
.sc-clean strong { display: block; color: var(--dsw-alias-label-secondary); font-size: 11.5px; font-weight: 600; }
.sc-clean span span { display: block; margin-top: 2px; font-size: 10.5px; }
.sc-commit-box {
  margin: 8px;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
}
.sc-commit-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 54px;
  max-height: 180px;
  resize: vertical;
  padding: 6px 7px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11.5px;
  line-height: 1.45;
}
.sc-commit-input::placeholder { color: var(--dsw-alias-label-tertiary); }
.sc-commit-input:focus { outline: none; border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 1px var(--dsw-alias-brand-primary); }
.sc-commit-row { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
.sc-check-label { display: inline-flex; align-items: center; gap: 4px; min-width: 0; color: var(--dsw-alias-label-secondary); font-size: 10px; cursor: pointer; }
.sc-check-label input { width: 13px; height: 13px; margin: 0; accent-color: var(--dsw-alias-brand-primary); }
.sc-commit-hint { color: var(--dsw-alias-label-tertiary); font-size: 9.5px; white-space: nowrap; margin-left: auto; }
.sc-primary-button {
  flex: none;
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--dsw-alias-brand-primary);
  color: var(--dsw-static-neutral-00);
  font: inherit;
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
}
.sc-primary-button:hover:not(:disabled) { filter: brightness(1.08); }
.sc-primary-button:focus-visible { outline: none; box-shadow: 0 0 0 var(--dsw-focus-ring-width) var(--dsw-focus-ring-color); }
.sc-primary-button:disabled { opacity: .45; cursor: default; }
.sc-history-section { border-bottom: none; }
.sc-history { padding-bottom: 2px; }
.sc-inline-loading, .sc-history-empty { padding: 12px; color: var(--dsw-alias-label-tertiary); font-size: 10.5px; text-align: center; }
.sc-commit-row {
  display: flex;
  align-items: stretch;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.sc-commit-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.sc-commit-row:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.sc-graph { flex: none; align-self: center; overflow: visible; }
.sc-commit-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 8px 5px 2px;
  border-bottom: .5px solid var(--dsw-alias-border-l1);
}
.sc-commit-subject { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; }
.sc-commit-meta { display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden; color: var(--dsw-alias-label-tertiary); font-size: 9.5px; }
.sc-commit-meta code { color: var(--dsw-alias-label-secondary); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 9.5px; }
.sc-commit-meta > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-ref {
  flex: none;
  display: inline-flex;
  align-items: center;
  max-width: 92px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 9px;
  line-height: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sc-ref[data-kind='head'] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); color: var(--dsw-alias-brand-primary); }
.sc-ref[data-kind='tag'] { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent); color: var(--dsw-alias-state-warn-primary); }
.sc-load-more {
  display: block;
  margin: 8px auto;
  padding: 4px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
}
.sc-load-more:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.sc-load-more:disabled { opacity: .5; cursor: default; }
.sc-banner {
  flex: none;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 7px 8px 0;
  padding: 6px 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  font-size: 10.5px;
  line-height: 1.45;
}
.sc-banner-error { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 9%, transparent); color: var(--dsw-alias-state-error-primary); }
.sc-banner-success { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent); color: var(--dsw-alias-state-success-primary); }
.sc-banner-text { min-width: 0; flex: 1; overflow-wrap: anywhere; }
.sc-banner-dismiss { flex: none; padding: 0 2px; border: none; background: transparent; color: inherit; font: inherit; font-size: 14px; line-height: 1; cursor: pointer; opacity: .7; }
.sc-banner-dismiss:hover { opacity: 1; }
.sc-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  box-sizing: border-box;
  width: 100%;
  min-height: 180px;
  padding: 24px 18px;
  color: var(--dsw-alias-label-tertiary);
  text-align: center;
  font-size: 11px;
  line-height: 1.5;
}
.sc-state strong { color: var(--dsw-alias-label-primary); font-size: 12.5px; font-weight: 650; }
.sc-state span { max-width: 280px; overflow-wrap: anywhere; }
.sc-state .sc-primary-button { margin-top: 4px; }
.sc-state-path { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 9.5px; }
.sc-spinner {
  width: 17px;
  height: 17px;
  border: 2px solid var(--dsw-alias-border-l2);
  border-top-color: var(--dsw-alias-brand-primary);
  border-radius: 50%;
  animation: sc-spin 0.8s linear infinite;
}
@keyframes sc-spin { to { transform: rotate(360deg); } }
.sc-spin { animation: sc-spin 0.9s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .sc-spinner, .sc-spin { animation: none; }
}
.sc-subpage { position: relative; }
.sc-subhead {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.sc-subhead-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.sc-subhead-text strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; font-weight: 650; }
.sc-subhead-text span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary); font-size: 9.5px; }
.sc-diff { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.sc-diff-scroll { flex: 1; min-height: 0; overflow: auto; padding: 4px 0 16px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10.5px; line-height: 1.55; }
.sc-diff-note { margin: 8px; padding: 6px 8px; border-radius: 5px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 10.5px; }
.sc-diff-line { display: flex; min-height: 17px; }
.sc-diff-line[data-kind='add'] { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 11%, transparent); }
.sc-diff-line[data-kind='del'] { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent); }
.sc-diff-line[data-kind='hunk'] { margin-top: 4px; background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent); color: var(--dsw-alias-brand-primary); }
.sc-diff-line[data-kind='meta'] { color: var(--dsw-alias-label-tertiary); font-style: italic; }
.sc-lineno { flex: none; width: 31px; padding-right: 5px; color: var(--dsw-alias-label-tertiary); text-align: right; user-select: none; font-variant-numeric: tabular-nums; }
.sc-code { flex: 1; min-width: 0; padding: 0 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
.sc-commit-detail { flex: 1; min-height: 0; overflow: auto; padding: 10px; }
.sc-detail-subject { margin: 0 0 6px; font-size: 13px; line-height: 1.4; }
.sc-detail-meta { display: flex; flex-direction: column; gap: 2px; color: var(--dsw-alias-label-secondary); font-size: 10.5px; }
.sc-detail-meta code { color: var(--dsw-alias-label-tertiary); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; }
.sc-detail-row { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
.sc-detail-label { color: var(--dsw-alias-label-tertiary); font-size: 9.5px; text-transform: uppercase; letter-spacing: .035em; margin-right: 3px; }
.sc-parent { padding: 1px 4px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 9.5px; }
.sc-detail-body { margin-top: 9px; }
.sc-detail-body pre { margin: 4px 0 0; padding: 7px 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.sc-detail-section-title { margin: 14px 0 4px; color: var(--dsw-alias-label-tertiary); font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; }
.sc-commit-file {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  min-height: 24px;
  padding: 0 4px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.sc-commit-file:hover { background: var(--dsw-alias-interactive-bg-hover); }
.sc-commit-file:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.sc-modal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: color-mix(in srgb, var(--dsw-static-neutral-1000) 38%, transparent);
}
.sc-modal {
  width: min(340px, 100%);
  padding: 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: var(--dsw-shadow-lv3);
}
.sc-modal h3 { margin: 0 0 6px; font-size: 13px; font-weight: 650; }
.sc-modal p { margin: 0 0 12px; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.5; }
.sc-modal-actions { display: flex; justify-content: flex-end; gap: 6px; }
.sc-modal-actions .sc-text-button { font-size: 11px; padding: 5px 8px; }
.sc-guide-entry {
  display: flex;
  align-items: center;
  gap: 13px;
  box-sizing: border-box;
  width: 380px;
  max-width: 100%;
  min-height: 56px;
  padding: 13px 18px;
  border: .5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-xl);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.sc-guide-entry:hover { background: var(--dsw-alias-interactive-bg-hover); }
.sc-guide-entry:focus-visible { outline: none; box-shadow: 0 0 0 var(--dsw-focus-ring-width) var(--dsw-focus-ring-color); }
.sc-guide-icon { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; flex: none; color: var(--dsw-alias-brand-primary); }
.sc-guide-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.sc-guide-text strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 550; line-height: 1.4; }
.sc-guide-text span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 1.4; }
.sc-header-action {
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
  font-size: 11px;
  cursor: pointer;
}
.sc-header-action:hover { background: var(--dsw-alias-interactive-bg-hover); }
.sc-header-action:focus-visible { outline: none; box-shadow: 0 0 0 var(--dsw-focus-ring-width) var(--dsw-focus-ring-color); }
.sc-header-action-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

		return {
			inject: ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs'],
			apply(ctx) {
				ctx.effect(() => {
					if (typeof document === 'undefined') return undefined;
					const element = document.createElement('style');
					element.setAttribute('data-dsh-source-control', '');
					element.textContent = STYLES;
					document.head.appendChild(element);
					return () => element.remove();
				}, 'source-control: styles');
				ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'source-control: dictionaries');
				const t = ctx.locale.bind(NS);

				ctx.effect(
					() =>
						ctx.sidebarRightTabs.register({
							id: TAB_ID,
							kind: TAB_KIND,
							priority: 'extension',
							keepMounted: true,
							title: () => t('title'),
							guide: [
								{
									id: 'source-control',
									order: 25,
									title: () => t('title'),
									description: () => t('guide'),
									icon: SourceControlIcon,
								},
							],
						}),
					'source-control: right Sidebar tab type',
				);

				ctx.slots.inject('sidebar.right.pane.tab', () =>
					ctx.slots.register(
						{ name: 'sidebar.right.pane.tab', key: TAB_ID, locale: NS },
						SourceControlTab,
					),
				);

				ctx.slots.inject('sidebar.right.tab.guide.entry', () =>
					ctx.slots.register(
						{ name: 'sidebar.right.tab.guide.entry', key: TAB_ID, locale: NS },
						GuideEntry,
					),
				);

				ctx.slots.inject('conversation.session.header.actions', () =>
					ctx.slots.register(
						{
							name: 'conversation.session.header.actions',
							id: 'source-control',
							order: 35,
							locale: NS,
							inject: () => ({
								openSourceControl: () => ctx.sidebarRight.openTab(TAB_KIND),
							}),
						},
						HeaderAction,
					),
				);
			},
		};
	},
});
