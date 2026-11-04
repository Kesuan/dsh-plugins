/**
 * Host half of the Source Control bundle.
 *
 * It answers a small, argv-only Git API under `/local/source-control` for the
 * current Session's workspace. The browser never supplies a filesystem path to
 * run against: the workspace comes from the Session header, and every path the
 * browser sends back is confined to the repository root before it reaches Git.
 *
 * Reads are cheap and read-only (`GIT_OPTIONAL_LOCKS=0`); the four mutations are
 * explicit user actions (stage, unstage, commit, sync/init) and require both a
 * same-origin request and the panel's own request header. The routes are bound to
 * loopback only, matching the desktop profile this panel is built for.
 */

import { basename } from 'node:path';

/** The prefix this plugin owns on the Host Web server. */
export const ROUTE_PREFIX = '/local/source-control';

/** Header that distinguishes a panel mutation from a cross-site form post. */
export const MUTATION_HEADER = 'x-dsh-source-control';

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_GIT_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_DIFF_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 5000;
const MAX_HISTORY = 100;
const DEFAULT_HISTORY = 30;
const MAX_MESSAGE_LENGTH = 10_000;
const MAX_SYNC_TIMEOUT_MS = 120_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const GIT_GRACE_MS = 5_000;

const RECORD_SEP = '\x1e';
const FIELD_SEP = '\x1f';

/** A named failure the API answers with a stable code and HTTP status. */
export class SourceControlError extends Error {
	/**
	 * @param {string} code - stable machine code.
	 * @param {string} message - user-facing detail.
	 * @param {{ status?: number, cause?: unknown }} [options]
	 */
	constructor(code, message, options = {}) {
		super(message, options.cause === undefined ? undefined : { cause: options.cause });
		this.name = 'SourceControlError';
		this.code = code;
		this.status = options.status ?? statusFor(code);
	}
}

/** Map a failure code to its HTTP status. */
function statusFor(code) {
	switch (code) {
		case 'bad-request':
		case 'session/unknown':
		case 'path/outside':
			return 400;
		case 'repo/not-found':
		case 'revision/not-found':
			return 404;
		case 'git/unavailable':
			return 503;
		case 'git/timeout':
			return 504;
		case 'commit/nothing-staged':
		case 'sync/diverged':
		case 'sync/no-upstream':
		case 'git/failed':
			return 409;
		default:
			return 500;
	}
}

/** Whether one peer address is the loopback interface. */
function isLoopbackAddress(address) {
	return (
		address === '127.0.0.1' ||
		address === '::1' ||
		address === '::ffff:127.0.0.1' ||
		address === '::ffff:7f00:1'
	);
}

/** Whether an Origin names this listener or the DSH desktop shell. */
function isAllowedOrigin(origin, expected) {
	if (origin === undefined) return true;
	if (origin === 'dsh-app://app' || origin === 'dsh-app://shell') return true;
	if (origin === expected) return true;
	try {
		const actual = new URL(origin);
		if (actual.protocol === 'dsh-app:' && (actual.hostname === 'app' || actual.hostname === 'shell')) {
			return true;
		}
		const target = new URL(expected);
		if (actual.port !== target.port) return false;
		return (
			actual.hostname === 'localhost' ||
			actual.hostname === '127.0.0.1' ||
			actual.hostname === '[::1]' ||
			actual.hostname === '::1'
		);
	} catch {
		return false;
	}
}

/** Write one JSON response, unless the socket has already gone. */
function sendJson(res, status, payload) {
	if (res.writableEnded || res.destroyed) return;
	const body = JSON.stringify(payload);
	res.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'content-length': String(Buffer.byteLength(body)),
		'cache-control': 'no-store',
	});
	res.end(body);
}

/** Read and parse one bounded JSON body. */
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		let size = 0;
		let failed = false;
		const chunks = [];
		req.on('data', (chunk) => {
			if (failed) return;
			size += chunk.length;
			if (size > MAX_BODY_BYTES) {
				failed = true;
				reject(new SourceControlError('bad-request', 'request body is too large'));
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => {
			if (failed) return;
			const text = Buffer.concat(chunks).toString('utf8');
			if (text.trim() === '') {
				resolve({});
				return;
			}
			try {
				const parsed = JSON.parse(text);
				if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
					reject(new SourceControlError('bad-request', 'request body must be a JSON object'));
					return;
				}
				resolve(parsed);
			} catch {
				reject(new SourceControlError('bad-request', 'request body is not valid JSON'));
			}
		});
		req.on('error', reject);
	});
}

