/**
 * Permanent Session deletion, implemented as out-of-band maintenance.
 *
 * The Session persistence seam is append-only and deliberately exposes no
 * delete operation, so this module removes the stored Session directory itself.
 * It never touches a live Session: the request fails while the Host still has
 * the Session open, and it archives first so the durable archive gate blocks
 * any wake-up that a stop provider might induce.
 */
import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

/** The only Session id shape this build produces. */
const SESSION_ID = /^session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A deletion failure with a stable code the HTTP layer can map to a status. */
export class SessionDeleteError extends Error {
	/**
	 * @param code - machine-readable failure kind.
	 * @param message - human-readable explanation.
	 */
	constructor(code, message) {
		super(message);
		this.name = 'SessionDeleteError';
		this.code = code;
	}
}

/**
 * @param value - candidate Session id.
 * @returns whether the value has the exact id shape.
 */
export function isSessionId(value) {
	return typeof value === 'string' && SESSION_ID.test(value);
}

/**
 * @param target - filesystem path.
 * @returns whether the path exists.
 */
async function exists(target) {
	try {
		await stat(target);
		return true;
	} catch {
		return false;
	}
}

/**
 * Sum the bytes of a directory tree. Best-effort: an unreadable entry counts 0
 * rather than preventing the deletion.
 * @param directory - directory to measure.
 * @returns total bytes of regular files.
 */
async function directorySize(directory) {
	let entries;
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		return 0;
	}
	let total = 0;
	for (const entry of entries) {
		const target = path.join(directory, entry.name);
		if (entry.isDirectory()) total += await directorySize(target);
		else if (entry.isFile()) {
			try {
				total += (await stat(target)).size;
			} catch {
				// A file that vanishes while we measure still gets removed below.
			}
		}
	}
	return total;
}

/**
 * Ask the JSONL backend where the stored Session lives. `locate` is a backend
 * feature rather than a seam method, so callers must tolerate its absence.
 * @param backend - the composed Session persistence service.
 * @param header - the stored Session header.
 * @returns the Session-owned directory, or undefined.
 */
function locateSessionDirectory(backend, header) {
	if (typeof backend.locate !== 'function') return undefined;
	try {
		const located = backend.locate(header);
		if (located !== undefined && typeof located.path === 'string') return path.dirname(located.path);
	} catch {
		// Fall through to the layout scan.
	}
	return undefined;
}

/**
 * Find `<root>/<project>/<sessionId>` without reimplementing the readable
 * project-directory encoding.
 * @param root - the persistence root.
 * @param sessionId - the Session to find.
 * @returns the Session directory, or undefined.
 */
async function scanSessionDirectory(root, sessionId) {
	let entries;
	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch {
		return undefined;
	}
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const candidate = path.join(root, entry.name, sessionId);
		if (!(await exists(candidate))) continue;
		if ((await stat(candidate)).isDirectory()) return candidate;
	}
	return undefined;
}

/**
 * Keep the removal inside the persistence root and on the exact
 * `<root>/<project>/<sessionId>` layout.
 * @param root - the persistence root.
 * @param directory - the candidate Session directory.
 * @param sessionId - the Session being deleted.
 * @returns the resolved, validated directory.
 */
function assertSafeSessionDirectory(root, directory, sessionId) {
	const resolvedRoot = path.resolve(root);
	const resolvedDirectory = path.resolve(directory);
	if (path.basename(resolvedDirectory) !== sessionId) {
		throw new SessionDeleteError('layout', 'refusing to delete a directory that is not the Session directory');
	}
	if (path.dirname(path.dirname(resolvedDirectory)) !== resolvedRoot) {
		throw new SessionDeleteError('layout', 'refusing to delete a directory outside the persistence root layout');
	}
	if (!resolvedDirectory.startsWith(resolvedRoot + path.sep)) {
		throw new SessionDeleteError('layout', 'refusing to delete a directory outside the persistence root');
	}
	return resolvedDirectory;
}

/**
 * Permanently delete one Session: archive to gate wake-ups, remove the stored
 * directory and its projection checkpoint, then release archive/pin bookkeeping.
 *
 * The Session must not be open in this Host. The caller is responsible for
 * user confirmation; this function performs no prompting.
 * @param ctx - Host context.
 * @param sessionId - the Session to delete.
 * @returns freed bytes and whether a projection checkpoint was removed.
 * @throws {SessionDeleteError} for invalid, live, missing, layout, or I/O failures.
 */
export async function deleteSession(ctx, sessionId) {
	if (!isSessionId(sessionId)) throw new SessionDeleteError('invalid', 'malformed Session id');
	if (ctx.sessions.get(sessionId) !== undefined) {
		throw new SessionDeleteError('live', 'the Session is still open; close it before deleting');
	}

	let snapshot;
	try {
		snapshot = await ctx.sessionPersistence.stat(sessionId);
	} catch (error) {
		throw new SessionDeleteError('io', error instanceof Error ? error.message : String(error));
	}
	if (snapshot === undefined) throw new SessionDeleteError('not-found', 'the Session is not stored');

	const alreadyArchived = ctx.workspaceRegistry.archivedSessionIds.includes(sessionId);
	if (!alreadyArchived) {
		try {
			await ctx.workspaceRegistry.archiveSession(sessionId, { stopActivity: true });
		} catch (error) {
			throw new SessionDeleteError('archive', error instanceof Error ? error.message : String(error));
		}
	} else if (typeof ctx.parallel === 'function') {
		// `archiveSession` is a no-op for an already archived id, so ask the
		// stop providers directly; the durable archive set already gates wakes.
		try {
			await ctx.parallel('workspace/session-stop', { sessionId });
		} catch (error) {
			const failures = error instanceof AggregateError ? error.errors : [error];
			for (const failure of failures) console.warn(`[session-delete] stop provider failed: ${String(failure)}`);
		}
	}

	try {
		// A Client may have opened the Session while archive was stopping work.
		if (ctx.sessions.get(sessionId) !== undefined) {
			throw new SessionDeleteError('live', 'the Session was opened while deletion was preparing');
		}

		const backend = ctx.sessionPersistence;
		const root = typeof backend.root === 'string' ? backend.root : undefined;
		if (root === undefined) throw new SessionDeleteError('layout', 'the persistence backend exposes no root');

		let directory = locateSessionDirectory(backend, snapshot.header);
		if (directory === undefined) directory = await scanSessionDirectory(root, sessionId);
		if (directory === undefined) throw new SessionDeleteError('layout', 'the stored Session directory was not found');

		const safeDirectory = assertSafeSessionDirectory(root, directory, sessionId);
		const freedBytes = await directorySize(safeDirectory);
		await rm(safeDirectory, { recursive: true, force: true });
		if (await exists(safeDirectory)) {
			throw new SessionDeleteError('io', 'the Session directory still exists after removal');
		}

		let cacheRemoved = false;
		const home = path.dirname(path.resolve(root));
		const checkpoint = path.join(home, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`);
		if (await exists(checkpoint)) {
			try {
				await rm(checkpoint, { force: true });
				cacheRemoved = true;
			} catch {
				// A stale projection checkpoint is harmless; the Session is gone.
			}
		}

		await ctx.workspaceRegistry.unarchiveSession(sessionId).catch(() => undefined);
		await ctx.workspaceRegistry.unpinSession(sessionId).catch(() => undefined);
		return { freedBytes, cacheRemoved };
	} catch (error) {
		if (!alreadyArchived) await ctx.workspaceRegistry.unarchiveSession(sessionId).catch(() => undefined);
		throw error;
	}
}
