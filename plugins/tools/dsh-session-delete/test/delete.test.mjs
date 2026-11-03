import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { deleteSession, SessionDeleteError } from '../delete.js';

const ID = 'session-11111111-1111-4111-8111-111111111111';

/**
 * Build one disposable Session store plus a fake Host context.
 * @param options - fixture variations.
 * @returns paths, call log, and the fake context.
 */
async function fixture({ live = false, stored = true, locateOutside = false, archived = false } = {}) {
	const tmp = await mkdtemp(path.join(os.tmpdir(), 'dsh-session-delete-'));
	const root = path.join(tmp, 'sessions');
	const project = path.join(root, '--tmp-project--');
	const dir = path.join(project, ID);
	await mkdir(dir, { recursive: true });
	await writeFile(path.join(dir, 'session.v4.jsonl.zstd'), 'x'.repeat(128));
	await writeFile(path.join(dir, 'session.lock'), '');

	const cacheDir = path.join(tmp, 'storages', 'session_projcache', 'sessions');
	await mkdir(cacheDir, { recursive: true });
	const cache = path.join(cacheDir, `${ID}.json`);
	await writeFile(cache, '{}');

	const calls = [];
	const ctx = {
		sessions: { get: (id) => (live && id === ID ? { id } : undefined) },
		sessionPersistence: {
			root,
			stat: async (id) => (stored && id === ID ? { header: { id, cwd: '/tmp/project' } } : undefined),
			locate: () => ({
				path: locateOutside
					? path.join(tmp, 'outside', ID, 'session.v4.jsonl.zstd')
					: path.join(dir, 'session.v4.jsonl.zstd'),
			}),
		},
		workspaceRegistry: {
			archivedSessionIds: archived ? [ID] : [],
			archiveSession: async (id, options) => {
				calls.push(['archive', id, options]);
			},
			unarchiveSession: async (id) => {
				calls.push(['unarchive', id]);
			},
			unpinSession: async (id) => {
				calls.push(['unpin', id]);
			},
		},
		parallel: async (event, request) => {
			calls.push(['parallel', event, request]);
		},
	};
	return { tmp, root, dir, cache, calls, ctx };
}

test('deletes a cold Session, its checkpoint, and releases ids', async () => {
	const f = await fixture();
	const result = await deleteSession(f.ctx, ID);
	assert.equal(result.freedBytes, 128);
	assert.equal(result.cacheRemoved, true);
	await assert.rejects(stat(f.dir));
	await assert.rejects(stat(f.cache));
	assert.deepEqual(f.calls[0], ['archive', ID, { stopActivity: true }]);
	assert.deepEqual(f.calls.at(-2), ['unarchive', ID]);
	assert.deepEqual(f.calls.at(-1), ['unpin', ID]);
	await rm(f.tmp, { recursive: true, force: true });
});

test('refuses a Session the Host still has open', async () => {
	const f = await fixture({ live: true });
	await assert.rejects(deleteSession(f.ctx, ID), (error) => {
		assert.ok(error instanceof SessionDeleteError);
		assert.equal(error.code, 'live');
		return true;
	});
	await stat(f.dir);
	assert.deepEqual(f.calls, []);
	await rm(f.tmp, { recursive: true, force: true });
});

test('reports a stored Session that is already gone', async () => {
	const f = await fixture({ stored: false });
	await assert.rejects(deleteSession(f.ctx, ID), (error) => {
		assert.ok(error instanceof SessionDeleteError);
		assert.equal(error.code, 'not-found');
		return true;
	});
	await rm(f.tmp, { recursive: true, force: true });
});

test('rejects malformed ids before touching the store', async () => {
	const f = await fixture();
	await assert.rejects(deleteSession(f.ctx, 'session-nope'), (error) => {
		assert.ok(error instanceof SessionDeleteError);
		assert.equal(error.code, 'invalid');
		return true;
	});
	await stat(f.dir);
	await rm(f.tmp, { recursive: true, force: true });
});

test('fails closed when the located directory escapes the persistence root', async () => {
	const f = await fixture({ locateOutside: true });
	await assert.rejects(deleteSession(f.ctx, ID), (error) => {
		assert.ok(error instanceof SessionDeleteError);
		assert.equal(error.code, 'layout');
		return true;
	});
	await stat(f.dir);
	assert.deepEqual(f.calls.at(-1), ['unarchive', ID]);
	await rm(f.tmp, { recursive: true, force: true });
});

test('does not archive again when the Session is already archived', async () => {
	const f = await fixture({ archived: true });
	const result = await deleteSession(f.ctx, ID);
	assert.equal(result.freedBytes, 128);
	assert.equal(f.calls.some(([kind]) => kind === 'archive'), false);
	assert.deepEqual(
		f.calls.find(([kind]) => kind === 'parallel'),
		['parallel', 'workspace/session-stop', { sessionId: ID }],
	);
	await rm(f.tmp, { recursive: true, force: true });
});