/** Return the request's peer only when it is loopback and same-origin. */
function authorize(ctx, req, res, mutating) {
	if (!isLoopbackAddress(req.socket.remoteAddress)) {
		sendJson(res, 403, { ok: false, code: 'forbidden', message: 'local requests only' });
		return false;
	}
	const origin = req.headers.origin;
	if (origin !== undefined) {
		let expected;
		try {
			expected = ctx.webServer.getOrigin();
		} catch {
			expected = undefined;
		}
		if (expected === undefined || !isAllowedOrigin(origin, expected)) {
			sendJson(res, 403, { ok: false, code: 'forbidden', message: 'cross-origin request refused' });
			return false;
		}
	}
	if (mutating) {
		if (req.headers[MUTATION_HEADER] !== '1') {
			sendJson(res, 403, { ok: false, code: 'forbidden', message: `missing ${MUTATION_HEADER} header` });
			return false;
		}
		if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] ?? ''))) {
			sendJson(res, 415, { ok: false, code: 'content-type', message: 'application/json is required' });
			return false;
		}
	}
	return true;
}

/** Describe an unknown thrown value. */
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Run one Git command through the Host subprocess seam.
 *
 * A non-zero exit is returned to the caller as an outcome: asking whether a
 * directory is a repository, or whether a path changed, legitimately answers
 * "no". Only a missing executable, a cancellation, or a provider failure throws.
 *
 * @param {any} ctx - Host context carrying `subprocess`.
 * @param {object} request
 * @param {string} request.cwd - working directory.
 * @param {readonly string[]} request.argv - arguments after `git`.
 * @param {AbortSignal} [request.signal] - caller cancellation.
 * @param {number} [request.maxBytes] - stdout cap.
 * @param {number} [request.timeoutMs] - wall-clock cap.
 * @param {Record<string, string>} [request.env] - extra environment.
 */
export async function runGit(ctx, request) {
	const {
		cwd,
		argv,
		signal,
		maxBytes = MAX_GIT_OUTPUT_BYTES,
		timeoutMs = DEFAULT_TIMEOUT_MS,
		env = {},
	} = request;

	let executable;
	try {
		executable = await ctx.subprocess.resolveExecutable('git', undefined, signal);
	} catch (error) {
		throw new SourceControlError(
			'git/unavailable',
			`git is not available in this execution world: ${messageOf(error)}`,
			{ cause: error },
		);
	}

	const controller = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort(new Error('git timed out'));
	}, timeoutMs);
	const forwardAbort = () => controller.abort(signal?.reason);
	if (signal !== undefined) {
		if (signal.aborted) controller.abort(signal.reason);
		else signal.addEventListener('abort', forwardAbort, { once: true });
	}

	let handle;
	try {
		handle = ctx.subprocess.spawn({
			argv: [
				executable,
				'--no-pager',
				'-c',
				'core.quotepath=false',
				'-c',
				'color.ui=false',
				...argv,
			],
			cwd,
			env: {
				GIT_OPTIONAL_LOCKS: '0',
				GIT_TERMINAL_PROMPT: '0',
				...env,
			},
			stdio: {
				stdin: 'ignore',
				stdout: { maxBytes },
				// Kept small: nothing reads a diagnostic, and an undrained pipe can
				// block the child while a mutation waits for it.
				stderr: { maxBytes: 64 * 1024 },
			},
			graceMs: GIT_GRACE_MS,
			signal: controller.signal,
		});
	} catch (error) {
		clearTimeout(timer);
		signal?.removeEventListener('abort', forwardAbort);
		if (timedOut) {
			throw new SourceControlError('git/timeout', `git ${argv[0] ?? ''} timed out after ${timeoutMs}ms`);
		}
		if (signal?.aborted) {
			throw new SourceControlError('git/aborted', 'git command was cancelled', { status: 499 });
		}
		throw new SourceControlError('git/unavailable', `git could not be started: ${messageOf(error)}`, {
			cause: error,
		});
	}

	let outcome;
	try {
		outcome = await handle.done;
		if (timedOut) {
			throw new SourceControlError('git/timeout', `git ${argv[0] ?? ''} timed out after ${timeoutMs}ms`);
		}
	} catch (error) {
		clearTimeout(timer);
		signal?.removeEventListener('abort', forwardAbort);
		if (timedOut) {
			throw new SourceControlError('git/timeout', `git ${argv[0] ?? ''} timed out after ${timeoutMs}ms`);
		}
		if (signal?.aborted) {
			throw new SourceControlError('git/aborted', 'git command was cancelled', { status: 499 });
		}
		throw new SourceControlError('git/failed', `git reported no outcome: ${messageOf(error)}`, {
			cause: error,
		});
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener('abort', forwardAbort);
	}

	const stdout = handle.collected.stdout?.readFrom(0);
	const stderr = handle.collected.stderr?.readFrom(0);
	return {
		exitCode: outcome.exitCode,
		signal: outcome.signal,
		stdout: stdout?.text ?? '',
		stderr: stderr?.text ?? '',
		truncated: stdout?.lossy === true,
	};
}

