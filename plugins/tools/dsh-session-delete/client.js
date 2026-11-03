/**
 * Client half of the Session Delete bundle.
 *
 * The menu row is an ordinary entry of `sidebar.workspaces.session.menu.item`,
 * the same list that owns Pin, Rename, Fork, and Archive. Selecting it closes
 * the menu and opens one confirmation dialog in `shell.overlay`; the dialog
 * owns the irreversible warning and calls the Host route only after the user
 * confirms.
 */
window.__ModuleLoader__.load({
	id: '@local/dsh-session-delete',
	factory(require) {
		const React = require('react');
		const h = React.createElement;

		const NS = 'sessionDelete';

		const en = {
			'menu.deleteSession': 'Delete session…',
			'dialog.title': 'Permanently delete this session?',
			'dialog.body': '“{title}” and its entire history will be removed from this computer.',
			'dialog.warning':
				'This cannot be undone. Running turns, subagents, background jobs, and reminders for this session will be stopped.',
			'dialog.cancel': 'Cancel',
			'dialog.confirm': 'Delete permanently',
			'dialog.deleting': 'Deleting…',
			'dialog.deleted': 'Deleted. Refreshing…',
			'dialog.deletedButton': 'Deleted',
			'dialog.live': 'This session is still open. Close it first, then try again.',
			'dialog.notFound': 'This session no longer exists.',
			'dialog.unsupported': 'This action requires the DSH Host process.',
			'dialog.failed': 'Delete failed.',
			'dialog.error': 'Delete failed: {message}',
		};

		const zh = {
			'menu.deleteSession': '永久删除会话…',
			'dialog.title': '永久删除这个会话？',
			'dialog.body': '“{title}”及其全部历史将从这台电脑上删除。',
			'dialog.warning':
				'此操作不可恢复。该会话正在运行的回合、子代理、后台任务和提醒都会被停止。',
			'dialog.cancel': '取消',
			'dialog.confirm': '永久删除',
			'dialog.deleting': '正在删除…',
			'dialog.deleted': '已删除，正在刷新…',
			'dialog.deletedButton': '已删除',
			'dialog.live': '这个会话仍处于打开状态。请先关闭它，再重试。',
			'dialog.notFound': '这个会话已经不存在。',
			'dialog.unsupported': '此操作需要 DSH 的 Host 进程。',
			'dialog.failed': '删除失败。',
			'dialog.error': '删除失败：{message}',
		};

		/**
		 * One pending confirmation. The menu row and the overlay are separate
		 * slot entries in the same module instance, so this tiny store is the
		 * hand-off between them.
		 */
		let pending = null;
		const listeners = new Set();

		/** Notify every mounted subscriber. */
		function emit() {
			for (const listener of listeners) listener();
		}

		/**
		 * @param listener - callback invoked on the next change.
		 * @returns the unsubscribe function.
		 */
		function subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}

		/** @returns the current pending target, or null. */
		function getPending() {
			return pending;
		}

		/** @returns the pending target through React's external-store contract. */
		function usePending() {
			return React.useSyncExternalStore(subscribe, getPending);
		}

		/**
		 * @param target - Session id and display title awaiting confirmation.
		 */
		function requestDelete(target) {
			pending = target;
			emit();
		}

		/** Drop the pending confirmation without deleting anything. */
		function settleDelete() {
			pending = null;
			emit();
		}

		/** @param value - byte count. @returns a short human-readable size. */
		function formatBytes(value) {
			if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '';
			if (value < 1024) return `${value} B`;
			const units = ['KB', 'MB', 'GB'];
			let size = value / 1024;
			let unit = 0;
			while (size >= 1024 && unit < units.length - 1) {
				size /= 1024;
				unit += 1;
			}
			return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
		}

		/**
		 * The `...` menu row. Closing the menu before opening the dialog keeps
		 * the popover from competing with the modal for focus.
		 * @param props - the Session row share and the locale translator.
		 * @returns the menu row.
		 */
		function SessionDeleteMenuItem({ sessionId, displayTitle, useMenuOpenState, t }) {
			const [, setMenuOpen] = useMenuOpenState();
			return h(
				'button',
				{
					type: 'button',
					role: 'menuitem',
					className: 'dsh-session-delete-row',
					onClick: () => {
						setMenuOpen(false);
						requestDelete({ sessionId, displayTitle });
					},
				},
				h('span', { className: 'dsh-session-delete-label' }, t('menu.deleteSession')),
			);
		}

		/**
		 * The overlay entry. Always mounted so its styles exist before the first
		 * confirmation, but it renders nothing while no request is pending.
		 * @param props - the locale translator.
		 * @returns the styles plus zero or one dialog.
		 */
		function SessionDeleteDialog({ t }) {
			const target = usePending();
			return h(
				React.Fragment,
				null,
				h('style', null, STYLES),
				target === null ? null : h(SessionDeleteDialogBody, { key: target.sessionId, target, t }),
			);
		}

		/**
		 * One confirmation dialog. State dies with the target because this
		 * component is keyed by the Session id below.
		 * @param props - the pending target and the locale translator.
		 * @returns the modal.
		 */
		function SessionDeleteDialogBody({ target, t }) {
			const [busy, setBusy] = React.useState(false);
			const [error, setError] = React.useState(null);
			const [done, setDone] = React.useState(false);
			const [freed, setFreed] = React.useState('');
			const cancelRef = React.useRef(null);
			const titleId = 'dsh-session-delete-title';
			const bodyId = 'dsh-session-delete-body';

			const close = React.useCallback(() => {
				if (busy || done) return;
				settleDelete();
			}, [busy, done]);

			React.useEffect(() => {
				cancelRef.current?.focus();
			}, []);

			React.useEffect(() => {
				const onKeyDown = (event) => {
					if (event.key === 'Escape') {
						event.preventDefault();
						close();
					}
				};
				window.addEventListener('keydown', onKeyDown, true);
				return () => window.removeEventListener('keydown', onKeyDown, true);
			}, [close]);

			const confirm = async () => {
				if (busy || done) return;
				setBusy(true);
				setError(null);
				try {
					const response = await fetch('/local/session-delete', {
						method: 'POST',
						headers: {
							'content-type': 'application/json',
							'x-dsh-session-delete': '1',
						},
						body: JSON.stringify({ sessionId: target.sessionId }),
					});
					const data = await response.json().catch(() => ({}));
					if (!response.ok || data.ok !== true) {
						setBusy(false);
						const message =
							data.error === 'live'
								? t('dialog.live')
								: data.error === 'not-found'
									? t('dialog.notFound')
									: typeof data.message === 'string' && data.message !== ''
										? t('dialog.error', { message: data.message })
										: t('dialog.failed');
						setError(message);
						return;
					}
					setFreed(formatBytes(data.freedBytes));
					setDone(true);
					window.setTimeout(() => {
						window.location.reload();
					}, 900);
				} catch (reason) {
					setBusy(false);
					const appOrigin =
						window.location.protocol === 'http:' ||
						window.location.protocol === 'https:' ||
						window.location.protocol === 'dsh-app:';
					setError(
						!appOrigin
							? t('dialog.unsupported')
							: t('dialog.error', {
									message: reason instanceof Error ? reason.message : String(reason),
								}),
					);
				}
			};

			const subtitle = target.displayTitle || target.sessionId;
			return h(
				'div',
				{
					className: 'dsh-session-delete-overlay',
					onMouseDown: (event) => {
						if (event.target === event.currentTarget) close();
					},
				},
				h(
					'div',
					{
						className: 'dsh-session-delete-modal',
						role: 'dialog',
						'aria-modal': 'true',
						'aria-labelledby': titleId,
						'aria-describedby': bodyId,
					},
					h('h2', { id: titleId, className: 'dsh-session-delete-title' }, t('dialog.title')),
					h(
						'p',
						{ id: bodyId, className: 'dsh-session-delete-body' },
						t('dialog.body', { title: subtitle }),
					),
					h('p', { className: 'dsh-session-delete-warning' }, t('dialog.warning')),
					error === null ? null : h('p', { className: 'dsh-session-delete-error', role: 'alert' }, error),
					done
						? h(
								'p',
								{ className: 'dsh-session-delete-done', role: 'status' },
								freed === '' ? t('dialog.deleted') : `${t('dialog.deleted')} (${freed})`,
							)
						: null,
					h(
						'div',
						{ className: 'dsh-session-delete-actions' },
						h(
							'button',
							{
								ref: cancelRef,
								type: 'button',
								className: 'dsh-session-delete-button',
								disabled: busy || done,
								onClick: close,
							},
							t('dialog.cancel'),
						),
						h(
							'button',
							{
								type: 'button',
								className: 'dsh-session-delete-button dsh-session-delete-danger',
								disabled: busy || done,
								onClick: confirm,
							},
							done ? t('dialog.deletedButton') : busy ? t('dialog.deleting') : t('dialog.confirm'),
						),
					),
				),
			);
		}

		const STYLES = `
.dsh-session-delete-row {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  min-height: 32px;
  margin-top: 4px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  box-shadow: inset 0 1px 0 var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  color: var(--dsw-alias-label-primary, #111827);
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}
.dsh-session-delete-row:hover,
.dsh-session-delete-row:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .06));
  outline: none;
}
.dsh-session-delete-label {
  color: var(--dsw-alias-state-error-primary, #dc2626);
}
.dsh-session-delete-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 24px;
  background: color-mix(in srgb, var(--dsw-static-neutral-1000, #000) 32%, transparent);
}
.dsh-session-delete-modal {
  box-sizing: border-box;
  width: min(420px, 100%);
  padding: 20px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  border-radius: 12px;
  background: var(--dsw-alias-bg-overlay, #ffffff);
  color: var(--dsw-alias-label-primary, #111827);
  box-shadow: 0 16px 48px color-mix(in srgb, var(--dsw-static-neutral-1000, #000) 24%, transparent);
  font-size: 14px;
  line-height: 1.5;
}
.dsh-session-delete-title {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}
.dsh-session-delete-body {
  margin: 0 0 10px;
  color: var(--dsw-alias-label-primary, #111827);
  word-break: break-word;
}
.dsh-session-delete-warning {
  margin: 0 0 14px;
  color: var(--dsw-alias-state-error-primary, #dc2626);
  font-size: 13px;
}
.dsh-session-delete-error {
  margin: 0 0 14px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-interactive-bg-hover-danger, rgba(220, 38, 38, .08));
  color: var(--dsw-alias-state-error-primary, #dc2626);
  font-size: 13px;
}
.dsh-session-delete-done {
  margin: 0 0 14px;
  color: var(--dsw-alias-label-secondary, #4b5563);
  font-size: 13px;
}
.dsh-session-delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.dsh-session-delete-button {
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .18));
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #111827);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.dsh-session-delete-button:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .06));
}
.dsh-session-delete-button:disabled {
  cursor: default;
  opacity: .55;
}
.dsh-session-delete-danger {
  border-color: transparent;
  background: var(--dsw-alias-state-error-primary, #dc2626);
  color: var(--dsw-static-neutral-00, #ffffff);
}
.dsh-session-delete-danger:hover:not(:disabled) {
  background: var(--dsw-alias-state-error-primary, #dc2626);
  opacity: .9;
}
`;

		return {
			inject: ['slots', 'locale'],
			apply(ctx) {
				ctx.effect(
					() => ctx.locale.register(NS, { en, zh }),
					'session-delete: dictionaries',
				);
				ctx.slots.inject('sidebar.workspaces.session.menu.item', () =>
					ctx.slots.register(
						{
							name: 'sidebar.workspaces.session.menu.item',
							id: 'session-delete',
							order: 500,
							locale: NS,
						},
						SessionDeleteMenuItem,
					),
				);
				ctx.slots.inject('shell.overlay', () =>
					ctx.slots.register(
						{
							name: 'shell.overlay',
							id: 'session-delete-dialog',
							order: 1000,
							locale: NS,
						},
						SessionDeleteDialog,
					),
				);
			},
		};
	},
});
