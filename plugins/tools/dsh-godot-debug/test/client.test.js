import assert from 'node:assert/strict';
import test from 'node:test';

test('client module registers the right Sidebar preview type and conditional header entry', async () => {
	let definition;
	globalThis.window = {
		__ModuleLoader__: {
			load(value) {
				definition = value;
			},
		},
	};
	await import('../client.js');

	assert.equal(definition.id, '@local/dsh-godot-debug');
	const React = {
		createElement() {
			return {};
		},
	};
	const plugin = definition.factory(() => React);

	let dictionaries;
	let tabDefinition;
	let openedKind;
	const registrations = [];
	const disposers = [];
	const ctx = {
		locale: {
			register(namespace, dicts) {
				assert.equal(namespace, 'godotPreview');
				dictionaries = dicts;
				return () => {};
			},
			bind() {
				return (key) => key;
			},
		},
		sidebarRightTabs: {
			register(value) {
				tabDefinition = value;
				return () => {};
			},
		},
		sidebarRight: {
			openTab(kind) {
				openedKind = kind;
			},
		},
		slots: {
			inject(name, install) {
				disposers.push(install());
			},
			register(options, component) {
				registrations.push({ options, component });
				return () => {};
			},
		},
		effect(setup) {
			disposers.push(setup());
		},
	};

	plugin.apply(ctx);

	assert.deepEqual(Object.keys(dictionaries.en).sort(), Object.keys(dictionaries.zh).sort());
	assert.equal(tabDefinition.id, '@local/dsh-godot-debug/preview');
	assert.equal(tabDefinition.kind, 'godotPreview');
	assert.equal(tabDefinition.keepMounted, true);
	assert.equal(typeof tabDefinition.title, 'function');
	assert.equal(tabDefinition.title(), 'tabTitle');
	assert.equal(tabDefinition.guide.length, 1);
	assert.equal(tabDefinition.guide[0].id, 'godot-preview');
	assert.equal(tabDefinition.guide[0].title(), 'tabTitle');

	const tab = registrations.find((entry) => entry.options.name === 'sidebar.right.pane.tab');
	const guide = registrations.find((entry) => entry.options.name === 'sidebar.right.tab.guide.entry');
	const header = registrations.find((entry) => entry.options.name === 'conversation.session.header.actions');
	assert.equal(tab.options.key, '@local/dsh-godot-debug/preview');
	assert.equal(typeof tab.component, 'function');
	assert.equal(guide.options.key, '@local/dsh-godot-debug/preview');
	assert.equal(typeof guide.component, 'function');
	assert.equal(header.options.id, 'godot-preview');
	assert.equal(typeof header.component, 'function');
	header.options.inject().openPreview();
	assert.equal(openedKind, 'godotPreview');
	assert.equal(registrations.some((entry) => entry.options.name === 'main'), false);
	assert.equal(registrations.some((entry) => entry.options.name === 'sidebar.panellist'), false);
});