/** Run one Git command that must succeed. */
async function git(ctx, cwd, argv, options = {}) {
	const result = await runGit(ctx, { cwd, argv, ...options });
	if (result.exitCode !== 0) {
		const detail = result.stderr.trim() === '' ? result.stdout.trim() : result.stderr.trim();
		throw new SourceControlError(
			'git/failed',
			`git ${argv[0] ?? ''} failed${detail === '' ? '' : `: ${detail}`}`,
		);
	}
	return result;
}

/** Validate a browser-supplied repository-relative path. */
export function confinePath(requested) {
	if (typeof requested !== 'string' || requested === '' || requested.includes('\0')) {
		throw new SourceControlError('path/outside', 'a repository-relative path is required');
	}
	const unified = process.platform === 'win32' ? requested.replace(/\\/g, '/') : requested;
	if (unified.startsWith('/') || /^[A-Za-z]:/.test(unified)) {
		throw new SourceControlError('path/outside', `"${requested}" is not a repository-relative path`);
	}
	const segments = [];
	for (const segment of unified.split('/')) {
		if (segment === '' || segment === '.') continue;
		if (segment === '..') {
			throw new SourceControlError('path/outside', `"${requested}" escapes the repository root`);
		}
		segments.push(segment);
	}
	if (segments.length === 0) {
		throw new SourceControlError('path/outside', `"${requested}" is not a repository-relative path`);
	}
	return segments.join('/');
}

/** Parse the branch header records from `git status --porcelain=v2 --branch`. */
function applyBranchHeader(field, branch) {
	const separator = field.indexOf(' ');
	const key = separator < 0 ? field : field.slice(0, separator);
	const value = separator < 0 ? '' : field.slice(separator + 1);
	switch (key) {
		case 'branch.oid':
			if (value !== '(initial)') branch.oid = value;
			else branch.unborn = true;
			break;
		case 'branch.head':
			if (value === '(detached)') branch.detached = true;
			else branch.branch = value;
			break;
		case 'branch.upstream':
			branch.upstream = value;
			break;
		case 'branch.ab': {
			const match = /^\+(\d+)\s+-(\d+)$/.exec(value);
			if (match !== null) {
				branch.ahead = Number(match[1]);
				branch.behind = Number(match[2]);
			}
			break;
		}
		default:
			break;
	}
}

/** Map one status letter to a stable change kind. */
export function kindOfLetter(letter) {
	switch (letter) {
		case 'M':
			return 'modified';
		case 'A':
			return 'added';
		case 'D':
			return 'deleted';
		case 'R':
			return 'renamed';
		case 'C':
			return 'copied';
		case 'T':
			return 'typechange';
		case 'U':
			return 'conflicted';
		default:
			return 'unknown';
	}
}

/**
 * Split a porcelain record into a fixed number of fields plus the path.
 * The path is the whole remainder, so names containing repeated spaces survive.
 */
function splitFixed(input, fieldCount) {
	const fields = [];
	let rest = input;
	for (let index = 0; index < fieldCount; index += 1) {
		const separator = rest.indexOf(' ');
		if (separator < 0) return null;
		fields.push(rest.slice(0, separator));
		rest = rest.slice(separator + 1);
	}
	fields.push(rest);
	return fields;
}

/** Append the entries one XY pair describes. */
function appendEntries(entries, path, xy, origPath) {
	const index = xy.charAt(0);
	const worktree = xy.charAt(1);
	const base = origPath === undefined ? { path } : { path, origPath };
	if (index !== '.') {
		entries.push({ ...base, index, stage: 'staged', kind: kindOfLetter(index) });
	}
	if (worktree !== '.') {
		entries.push({ ...base, index: worktree, stage: 'unstaged', kind: kindOfLetter(worktree) });
	}
}

/**
 * Parse one `git status --porcelain=v2 --branch -z` run.
 *
 * @param {string} output - NUL-separated status records.
 * @returns {{ branch: object, entries: object[] }}
 */
