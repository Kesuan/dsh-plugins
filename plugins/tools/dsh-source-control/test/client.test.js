import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Load the browser artifact the same way the Harness module table does, then
 * exercise its `apply` function against a small fake Client context. This does
 * not render React; it verifies the registrations that make the page reachable.
 */
let loaded;
globalThis.window = {
	__ModuleLoader__: {
		load({ id, factory }) {
			loaded = { id, factory };
		},
	},
};
await import('../client.js');

const ReactStub = {
	createElement() {},
	Fragment: Symbol('Fragment'),
	useState() {},
	useEffect() {},
	useMemo() {},
	useRef() {},
	useCallback() {},
};

test('client factory registers the right Sidebar page, guide, and header without a left Sidebar footer entry', () => {
	assert.equal(loaded.id, '@local/dsh-source-control');
	const plugin = loaded.factory((name) => {
		if (name === 'react') return ReactStub;
		throw new Error(`unexpected module: ${name}`);
	});
	assert.deepEqual(plugin.inject, ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs']);

	const registrations = [];
	const effects = [];
	const ctx = {
		effect(fn, label) {
			effects.push(label);
			const dispose = fn();
			if (typeof dispose === 'function') dispose();
		},
		locale: {
			register(namespace, dictionaries) {
				registrations.push(['locale', namespace, Object.keys(dictionaries).sort().join(',')]);
				return () => {};
			},
			bind() {
				return (key) => key;
			},
		},
		sidebarRightTabs: {
			register(definition) {
				registrations.push(['tab', definition.id, definition.kind]);
				return () => {};
			},
		},
		sidebarRight: {
			openTab(kind) {
				registrations.push(['open', kind]);
			},
		},
		slots: {
			inject(slot, callback) {
				registrations.push(['inject', slot]);
				callback();
				return () => {};
			},
			register(options, component) {
				registrations.push(['register', options.name, options.id ?? options.key, typeof component]);
				return () => {};
			},
		},
	};

	plugin.apply(ctx);

	assert.deepEqual(
		registrations.filter((entry) => entry[0] === 'tab' || entry[0] === 'register'),
		[
			['tab', '@local/dsh-source-control/page', 'source-control'],
			['register', 'sidebar.right.pane.tab', '@local/dsh-source-control/page', 'function'],
			['register', 'sidebar.right.tab.guide.entry', '@local/dsh-source-control/page', 'function'],
			['register', 'conversation.session.header.actions', 'source-control', 'function'],
		],
	);
	assert.deepEqual(
		registrations.filter((entry) => entry[0] === 'inject').map((entry) => entry[1]),
		[
			'sidebar.right.pane.tab',
			'sidebar.right.tab.guide.entry',
			'conversation.session.header.actions',
		],
	);
	assert.deepEqual(effects, ['source-control: styles', 'source-control: dictionaries', 'source-control: right Sidebar tab type']);
});
