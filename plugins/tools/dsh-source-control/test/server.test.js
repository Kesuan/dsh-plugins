import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';
import {
	confinePath,
	commitChanges,
	discoverRepo,
	initRepo,
	parsePorcelainV2,
	readCommit,
	readDiff,
	readHistory,
	readStatus,
	stagePaths,
	syncRepo,
	unstagePaths,
} from '../server.js';

/**
 * A subprocess handle backed by a real local Git child.
 *
 * The plugin only depends on the Host `subprocess` seam, so the tests provide
 * the same narrow face over `node:child_process` and exercise the real parser
 * and argv builder against a disposable repository.
 */
function spawnHandle(spec) {
	const child = spawn(spec.argv[0], spec.argv.slice(1), {
		cwd: spec.cwd,
		env: { ...process.env, ...spec.env },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	let stdout = '';
	let stderr = '';
	let stdoutLossy = false;
	const max = spec.stdio?.stdout?.maxBytes ?? 8 * 1024 * 1024;
	child.stdout.on('data', (chunk) => {
		if (stdout.length + chunk.length > max) {
			stdoutLossy = true;
			stdout += chunk.toString('utf8').slice(0, Math.max(0, max - stdout.length));
		} else {
			stdout += chunk.toString('utf8');
		}
	});
	child.stderr.on('data', (chunk) => {
		stderr += chunk.toString('utf8');
	});
	const done = new Promise((resolve, reject) => {
		child.on('error', reject);
		child.on('close', (code, signal) => resolve({ exitCode: code, signal }));
	});
	let read = false;
	return {
		done,
		collected: {
			stdout: {
				readFrom() {
					if (read) return { text: '', nextOffset: stdout.length, lossy: stdoutLossy };
					read = true;
					return { text: stdout, nextOffset: stdout.length, lossy: stdoutLossy };
				},
			},
			stderr: {
				readFrom() {
					return { text: stderr, nextOffset: stderr.length, lossy: false };
				},
			},
		},
		terminate() {
			child.kill('SIGTERM');
		},
	};
}

/** A context shaped like the Host services the plugin consumes. */
function makeCtx(cwd, sessionId = 'test-session') {
	return {
		sessions: {
			get(id) {
				return id === sessionId ? { header: { cwd } } : undefined;
			},
		},
		get() {
			return undefined;
		},
		subprocess: {
			async resolveExecutable(command) {
				return command;
			},
			spawn: spawnHandle,
		},
	};
}

/** Run one Git command in a fixture, for setup only. */
function run(cwd, args) {
	const result = spawnHandle({
		argv: ['git', ...args],
		cwd,
		env: {},
		stdio: { stdout: { maxBytes: 8 * 1024 * 1024 }, stderr: { maxBytes: 8 * 1024 * 1024 } },
	});
	return result.done.then(() => result.collected.stdout.readFrom(0).text);
}

/** Create a repository with a configured identity and one commit. */
async function repoFixture() {
	const root = mkdtempSync(join(tmpdir(), 'dsh-source-control-'));
	await run(root, ['init', '-q', '-b', 'main']);
	await run(root, ['config', 'user.email', 'test@example.com']);
	await run(root, ['config', 'user.name', 'Test User']);
	writeFileSync(join(root, 'a.txt'), 'hello\n');
	mkdirSync(join(root, 'dir'));
	writeFileSync(join(root, 'dir', 'b.txt'), 'world\n');
	await run(root, ['add', '-A']);
	await run(root, ['commit', '-q', '-m', 'initial commit']);
	return root;
}

test('parsePorcelainV2 separates staged, unstaged, untracked, and rename records', () => {
	const output =
		'# branch.oid 0123456789abcdef0123456789abcdef01234567\0' +
		'# branch.head main\0' +
		'# branch.upstream origin/main\0' +
		'# branch.ab +2 -3\0' +
		'1 M. N... 100644 100644 100644 aaaaaaa bbbbbbb src/main.js\0' +
		'1 .M N... 100644 100644 100644 aaaaaaa bbbbbbb src/main.js\0' +
		'2 R. N... 100644 100644 100644 aaaaaaa bbbbbbb R100 new name.js\0old name.js\0' +
		'? untracked file.md\0';
	const parsed = parsePorcelainV2(output);
	assert.equal(parsed.branch.branch, 'main');
	assert.equal(parsed.branch.upstream, 'origin/main');
	assert.equal(parsed.branch.ahead, 2);
	assert.equal(parsed.branch.behind, 3);
	assert.deepEqual(
		parsed.entries.map((entry) => [entry.path, entry.stage, entry.index]),
		[
			['src/main.js', 'staged', 'M'],
			['src/main.js', 'unstaged', 'M'],
			['new name.js', 'staged', 'R'],
			['untracked file.md', 'untracked', '?'],
		],
	);
	assert.equal(parsed.entries[2].origPath, 'old name.js');
});

test('confinePath rejects escapes and accepts nested repository paths', () => {
	assert.equal(confinePath('src/main.js'), 'src/main.js');
	assert.equal(confinePath('./src//main.js'), 'src/main.js');
	assert.throws(() => confinePath('../secret'), /escapes/);
	assert.throws(() => confinePath('/etc/passwd'), /not a repository-relative path/);
	assert.throws(() => confinePath('C:/secret'), /not a repository-relative path/);
	assert.throws(() => confinePath(''), /required/);
});

test('status, stage, commit, history, commit detail, and diff use the real repository', async () => {
	const root = await repoFixture();
	const ctx = makeCtx(root);
	const session = 'test-session';
	try {
		const clean = await readStatus(ctx, session);
		assert.equal(clean.repo.name, basename(root));
		assert.equal(clean.repo.branch, 'main');
		assert.equal(clean.counts.total, 0);

		writeFileSync(join(root, 'a.txt'), 'hello again\n');
		writeFileSync(join(root, 'new.txt'), 'new file\n');
		const dirty = await readStatus(ctx, session);
		assert.equal(dirty.counts.unstaged, 1);
		assert.equal(dirty.counts.untracked, 1);

		const staged = await stagePaths(ctx, session, ['a.txt', 'new.txt']);
		assert.equal(staged.counts.staged, 2);
		assert.equal(staged.counts.unstaged, 0);

		const committed = await commitChanges(ctx, session, { message: 'update files' });
		assert.equal(committed.status.counts.total, 0);
		assert.equal(typeof committed.commit.hash, 'string');
		assert.match(committed.commit.hash, /^[0-9a-f]+$/);

		const history = await readHistory(ctx, session, { limit: 10 });
		assert.equal(history.commits.length, 2);
		assert.equal(history.commits[0].subject, 'update files');
		assert.equal(history.commits[1].subject, 'initial commit');
		assert.equal(history.commits[0].parents.length, 1);

		const detail = await readCommit(ctx, session, history.commits[0].hash);
		assert.equal(detail.commit.subject, 'update files');
		assert.deepEqual(
			detail.files.map((file) => [file.status, file.path]).sort(),
			[
				['A', 'new.txt'],
				['M', 'a.txt'],
			],
		);

		const commitDiff = await readDiff(ctx, session, {
			path: 'a.txt',
			stage: 'commit',
			rev: history.commits[0].hash,
		});
		assert.match(commitDiff.diff, /-hello/);
		assert.match(commitDiff.diff, /\+hello again/);

		writeFileSync(join(root, 'a.txt'), 'hello unstaged\n');
		const unstaged = await readDiff(ctx, session, { path: 'a.txt', stage: 'unstaged' });
		assert.match(unstaged.diff, /\+hello unstaged/);

		writeFileSync(join(root, 'untracked.txt'), 'untracked content\n');
		const untracked = await readDiff(ctx, session, { path: 'untracked.txt', stage: 'untracked' });
		assert.match(untracked.diff, /\+untracked content/);

		await stagePaths(ctx, session, ['a.txt']);
		const restored = await unstagePaths(ctx, session, ['a.txt']);
		assert.equal(restored.counts.staged, 0);
		assert.equal(restored.counts.unstaged, 1);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('a workspace outside Git answers with no repository', async () => {
	const root = mkdtempSync(join(tmpdir(), 'dsh-source-control-plain-'));
	const ctx = makeCtx(root);
	try {
		const status = await readStatus(ctx, 'test-session');
		assert.equal(status.repo, null);
		assert.deepEqual(status.entries, []);
		assert.equal(await discoverRepo(ctx, root), null);
		await assert.rejects(() => readHistory(ctx, 'test-session'), /not a Git repository/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('initRepo turns a plain workspace into a repository', async () => {
	const root = mkdtempSync(join(tmpdir(), 'dsh-source-control-init-'));
	const ctx = makeCtx(root);
	try {
		const status = await initRepo(ctx, 'test-session');
		assert.equal(status.repo.name.length > 0, true);
		assert.equal(status.repo.unborn, true);
		writeFileSync(join(root, 'first.txt'), 'first file\n');
		const staged = await stagePaths(ctx, 'test-session', ['first.txt']);
		assert.equal(staged.counts.staged, 1);
		const unstaged = await unstagePaths(ctx, 'test-session', ['first.txt']);
		assert.equal(unstaged.counts.staged, 0);
		assert.equal(unstaged.counts.untracked, 1);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('readCommit handles the root commit and rename records', async () => {
	const root = await repoFixture();
	const ctx = makeCtx(root);
	try {
		const first = await readHistory(ctx, 'test-session', { limit: 10 });
		const rootDetail = await readCommit(ctx, 'test-session', first.commits[0].hash);
		assert.deepEqual(
			rootDetail.files.map((file) => [file.status, file.path]).sort(),
			[
				['A', 'a.txt'],
				['A', 'dir/b.txt'],
			],
		);
		await run(root, ['mv', 'a.txt', 'renamed.txt']);
		await run(root, ['commit', '-q', '-m', 'rename a file']);
		const after = await readHistory(ctx, 'test-session', { limit: 10 });
		const renameDetail = await readCommit(ctx, 'test-session', after.commits[0].hash);
		const renamed = renameDetail.files.find((file) => file.path === 'renamed.txt');
		assert.equal(renamed.status, 'R');
		assert.equal(renamed.origPath, 'a.txt');
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});


test('sync refuses a branch with no upstream instead of choosing a strategy', async () => {
	const root = await repoFixture();
	const ctx = makeCtx(root);
	try {
		await assert.rejects(
			() => syncRepo(ctx, 'test-session', 'sync'),
			/no upstream/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