export function parsePorcelainV2(output) {
	const branch = {
		oid: null,
		branch: null,
		upstream: null,
		ahead: 0,
		behind: 0,
		detached: false,
		unborn: false,
	};
	const entries = [];
	const fields = output.split('\0');
	for (let index = 0; index < fields.length; index += 1) {
		const field = fields[index];
		if (field === undefined || field === '') continue;
		const kind = field.charAt(0);
		if (kind === '#') {
			applyBranchHeader(field.slice(2), branch);
			continue;
		}
		if (kind === '1') {
			const parts = splitFixed(field, 8);
			if (parts === null) continue;
			appendEntries(entries, parts[8], parts[1], undefined);
			continue;
		}
		if (kind === '2') {
			const parts = splitFixed(field, 9);
			const origPath = fields[index + 1];
			index += 1;
			if (parts === null || origPath === undefined) continue;
			appendEntries(entries, parts[9], parts[1], origPath);
			continue;
		}
		if (kind === 'u') {
			const parts = splitFixed(field, 10);
			if (parts === null) continue;
			const path = parts[10];
			const xy = parts[1];
			entries.push({
				path,
				index: xy.charAt(0),
				stage: 'conflicted',
				kind: 'conflicted',
			});
			continue;
		}
		if (kind === '?') {
			entries.push({
				path: field.slice(2),
				index: '?',
				stage: 'untracked',
				kind: 'untracked',
			});
		}
	}
	return { branch, entries };
}

/** Count entries by the group the panel renders. */
function countEntries(entries) {
	const counts = { staged: 0, unstaged: 0, untracked: 0, conflicted: 0, total: entries.length };
	for (const entry of entries) {
		if (entry.stage === 'staged') counts.staged += 1;
		else if (entry.stage === 'unstaged') counts.unstaged += 1;
		else if (entry.stage === 'untracked') counts.untracked += 1;
		else if (entry.stage === 'conflicted') counts.conflicted += 1;
	}
	return counts;
}

/** Normalize the branch facts the panel receives. */
function branchPayload(branch) {
	return {
		branch: branch.branch,
		upstream: branch.upstream,
		ahead: branch.ahead,
		behind: branch.behind,
		detached: branch.detached,
		unborn: branch.unborn,
		head: branch.oid === null ? null : branch.oid.slice(0, 7),
		oid: branch.oid,
	};
}

/** Resolve a Session's workspace root from its live or persisted header. */
export async function resolveSessionCwd(ctx, sessionId) {
	if (typeof sessionId !== 'string' || sessionId.trim() === '') {
		throw new SourceControlError('session/unknown', 'a Session id is required');
	}
	const live = ctx.sessions.get(sessionId)?.header?.cwd;
	let cwd = live;
	if (typeof cwd !== 'string' || cwd === '') {
		try {
			const stored = await ctx.get('sessionPersistence')?.stat(sessionId);
			cwd = stored?.header?.cwd;
		} catch {
			cwd = undefined;
		}
	}
	if (typeof cwd !== 'string' || cwd === '') {
		throw new SourceControlError(
			'session/unknown',
			`Session "${sessionId}" has no workspace, so its repository is unknown`,
		);
	}
	return cwd;
}

/** Find the repository owning a directory, or null when there is none. */
export async function discoverRepo(ctx, cwd, signal) {
	const result = await runGit(ctx, {
		cwd,
		argv: ['rev-parse', '--show-toplevel'],
		maxBytes: 64 * 1024,
		...(signal === undefined ? {} : { signal }),
	});
	if (result.exitCode !== 0) return null;
	const root = result.stdout.trim();
	if (root === '') return null;
	return { root, name: basename(root) };
}

/** Resolve the Session's repository, or return null. */
async function resolveRepo(ctx, sessionId, signal) {
	const cwd = await resolveSessionCwd(ctx, sessionId);
	return await discoverRepo(ctx, cwd, signal);
}

/** Require a repository for an endpoint that cannot answer without one. */
async function requireRepo(ctx, sessionId, signal) {
	const repo = await resolveRepo(ctx, sessionId, signal);
	if (repo === null) {
		throw new SourceControlError('repo/not-found', 'the Session workspace is not a Git repository');
	}
	return repo;
}

/**
 * Read the working tree's state.
 * @returns {Promise<object>} the status payload.
 */
export async function readStatus(ctx, sessionId, signal) {
	const cwd = await resolveSessionCwd(ctx, sessionId);
	const repo = await discoverRepo(ctx, cwd, signal);
	if (repo === null) {
		return {
			cwd,
			repo: null,
			entries: [],
			counts: { staged: 0, unstaged: 0, untracked: 0, conflicted: 0, total: 0 },
			truncated: false,
		};
	}
	const result = await git(ctx, repo.root, [
		'status',
		'--porcelain=v2',
		'--branch',
		'-z',
		'--untracked-files=all',
		'--ignore-submodules=none',
	], signal === undefined ? {} : { signal });
	const parsed = parsePorcelainV2(result.stdout);
	const entries = parsed.entries.slice(0, MAX_ENTRIES);
	return {
		cwd,
		repo: {
			root: repo.root,
			name: repo.name,
			...branchPayload(parsed.branch),
		},
		entries,
		counts: countEntries(entries),
		truncated: parsed.entries.length > MAX_ENTRIES,
	};
}

