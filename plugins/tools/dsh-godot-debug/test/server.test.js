import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildGodotArgv, findGodotProject, GodotDebugController, GodotDebugError, readViewportSize } from '../server.js';

/** Build a project directory that passes Host-side validation. */
function projectFixture() {
	const root = mkdtempSync(join(tmpdir(), 'dsh-godot-debug-'));
	writeFileSync(join(root, 'project.godot'), 'config_version=5\n');
	return root;
}

test('findGodotProject resolves the nearest project ancestor', () => {
	const root = projectFixture();
	const nested = join(root, 'scenes', 'level');
	mkdirSync(nested, { recursive: true });
	try {
		assert.equal(findGodotProject(nested), root);
		assert.equal(findGodotProject(root), root);
		assert.equal(findGodotProject('/'), undefined);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('readViewportSize reads the authored design resolution, not the window override', () => {
	const root = mkdtempSync(join(tmpdir(), 'dsh-godot-debug-'));
	writeFileSync(
		join(root, 'project.godot'),
		'config_version=5\n\n[display]\n\nwindow/size/viewport_width=1080\nwindow/size/viewport_height=2340\nwindow/size/window_width_override=432\nwindow/size/window_height_override=936\n',
	);
	try {
		assert.deepEqual(readViewportSize(root), { width: 1080, height: 2340 });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('readViewportSize falls back to the Godot default without a display section', () => {
	const root = projectFixture();
	try {
		assert.deepEqual(readViewportSize(root), { width: 1152, height: 648 });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('readViewportSize ignores malformed and non-positive values', () => {
	const root = mkdtempSync(join(tmpdir(), 'dsh-godot-debug-'));
	writeFileSync(
		join(root, 'project.godot'),
		'[display]\n\nwindow/size/viewport_width=0\nwindow/size/viewport_height=abc\n',
	);
	try {
		assert.deepEqual(readViewportSize(root), { width: 1152, height: 648 });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

/** A reader whose retained text stays fixed and whose offset advances. */
function reader(text) {
	let returned = false;
	return {
		readFrom() {
			if (returned) return { text: '', nextOffset: text.length, lossy: false };
			returned = true;
			return { text, nextOffset: text.length, lossy: false };
		},
	};
}

/** A subprocess handle that settles when terminated. */
function fakeHandle({ stdout = '', stderr = '' } = {}) {
	let settle;
	const done = new Promise((resolve) => {
		settle = resolve;
	});
	return {
		stdout: undefined,
		stderr: undefined,
		stdin: undefined,
		control: undefined,
		collected: { stdout: reader(stdout), stderr: reader(stderr) },
		done,
		terminated: false,
		terminate() {
			this.terminated = true;
			settle({ exitCode: null, signal: 'SIGTERM' });
		},
		waitForExit: async () => true,
	};
}

test('buildGodotArgv places project flags after the user-argument separator', () => {	const argv = buildGodotArgv({
		executable: '/Applications/Godot.app/Contents/MacOS/Godot',
		projectPath: '/tmp/project',
		debug: true,
		devHud: true,
		skipIntro: true,
		extraArgs: ['--speed=2'],
	});
	assert.deepEqual(argv, [
		'/Applications/Godot.app/Contents/MacOS/Godot',
		'--path',
		'/tmp/project',
		'--debug',
		'--',
		'--dev-hud',
		'--skip-intro',
		'--speed=2',
	]);
});

test('buildGodotArgv omits the separator when there are no game arguments', () => {
	const argv = buildGodotArgv({
		executable: '/Godot',
		projectPath: '/tmp/project',
		debug: false,
	});
	assert.deepEqual(argv, ['/Godot', '--path', '/tmp/project']);
});

test('controller starts, captures both streams, and stops the process', async () => {
	const projectPath = projectFixture();
	let spawned;
	const handle = fakeHandle({ stdout: 'Godot Engine v4.8\n', stderr: 'SCRIPT ERROR: bad thing\n' });
	const ctx = {
		subprocess: {
			resolveExecutable: async (command) => command,
			spawn: (spec) => {
				spawned = spec;
				return handle;
			},
		},
	};
	const controller = new GodotDebugController(ctx, {
		projectPath,
		godotExecutable: '/Applications/Godot.app/Contents/MacOS/Godot',
	});
	try {
		const started = await controller.start({ devHud: true });
		assert.equal(started.state.status, 'running');
		assert.equal(started.state.generation, 1);
		assert.equal(spawned.cwd, projectPath);
		assert.deepEqual(spawned.argv.slice(-2), ['--', '--dev-hud']);

		const output = controller.snapshot(0);
		assert.match(output.logs.map((entry) => entry.text).join(''), /Godot Engine v4\.8/);
		assert.match(output.logs.map((entry) => entry.text).join(''), /SCRIPT ERROR: bad thing/);

		const stopped = await controller.stop();
		assert.equal(handle.terminated, true);
		assert.equal(stopped.state.status, 'stopped');
		assert.ok(stopped.state.endedAt !== null);
	} finally {
		controller.dispose();
		rmSync(projectPath, { recursive: true, force: true });
	}
});

test('controller restarts with a fresh generation and a new process', async () => {
	const projectPath = projectFixture();
	const handles = [fakeHandle({ stdout: 'first\n' }), fakeHandle({ stdout: 'second\n' })];
	let spawned = 0;
	const controller = new GodotDebugController(
		{
			subprocess: {
				resolveExecutable: async (command) => command,
				spawn: () => handles[spawned++],
			},
		},
		{ projectPath, godotExecutable: '/Godot' },
	);
	try {
		await controller.start({});
		const restarted = await controller.restart({});
		assert.equal(restarted.state.status, 'running');
		assert.equal(restarted.state.generation, 2);
		assert.equal(handles[0].terminated, true);
		assert.equal(spawned, 2);
		assert.match(restarted.logs.map((entry) => entry.text).join(''), /second/);
	} finally {
		await controller.stop();
		controller.dispose();
		rmSync(projectPath, { recursive: true, force: true });
	}
});

test('controller rejects a directory without project.godot', async () => {
	const projectPath = mkdtempSync(join(tmpdir(), 'dsh-godot-debug-empty-'));
	const controller = new GodotDebugController(
		{ subprocess: { resolveExecutable: async (command) => command, spawn: () => fakeHandle() } },
		{ projectPath, godotExecutable: '/Godot' },
	);
	try {
		await assert.rejects(
			() => controller.start({}),
			(error) => error instanceof GodotDebugError && error.code === 'project-not-found',
		);
	} finally {
		controller.dispose();
		rmSync(projectPath, { recursive: true, force: true });
	}
});

test('controller refuses a second run while the first is active', async () => {
	const projectPath = projectFixture();
	const handle = fakeHandle();
	const controller = new GodotDebugController(
		{ subprocess: { resolveExecutable: async (command) => command, spawn: () => handle } },
		{ projectPath, godotExecutable: '/Godot' },
	);
	try {
		await controller.start({});
		await assert.rejects(
			() => controller.start({}),
			(error) => error instanceof GodotDebugError && error.code === 'already-running',
		);
	} finally {
		await controller.stop();
		controller.dispose();
		rmSync(projectPath, { recursive: true, force: true });
	}
});