/** Split a `%D` decoration string into chips. */
function parseRefs(decorations) {
	if (typeof decorations !== 'string' || decorations.trim() === '') return [];
	return decorations
		.split(',')
		.map((ref) => ref.trim())
		.filter((ref) => ref !== '');
}

/**
 * Read one page of history.
 * @returns {Promise<object>} the history payload.
 */
export async function readHistory(ctx, sessionId, options = {}) {
	const repo = await requireRepo(ctx, sessionId, options.signal);
	const limit = Math.max(1, Math.min(MAX_HISTORY, Number(options.limit) || DEFAULT_HISTORY));
	const skip = Math.max(0, Number(options.skip) || 0);
	const result = await runGit(ctx, {
		cwd: repo.root,
		argv: [
			'log',
			'--date-order',
			'--max-count',
			String(limit + 1),
			'--skip',
			String(skip),
			'--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%D%x1f%P%x1e',
		],
		...(options.signal === undefined ? {} : { signal: options.signal }),
	});
	if (result.exitCode !== 0) {
		const detail = result.stderr.trim();
		if (/does not have any commits yet|ambiguous argument 'HEAD'|unknown revision/i.test(detail)) {
			return { repo, commits: [], hasMore: false, unborn: true };
		}
		throw new SourceControlError('git/failed', `git log failed${detail === '' ? '' : `: ${detail}`}`);
	}
	const records = result.stdout
		.split(RECORD_SEP)
		.map((record) => record.replace(/^\n+/, '').replace(/\n+$/, ''))
		.filter((record) => record !== '');
	const commits = [];
	for (const record of records.slice(0, limit)) {
		const fields = record.split(FIELD_SEP);
		if (fields.length < 8) continue;
		commits.push({
			hash: fields[0],
			short: fields[1],
			author: fields[2],
			authorEmail: fields[3],
			date: fields[4],
			subject: fields[5],
			refs: parseRefs(fields[6]),
			parents: fields[7].split(' ').filter((parent) => parent !== ''),
		});
	}
	return {
		repo,
		commits,
		hasMore: records.length > limit,
		unborn: false,
	};
}

/** Validate a commit revision before it reaches a Git argument. */
function confineRevision(rev) {
	if (typeof rev !== 'string' || !/^[0-9a-fA-F]{4,64}$/.test(rev)) {
		throw new SourceControlError('bad-request', 'a hexadecimal commit revision is required');
	}
	return rev;
}

/** Read one commit and its changed files. */
export async function readCommit(ctx, sessionId, rev, signal) {
	const repo = await requireRepo(ctx, sessionId, signal);
	const revision = confineRevision(rev);
	const shown = await git(ctx, repo.root, [
		'show',
		'-s',
		'--format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%D%x1f%P%x1f%B',
		revision,
	], signal === undefined ? {} : { signal });
	const fields = shown.stdout.split(FIELD_SEP);
	if (fields.length < 9) {
		throw new SourceControlError('revision/not-found', `commit "${rev}" has no readable metadata`);
	}
	const filesResult = await runGit(ctx, {
		cwd: repo.root,
		argv: [
			'diff-tree',
			'--root',
			'--no-commit-id',
			'--name-status',
			'-r',
			'-M',
			'-z',
			'--first-parent',
			revision,
		],
		...(signal === undefined ? {} : { signal }),
	});
	const files = [];
	if (filesResult.exitCode === 0) {
		const tokens = filesResult.stdout.split('\0');
		for (let index = 0; index < tokens.length; index += 1) {
			const status = tokens[index];
			if (status === undefined || status === '') continue;
			const letter = status.charAt(0);
			if (letter === 'R' || letter === 'C') {
				const origPath = tokens[index + 1];
				const path = tokens[index + 2];
				index += 2;
				if (origPath === undefined || path === undefined) continue;
				files.push({ status: letter, path, origPath, kind: kindOfLetter(letter) });
				continue;
			}
			const path = tokens[index + 1];
			index += 1;
			if (path === undefined) continue;
			files.push({ status: letter, path, kind: kindOfLetter(letter) });
		}
	}
	return {
		repo,
		commit: {
			hash: fields[0],
			short: fields[1],
			author: fields[2],
			authorEmail: fields[3],
			date: fields[4],
			subject: fields[5],
			refs: parseRefs(fields[6]),
			parents: fields[7].split(' ').filter((parent) => parent !== ''),
			body: fields.slice(8).join(FIELD_SEP).trim(),
		},
		files,
	};
}

/** Read a file's unified diff for one comparison. */
export async function readDiff(ctx, sessionId, request, signal) {
	const repo = await requireRepo(ctx, sessionId, signal);
	const path = confinePath(request.path);
	const stage = request.stage;
	if (!['staged', 'unstaged', 'untracked', 'commit'].includes(stage)) {
		throw new SourceControlError('bad-request', 'stage must be staged, unstaged, untracked, or commit');
	}
	let result;
	if (stage === 'commit') {
		const revision = confineRevision(request.rev);
		result = await runGit(ctx, {
			cwd: repo.root,
			argv: [
				'show',
				'--format=',
				'--no-color',
				'--no-ext-diff',
				'--unified=3',
				revision,
				'--',
				path,
			],
			maxBytes: MAX_DIFF_BYTES,
			...(signal === undefined ? {} : { signal }),
		});
	} else if (stage === 'untracked') {
		// An untracked path is not in the index, so `git diff -- path` has nothing
		// to compare. `--no-index` against the platform's null device produces the
		// same unified shape without staging the file.
		const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';
		result = await runGit(ctx, {
			cwd: repo.root,
			argv: [
				'diff',
				'--no-index',
				'--no-color',
				'--no-ext-diff',
				'--unified=3',
				'--',
				nullDevice,
				path,
			],
			maxBytes: MAX_DIFF_BYTES,
			...(signal === undefined ? {} : { signal }),
		});
	} else {
		result = await runGit(ctx, {
			cwd: repo.root,
			argv: [
				'diff',
				...(stage === 'staged' ? ['--cached'] : []),
				'--no-color',
				'--no-ext-diff',
				'--unified=3',
				'--',
				path,
			],
			maxBytes: MAX_DIFF_BYTES,
			...(signal === undefined ? {} : { signal }),
		});
	}
	if (stage === 'untracked' ? result.exitCode !== 0 && result.exitCode !== 1 : result.exitCode !== 0) {
		const detail = result.stderr.trim();
		throw new SourceControlError('git/failed', `git diff failed${detail === '' ? '' : `: ${detail}`}`);
	}
	const text = result.stdout;
	const binary = /^Binary files |^GIT binary patch/m.test(text);
	return {
		repo,
		path,
		stage,
		rev: stage === 'commit' ? request.rev : null,
		diff: binary ? '' : text,
		binary,
		truncated: result.truncated,
	};
}

/** Normalize and validate a path list from a mutation body. */
function pathsField(body) {
	if (!Array.isArray(body.paths) || body.paths.length === 0) {
		throw new SourceControlError('bad-request', 'paths must be a non-empty array');
	}
	if (body.paths.length > MAX_ENTRIES) {
		throw new SourceControlError('bad-request', `paths may contain at most ${MAX_ENTRIES} entries`);
	}
	return [...new Set(body.paths.map((path) => confinePath(path)))];
}

/** Stage one or more paths. */
export async function stagePaths(ctx, sessionId, paths, signal) {
	const repo = await requireRepo(ctx, sessionId, signal);
	const safe = pathsField({ paths });
	const result = await runGit(ctx, {
		cwd: repo.root,
		argv: ['add', '--', ...safe],
		...(signal === undefined ? {} : { signal }),
	});
	if (result.exitCode !== 0) {
		const detail = result.stderr.trim();
		throw new SourceControlError('git/failed', `git add failed${detail === '' ? '' : `: ${detail}`}`);
	}
	return await readStatus(ctx, sessionId, signal);
}

/** Unstage one or more paths, including in a repository with no first commit. */
export async function unstagePaths(ctx, sessionId, paths, signal) {
	const repo = await requireRepo(ctx, sessionId, signal);
	const safe = pathsField({ paths });
	let result = await runGit(ctx, {
		cwd: repo.root,
		argv: ['restore', '--staged', '--', ...safe],
		...(signal === undefined ? {} : { signal }),
	});
	if (result.exitCode !== 0) {
		const detail = result.stderr.trim();
		// `git restore --staged` needs HEAD. Before the first commit, removing the
		// index entries is the same operation from the user's point of view.
		if (/could not resolve.*HEAD|ambiguous argument 'HEAD'|unknown revision/i.test(detail)) {
			result = await runGit(ctx, {
				cwd: repo.root,
				argv: ['rm', '--cached', '--quiet', '--', ...safe],
				...(signal === undefined ? {} : { signal }),
			});
		}
	}
	if (result.exitCode !== 0) {
		const detail = result.stderr.trim();
		throw new SourceControlError('git/failed', `git unstage failed${detail === '' ? '' : `: ${detail}`}`);
	}
	return await readStatus(ctx, sessionId, signal);
}

/** Commit the staged changes, optionally staging everything first. */
export async function commitChanges(ctx, sessionId, request, signal) {
	const repo = await requireRepo(ctx, sessionId, signal);
	const message = typeof request.message === 'string' ? request.message.trim() : '';
	if (message === '') {
		throw new SourceControlError('bad-request', 'a commit message is required');
	}
	if (message.includes('\0')) {
		throw new SourceControlError('bad-request', 'commit messages cannot contain NUL');
	}
	if (message.length > MAX_MESSAGE_LENGTH) {
		throw new SourceControlError('bad-request', `commit message may contain at most ${MAX_MESSAGE_LENGTH} characters`);
	}
	if (request.stageAll === true) {
		const added = await runGit(ctx, {
			cwd: repo.root,
			argv: ['add', '-A'],
			...(signal === undefined ? {} : { signal }),
		});
		if (added.exitCode !== 0) {
			const detail = added.stderr.trim();
			throw new SourceControlError('git/failed', `git add failed${detail === '' ? '' : `: ${detail}`}`);
		}
	}
	const result = await runGit(ctx, {
		cwd: repo.root,
		argv: ['commit', '-m', message],
		timeoutMs: 120_000,
		...(signal === undefined ? {} : { signal }),
	});
	if (result.exitCode !== 0) {
		const detail = result.stderr.trim() === '' ? result.stdout.trim() : result.stderr.trim();
		if (/nothing to commit|no changes added to commit/i.test(detail)) {
			throw new SourceControlError('commit/nothing-staged', 'there are no staged changes to commit');
		}
		throw new SourceControlError('git/failed', `git commit failed${detail === '' ? '' : `: ${detail}`}`);
	}
	const head = await runGit(ctx, {
		cwd: repo.root,
		argv: ['rev-parse', '--short', 'HEAD'],
		...(signal === undefined ? {} : { signal }),
	});
	return {
		status: await readStatus(ctx, sessionId, signal),
		commit: { hash: head.exitCode === 0 ? head.stdout.trim() : null, message },
	};
}

/** Run a network Git command with the longer timeout it needs. */
async function networkGit(ctx, cwd, argv, signal) {
	return await runGit(ctx, {
		cwd,
		argv,
		timeoutMs: MAX_SYNC_TIMEOUT_MS,
		env: { GIT_TERMINAL_PROMPT: '0' },
		...(signal === undefined ? {} : { signal }),
	});
}

/**
 * Fetch, and optionally fast-forward/push, the current branch.
 *
 * `sync` deliberately refuses a diverged or upstream-less branch instead of
 * choosing a merge/rebase strategy on the user's behalf.
 */
export async function syncRepo(ctx, sessionId, mode, signal) {
	const repo = await requireRepo(ctx, sessionId, signal);
	if (!['fetch', 'pull', 'push', 'sync'].includes(mode)) {
		throw new SourceControlError('bad-request', 'mode must be fetch, pull, push, or sync');
	}
	const fetched = await networkGit(ctx, repo.root, ['fetch', '--all', '--prune'], signal);
	if (fetched.exitCode !== 0) {
		const detail = fetched.stderr.trim();
		throw new SourceControlError('git/failed', `git fetch failed${detail === '' ? '' : `: ${detail}`}`);
	}
	let status = await readStatus(ctx, sessionId, signal);
	if (mode === 'fetch') {
		return { status, action: 'fetch', message: 'fetched' };
	}
	if (status.repo === null) {
		throw new SourceControlError('repo/not-found', 'the Session workspace is not a Git repository');
	}
	const { ahead, behind, upstream, detached } = status.repo;
	if (detached) {
		throw new SourceControlError('git/failed', 'cannot sync a detached HEAD');
	}
	if (upstream === null) {
		throw new SourceControlError('sync/no-upstream', 'the current branch has no upstream to sync with');
	}

	let action = 'none';
	if (mode === 'sync') {
		if (ahead > 0 && behind > 0) {
			throw new SourceControlError(
				'sync/diverged',
				`the local and upstream branches have diverged (${ahead} ahead, ${behind} behind)`,
			);
		}
		if (behind > 0) action = 'pull';
		else if (ahead > 0) action = 'push';
	} else {
		action = mode;
	}

	if (action === 'pull') {
		const pulled = await networkGit(ctx, repo.root, ['pull', '--ff-only', '--no-rebase'], signal);
		if (pulled.exitCode !== 0) {
			const detail = pulled.stderr.trim();
			throw new SourceControlError('git/failed', `git pull failed${detail === '' ? '' : `: ${detail}`}`);
		}
	} else if (action === 'push') {
		const pushed = await networkGit(ctx, repo.root, ['push'], signal);
		if (pushed.exitCode !== 0) {
			const detail = pushed.stderr.trim();
			throw new SourceControlError('git/failed', `git push failed${detail === '' ? '' : `: ${detail}`}`);
		}
	}
	status = await readStatus(ctx, sessionId, signal);
	return { status, action, message: action === 'none' ? 'up to date' : action };
}

/** Initialize a repository in the Session working directory. */
export async function initRepo(ctx, sessionId, signal) {
	const cwd = await resolveSessionCwd(ctx, sessionId);
	const result = await runGit(ctx, {
		cwd,
		argv: ['init'],
		...(signal === undefined ? {} : { signal }),
	});
	if (result.exitCode !== 0) {
		const detail = result.stderr.trim();
		throw new SourceControlError('git/failed', `git init failed${detail === '' ? '' : `: ${detail}`}`);
	}
	return await readStatus(ctx, sessionId, signal);
}

/** Answer one normalized API request. */
async function handleApi(ctx, request, signal) {
	const { method, route, url } = request;
	if (method === 'GET') {
		switch (route) {
			case '/status':
				return { status: 200, body: { ok: true, ...(await readStatus(ctx, url.searchParams.get('sessionId'), signal)) } };
			case '/history':
				return {
					status: 200,
					body: {
						ok: true,
						...(await readHistory(ctx, url.searchParams.get('sessionId'), {
							limit: Number(url.searchParams.get('limit')),
							skip: Number(url.searchParams.get('skip')),
							signal,
						})),
					},
				};
			case '/commit':
				return {
					status: 200,
					body: {
						ok: true,
						...(await readCommit(
							ctx,
							url.searchParams.get('sessionId'),
							url.searchParams.get('rev'),
							signal,
						)),
					},
				};
			case '/diff':
				return {
					status: 200,
					body: {
						ok: true,
						...(await readDiff(
							ctx,
							url.searchParams.get('sessionId'),
							{
								path: url.searchParams.get('path'),
								stage: url.searchParams.get('stage') ?? 'unstaged',
								rev: url.searchParams.get('rev'),
							},
							signal,
						)),
					},
				};
			default:
				return { status: 404, body: { ok: false, code: 'not-found', message: `no such endpoint: ${route}` } };
		}
	}
	if (method === 'POST') {
		const body = await readJsonBody(request.req);
		const sessionId = body.sessionId;
		switch (route) {
			case '/stage':
				return {
					status: 200,
					body: { ok: true, ...(await stagePaths(ctx, sessionId, body.paths, signal)) },
				};
			case '/unstage':
				return {
					status: 200,
					body: { ok: true, ...(await unstagePaths(ctx, sessionId, body.paths, signal)) },
				};
			case '/commit':
				return { status: 200, body: { ok: true, ...(await commitChanges(ctx, sessionId, body, signal)) } };
			case '/sync':
				return {
					status: 200,
					body: { ok: true, ...(await syncRepo(ctx, sessionId, body.mode ?? 'sync', signal)) },
				};
			case '/init':
				return { status: 200, body: { ok: true, ...(await initRepo(ctx, sessionId, signal)) } };
			default:
				return { status: 404, body: { ok: false, code: 'not-found', message: `no such endpoint: ${route}` } };
		}
	}
	return { status: 405, body: { ok: false, code: 'method', message: 'GET or POST is required' } };
}

/**
 * Register the route and tie its lifetime to the plugin activation.
 * @param {any} ctx - Host context with `webServer`, `subprocess`, and `sessions`.
 */
export function apply(ctx) {
	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: 'prefix',
				path: ROUTE_PREFIX,
				handler: async (req, res) => {
					const method = (req.method ?? 'GET').toUpperCase();
					const mutating = method === 'POST';
					if (!authorize(ctx, req, res, mutating)) return;
					const url = new URL(req.url ?? '/', 'http://localhost');
					if (
						url.pathname !== ROUTE_PREFIX &&
						!url.pathname.startsWith(`${ROUTE_PREFIX}/`)
					) {
						sendJson(res, 404, { ok: false, code: 'not-found', message: 'not a Source Control route' });
						return;
					}
					const route = url.pathname.slice(ROUTE_PREFIX.length) || '/';
					const controller = new AbortController();
					res.on('close', () => {
						if (!res.writableEnded) controller.abort(new Error('response closed'));
					});
					try {
						const result = await handleApi(ctx, { method, route, url, req }, controller.signal);
						sendJson(res, result.status, result.body);
					} catch (error) {
						if (res.writableEnded || res.destroyed) return;
						if (error instanceof SourceControlError) {
							sendJson(res, error.status, {
								ok: false,
								code: error.code,
								message: error.message,
							});
							return;
						}
						console.error('[source-control] request failed', error);
						sendJson(res, 500, {
							ok: false,
							code: 'internal',
							message: messageOf(error),
						});
					}
				},
			}),
		'source-control: HTTP routes',
	);
}

/** Host services required by the route, Git runner, and Session lookup. */
export const inject = ['webServer', 'subprocess', 'sessions'];
