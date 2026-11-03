/**
 * Host half of the Godot Debug bundle.
 *
 * The panel needs three things the generated Remote namespaces do not expose:
 * the configured Godot executable, one long-lived child process, and a
 * pollable rendering of its stdout/stderr. This module owns that process as a
 * singleton and serves it to the same-origin panel over loopback-only routes.
 *
 * The route performs no shell interpolation: argv is built as an array and
 * handed to the Host subprocess service. Mutating routes require a custom
 * header and a same-origin check so a normal cross-origin page cannot start a
 * process.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { GodotWebExporter, WebBuildError } from './web.js';

/** Longest accepted JSON request body. */
const MAX_BODY_BYTES = 32 * 1024;

/** Longest retained log text returned to the panel. */
const MAX_LOG_CHARS = 300_000;

/** Longest text slice appended by one output read. */
const MAX_LOG_CHUNK = 8_192;

/** How long a stop request waits for the process to leave before reporting a timeout. */
const STOP_TIMEOUT_MS = 6_000;

/** Default project path used by this personal installation. */
const DEFAULT_PROJECT_PATH = '/Users/kesuan/项目/Project-Flow';

/** Default Godot editor binary on macOS. */
const DEFAULT_GODOT_EXECUTABLE = '/Applications/Godot.app/Contents/MacOS/Godot';

/** Godot 4's design viewport when a project has no `[display]` overrides. */
const DEFAULT_VIEWPORT = { width: 1152, height: 648 };

/**
 * Wait for a done promise without leaving a live timeout once it settles.
 * @returns true when the process settled, false on timeout.
 */
function settlesWithin(done, ms) {
	return new Promise((resolve) => {
		let decided = false;
		const timer = setTimeout(() => {
			if (decided) return;
			decided = true;
			resolve(false);
		}, ms);
		const finish = () => {
			if (decided) return;
			decided = true;
			clearTimeout(timer);
			resolve(true);
		};
		done.then(finish, finish);
	});
}

/** Remove terminal colour escape sequences from one output chunk. */
function stripAnsi(text) {
	return String(text).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
}

/** One input or environment failure with a stable code for the panel. */
export class GodotDebugError extends Error {
	/**
	 * @param code - stable discriminator consumed by the UI.
	 * @param message - diagnostic suitable for display.
	 */
	constructor(code, message) {
		super(message);
		this.name = 'GodotDebugError';
		this.code = code;
	}
}

/**
 * Build the exact argv for one Godot run.
 *
 * Godot only forwards arguments after the `--` separator to the project's
 * `OS.get_cmdline_user_args()`, so project flags such as `--dev-hud` and
 * `--skip-intro` must live after it.
 *
 * @param options - resolved executable, project, and toggle values.
 * @returns the complete argv array, executable included.
 */
export function buildGodotArgv({ executable, projectPath, debug = true, devHud = false, skipIntro = false, extraArgs = [] }) {
	const argv = [executable, '--path', projectPath];
	if (debug) argv.push('--debug');
	const userArgs = [];
	if (devHud) userArgs.push('--dev-hud');
	if (skipIntro) userArgs.push('--skip-intro');
	userArgs.push(...extraArgs);
	if (userArgs.length > 0) argv.push('--', ...userArgs);
	return argv;
}

/** Whether a socket peer is this machine. */
function isLoopbackAddress(address) {
	return (
		address === '127.0.0.1' ||
		address === '::1' ||
		address === '::ffff:127.0.0.1' ||
		address === '::ffff:7f00:1'
	);
}

/** Whether a request Origin names this local listener or the DSH desktop shell. */
function isAllowedOrigin(origin, expected) {
	if (origin === undefined) return true;
	if (origin === 'dsh-app://app' || origin === 'dsh-app://shell') return true;
	if (origin === expected) return true;
	try {
		const actual = new URL(origin);
		if (actual.protocol === 'dsh-app:' && (actual.hostname === 'app' || actual.hostname === 'shell')) return true;
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

/** Write one JSON response. */
function sendJson(res, status, payload) {
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
				const error = new Error('request body is too large');
				error.code = 'too-large';
				reject(error);
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => {
			if (failed) return;
			try {
				const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
				resolve(parsed);
			} catch {
				const error = new Error('request body is not valid JSON');
				error.code = 'invalid-json';
				reject(error);
			}
		});
		req.on('error', (error) => {
			if (!failed) reject(error);
		});
	});
}

/** Validate the project directory before launching an editor. */
function validateProjectPath(value) {
	if (typeof value !== 'string' || value.trim() === '') {
		throw new GodotDebugError('invalid-project', 'Project path is required.');
	}
	const projectPath = value.trim();
	if (!isAbsolute(projectPath)) {
		throw new GodotDebugError('invalid-project', 'Project path must be absolute.');
	}
	const projectFile = join(projectPath, 'project.godot');
	if (!existsSync(projectFile) || !statSync(projectFile).isFile()) {
		throw new GodotDebugError('project-not-found', `project.godot was not found in ${projectPath}`);
	}
	return projectPath;
}

/**
 * Find the nearest ancestor directory containing `project.godot`.
 * Session working directories are often the project root, but allowing a
 * nested subdirectory keeps the preview available when a Session was started
 * from `scripts/` or a subscene.
 *
 * @param start - absolute directory to inspect.
 * @returns the project directory, or undefined when no ancestor is a Godot project.
 */
export function findGodotProject(start) {
	if (typeof start !== 'string' || !isAbsolute(start)) return undefined;
	let current = resolve(start);
	for (let depth = 0; depth < 32; depth += 1) {
		if (existsSync(join(current, 'project.godot'))) return current;
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return undefined;
}

/** Read one positive integer assigned on its own line of `project.godot`. */
function readProjectInt(text, key, fallback) {
	const match = new RegExp(`^\\s*${key}\\s*=\\s*(\\d+)\\s*$`, 'm').exec(text);
	if (match === null) return fallback;
	const value = Number.parseInt(match[1], 10);
	return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * The authored design resolution, used by the preview pane to give the iframe
 * the game's own aspect ratio: the canvas then matches the framing the level
 * was built for (no letterbox bars, no stretched lens).
 *
 * This is `display/window/size/viewport_*`, not `window_width_override`: the
 * override is the desktop window size, while the viewport is the author's frame.
 *
 * @param projectPath - directory containing `project.godot`.
 * @returns `{ width, height }`, falling back to Godot 4's 1152x648 default.
 */
export function readViewportSize(projectPath) {
	let text = '';
	try {
		text = readFileSync(join(projectPath, 'project.godot'), 'utf8');
	} catch {
		return { ...DEFAULT_VIEWPORT };
	}
	return {
		width: readProjectInt(text, 'window/size/viewport_width', DEFAULT_VIEWPORT.width),
		height: readProjectInt(text, 'window/size/viewport_height', DEFAULT_VIEWPORT.height),
	};
}

/** Validate the extra arguments supplied by the panel. */
function validateExtraArgs(value) {
	if (value === undefined || value === null) return [];
	if (!Array.isArray(value) || value.length > 32) {
		throw new GodotDebugError('invalid-args', 'Extra arguments must be an array of at most 32 strings.');
	}
	return value.map((item) => {
		if (typeof item !== 'string' || item.includes('\0') || item.length > 1024) {
			throw new GodotDebugError('invalid-args', 'Each extra argument must be a string of at most 1024 characters.');
		}
		return item;
	});
}

/**
 * Own one Godot child process and its retained output.
 *
 * Output is read with offset-based, non-consuming readers. The panel polls
 * `snapshot()` and receives only entries after its cursor, so multiple panels
 * can observe the same process without stealing output from one another.
 */
export class GodotDebugController {
	#ctx;
	#config;
	#state;
	#handle = null;
	#generation = 0;
	#logs = [];
	#nextSeq = 1;
	#logChars = 0;
	#droppedThrough = 0;
	#offsets = { stdout: 0, stderr: 0 };
	#stopRequested = false;
	#disposed = false;

	/**
	 * @param ctx - Host context with the subprocess service.
	 * @param config - defaults from the bundle patch.
	 */
	constructor(ctx, config = {}) {
		this.#ctx = ctx;
		this.#config = {
			projectPath:
				typeof config.projectPath === 'string' && config.projectPath !== ''
					? config.projectPath
					: DEFAULT_PROJECT_PATH,
			godotExecutable:
				process.env.GODOT ||
				(typeof config.godotExecutable === 'string' && config.godotExecutable !== ''
					? config.godotExecutable
					: DEFAULT_GODOT_EXECUTABLE),
		};
		this.#state = {
			generation: 0,
			status: 'idle',
			projectPath: null,
			godotExecutable: null,
			argv: [],
			startedAt: null,
			endedAt: null,
			exitCode: null,
			signal: null,
			error: null,
		};
	}

	/** The non-secret defaults the panel needs to render its form. */
	configSnapshot() {
		return {
			projectPath: this.#config.projectPath,
			godotExecutable: this.#config.godotExecutable,
			platform: process.platform,
		};
	}

	/**
	 * Read from both collected streams and append new output.
	 * @param handle - process whose collected readers to drain.
	 */
	#drain(handle) {
		if (handle === null) return;
		for (const stream of ['stdout', 'stderr']) {
			const reader = handle.collected?.[stream];
			if (reader === undefined) continue;
			let read;
			try {
				read = reader.readFrom(this.#offsets[stream]);
			} catch {
				continue;
			}
			this.#offsets[stream] = read.nextOffset;
			if (read.text !== '') this.#append(stream, stripAnsi(read.text));
			if (read.lossy) this.#append('system', '\n[output truncated; older bytes were dropped by the Host]\n');
		}
	}

	/**
	 * Append output in bounded chunks so one noisy frame cannot monopolise the
	 * view or the log buffer.
	 */
	#append(stream, text) {
		if (text === '') return;
		for (let start = 0; start < text.length; start += MAX_LOG_CHUNK) {
			const chunk = text.slice(start, start + MAX_LOG_CHUNK);
			this.#logs.push({ seq: this.#nextSeq, stream, time: Date.now(), text: chunk });
			this.#nextSeq += 1;
			this.#logChars += chunk.length;
		}
		while (this.#logChars > MAX_LOG_CHARS && this.#logs.length > 0) {
			const removed = this.#logs.shift();
			this.#logChars -= removed.text.length;
			this.#droppedThrough = removed.seq;
		}
	}

	/**
	 * Return the current process state and output after one cursor.
	 * @param after - last entry sequence the caller has seen.
	 */
	snapshot(after = 0) {
		this.#drain(this.#handle);
		const cursorAfter = Number.isFinite(after) && after > 0 ? Math.floor(after) : 0;
		return {
			state: { ...this.#state },
			config: this.configSnapshot(),
			logs: this.#logs.filter((entry) => entry.seq > cursorAfter),
			cursor: this.#nextSeq - 1,
			droppedThrough: this.#droppedThrough,
			reset: cursorAfter > 0 && cursorAfter < this.#droppedThrough,
		};
	}

	/**
	 * Start one Godot debug session.
	 * @param request - optional project path and launch toggles from the panel.
	 * @returns the fresh snapshot.
	 */
	async start(request = {}) {
		if (this.#disposed) throw new GodotDebugError('disposed', 'This plugin was unloaded.');
		if (this.#state.status === 'starting' || this.#state.status === 'running' || this.#state.status === 'stopping') {
			throw new GodotDebugError('already-running', 'A Godot process is already running.');
		}

		const projectPath = validateProjectPath(
			typeof request.projectPath === 'string' ? request.projectPath : this.#config.projectPath,
		);
		const debug = request.debug === undefined ? true : request.debug === true;
		const devHud = request.devHud === true;
		const skipIntro = request.skipIntro === true;
		const extraArgs = validateExtraArgs(request.extraArgs);

		this.#generation += 1;
		this.#logs = [];
		this.#nextSeq = 1;
		this.#logChars = 0;
		this.#droppedThrough = 0;
		this.#offsets = { stdout: 0, stderr: 0 };
		this.#stopRequested = false;
		this.#handle = null;
		this.#state = {
			generation: this.#generation,
			status: 'starting',
			projectPath,
			godotExecutable: this.#config.godotExecutable,
			argv: [],
			startedAt: Date.now(),
			endedAt: null,
			exitCode: null,
			signal: null,
			error: null,
		};

		let executable;
		try {
			executable = await this.#ctx.subprocess.resolveExecutable(this.#config.godotExecutable);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.#state.status = 'failed';
			this.#state.endedAt = Date.now();
			this.#state.error = `Godot executable could not be resolved: ${message}`;
			throw new GodotDebugError('godot-not-found', this.#state.error);
		}
		if (this.#disposed) throw new GodotDebugError('disposed', 'This plugin was unloaded.');

		const argv = buildGodotArgv({
			executable,
			projectPath,
			debug,
			devHud,
			skipIntro,
			extraArgs,
		});
		this.#state.argv = argv;
		this.#state.godotExecutable = executable;

		let handle;
		try {
			handle = this.#ctx.subprocess.spawn({
				argv,
				cwd: projectPath,
				stdio: {
					stdin: 'ignore',
					stdout: { maxBytes: 512 * 1024, spill: { maxBytes: 16 * 1024 * 1024 } },
					stderr: { maxBytes: 512 * 1024, spill: { maxBytes: 16 * 1024 * 1024 } },
				},
				graceMs: 3_000,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.#state.status = 'failed';
			this.#state.endedAt = Date.now();
			this.#state.error = message;
			throw new GodotDebugError('spawn-failed', message);
		}

		this.#handle = handle;
		this.#state.status = 'running';
		handle.done.then(
			(outcome) => {
				if (this.#handle !== handle) return;
				this.#drain(handle);
				this.#state.endedAt = Date.now();
				this.#state.exitCode = outcome.exitCode;
				this.#state.signal = outcome.signal;
				this.#state.status = this.#stopRequested
					? 'stopped'
					: outcome.exitCode === 0
						? 'exited'
						: 'failed';
				if (this.#state.status === 'failed' && this.#state.error === null) {
					this.#state.error =
						outcome.exitCode === null
							? `Godot exited with signal ${outcome.signal ?? 'unknown'}.`
							: `Godot exited with code ${outcome.exitCode}.`;
				}
			},
			(error) => {
				if (this.#handle !== handle) return;
				this.#drain(handle);
				this.#state.status = 'failed';
				this.#state.endedAt = Date.now();
				this.#state.error = error instanceof Error ? error.message : String(error);
			},
		);

		return this.snapshot(0);
	}

	/**
	 * Ask the running process to stop and wait for its exit, bounded by the
	 * stop timeout so a stuck process still returns control to the UI.
	 */
	async stop() {
		const handle = this.#handle;
		if (handle === null || !['starting', 'running', 'stopping'].includes(this.#state.status)) {
			return this.snapshot(0);
		}
		this.#stopRequested = true;
		if (this.#state.status !== 'stopping') this.#state.status = 'stopping';
		handle.terminate();
		const exited = await settlesWithin(handle.done, STOP_TIMEOUT_MS);
		if (!exited && this.#handle === handle) {
			this.#state.status = 'failed';
			this.#state.error = 'Godot did not exit after the termination request.';
		}
		return this.snapshot(0);
	}

	/**
	 * Stop the current process, then launch the requested configuration again.
	 * The returned snapshot always represents the new run.
	 */
	async restart(request = {}) {
		await this.stop();
		return this.start(request);
	}

	/** Terminate a live process when the plugin or Host unloads. */
	dispose() {
		this.#disposed = true;
		if (this.#handle !== null) {
			try {
				this.#handle.terminate();
			} catch {
				// The provider may already have finished its own disposal.
			}
		}
	}
}

/** Read `after` from a URL query, ignoring malformed values. */
function cursorFromUrl(url) {
	try {
		const parsed = new URL(url, 'http://localhost');
		const after = Number(parsed.searchParams.get('after'));
		return Number.isFinite(after) && after > 0 ? Math.floor(after) : 0;
	} catch {
		return 0;
	}
}

/** Verify the request is loopback, same-origin, and (for mutations) marked by the panel. */
function authorize(ctx, req, res, mutating) {
	if (!isLoopbackAddress(req.socket.remoteAddress)) {
		sendJson(res, 403, { ok: false, error: 'loopback', message: 'local requests only' });
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
			sendJson(res, 403, { ok: false, error: 'origin', message: 'cross-origin request refused' });
			return false;
		}
	}
	if (mutating) {
		if (req.headers['x-dsh-godot-debug'] !== '1') {
			sendJson(res, 403, { ok: false, error: 'forbidden', message: 'missing Godot debug header' });
			return false;
		}
		if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] ?? ''))) {
			sendJson(res, 415, { ok: false, error: 'content-type', message: 'application/json is required' });
			return false;
		}
	}
	return true;
}

/** Map a controller failure to one JSON response. */
function sendControllerError(res, error) {
	if (error instanceof GodotDebugError) {
		const status =
			error.code === 'already-running'
				? 409
				: error.code === 'invalid-project' || error.code === 'invalid-args'
					? 400
					: error.code === 'project-not-found' || error.code === 'godot-not-found'
						? 404
						: 500;
		sendJson(res, status, { ok: false, error: error.code, message: error.message });
		return;
	}
	if (error instanceof WebBuildError) {
		const status =
			error.code === 'already-building'
				? 409
				: error.code === 'invalid-project' || error.code === 'invalid-args'
					? 400
					: error.code === 'godot-not-found'
						? 404
						: error.code === 'disposed'
							? 409
							: 500;
		sendJson(res, status, { ok: false, error: error.code, message: error.message });
		return;
	}
	console.error('[godot-debug] request failed', error);
	sendJson(res, 500, {
		ok: false,
		error: 'internal',
		message: error instanceof Error ? error.message : String(error),
	});
}

/**
 * Register the four loopback routes and tie the controller lifetime to the
 * plugin activation.
 * @param ctx - Host context with webServer and subprocess.
 * @param config - bundle config with project and executable defaults.
 */
export function apply(ctx, config = {}) {
	const controller = new GodotDebugController(ctx, config);
	const webExporter = new GodotWebExporter(ctx, config);

	const contextHandler = async (req, res) => {
		if (req.method !== 'GET') {
			sendJson(res, 405, { ok: false, error: 'method', message: 'GET is required' });
			return;
		}
		if (!authorize(ctx, req, res, false)) return;
		let url;
		try {
			url = new URL(req.url ?? '/', 'http://localhost');
		} catch {
			sendJson(res, 400, { ok: false, error: 'invalid-url', message: 'invalid URL' });
			return;
		}
		const sessionId = url.searchParams.get('sessionId') ?? '';
		if (sessionId === '') {
			sendJson(res, 400, { ok: false, error: 'missing-session', message: 'sessionId is required' });
			return;
		}
		let snapshot;
		try {
			snapshot = await ctx.sessionPersistence.stat(sessionId);
		} catch {
			snapshot = undefined;
		}
		const cwd = snapshot?.header?.cwd;
		if (typeof cwd !== 'string' || cwd === '') {
			sendJson(res, 200, { ok: true, available: false, reason: 'session-unavailable' });
			return;
		}
		const projectPath = findGodotProject(cwd);
		if (projectPath === undefined) {
			sendJson(res, 200, { ok: true, available: false, reason: 'not-godot', cwd });
			return;
		}
		sendJson(res, 200, {
			ok: true,
			available: true,
			projectPath,
			projectName: basename(projectPath),
			viewport: readViewportSize(projectPath),
			cwd,
		});
	};

	const stateHandler = async (req, res) => {
		if (req.method !== 'GET') {
			sendJson(res, 405, { ok: false, error: 'method', message: 'GET is required' });
			return;
		}
		if (!authorize(ctx, req, res, false)) return;
		try {
			sendJson(res, 200, { ok: true, ...controller.snapshot(cursorFromUrl(req.url)) });
		} catch (error) {
			sendControllerError(res, error);
		}
	};

	const startHandler = async (req, res) => {
		if (req.method !== 'POST') {
			sendJson(res, 405, { ok: false, error: 'method', message: 'POST is required' });
			return;
		}
		if (!authorize(ctx, req, res, true)) return;
		let body;
		try {
			body = await readJsonBody(req);
		} catch (error) {
			const tooLarge = error instanceof Error && error.code === 'too-large';
			sendJson(res, tooLarge ? 413 : 400, {
				ok: false,
				error: tooLarge ? 'too-large' : 'invalid-json',
				message: error instanceof Error ? error.message : String(error),
			});
			return;
		}
		try {
			sendJson(res, 200, { ok: true, ...(await controller.start(body ?? {})) });
		} catch (error) {
			sendControllerError(res, error);
		}
	};

	const stopHandler = async (req, res) => {
		if (req.method !== 'POST') {
			sendJson(res, 405, { ok: false, error: 'method', message: 'POST is required' });
			return;
		}
		if (!authorize(ctx, req, res, true)) return;
		try {
			sendJson(res, 200, { ok: true, ...(await controller.stop()) });
		} catch (error) {
			sendControllerError(res, error);
		}
	};

	const restartHandler = async (req, res) => {
		if (req.method !== 'POST') {
			sendJson(res, 405, { ok: false, error: 'method', message: 'POST is required' });
			return;
		}
		if (!authorize(ctx, req, res, true)) return;
		let body;
		try {
			body = await readJsonBody(req);
		} catch (error) {
			const tooLarge = error instanceof Error && error.code === 'too-large';
			sendJson(res, tooLarge ? 413 : 400, {
				ok: false,
				error: tooLarge ? 'too-large' : 'invalid-json',
				message: error instanceof Error ? error.message : String(error),
			});
			return;
		}
		try {
			sendJson(res, 200, { ok: true, ...(await controller.restart(body ?? {})) });
		} catch (error) {
			sendControllerError(res, error);
		}
	};

	const webStateHandler = async (req, res) => {
		if (req.method !== 'GET') {
			sendJson(res, 405, { ok: false, error: 'method', message: 'GET is required' });
			return;
		}
		if (!authorize(ctx, req, res, false)) return;
		sendJson(res, 200, { ok: true, web: webExporter.snapshot() });
	};

	const webBuildHandler = async (req, res) => {
		if (req.method !== 'POST') {
			sendJson(res, 405, { ok: false, error: 'method', message: 'POST is required' });
			return;
		}
		if (!authorize(ctx, req, res, true)) return;
		let body;
		try {
			body = await readJsonBody(req);
		} catch (error) {
			const tooLarge = error instanceof Error && error.code === 'too-large';
			sendJson(res, tooLarge ? 413 : 400, {
				ok: false,
				error: tooLarge ? 'too-large' : 'invalid-json',
				message: error instanceof Error ? error.message : String(error),
			});
			return;
		}
		try {
			sendJson(res, 200, { ok: true, web: await webExporter.build(body ?? {}) });
		} catch (error) {
			sendControllerError(res, error);
		}
	};

	const webLogsHandler = async (req, res) => {
		if (req.method !== 'GET') {
			sendJson(res, 405, { ok: false, error: 'method', message: 'GET is required' });
			return;
		}
		if (!authorize(ctx, req, res, false)) return;
		let url;
		try {
			url = new URL(req.url ?? '/', 'http://localhost');
		} catch {
			sendJson(res, 400, { ok: false, error: 'invalid-url', message: 'invalid URL' });
			return;
		}
		const buildId = url.searchParams.get('buildId') ?? '';
		const after = Number(url.searchParams.get('after'));
		const result = webExporter.getLogs(buildId, Number.isFinite(after) ? after : 0);
		if (result === null) {
			sendJson(res, 404, { ok: false, error: 'unknown-build', message: 'unknown Web build' });
			return;
		}
		sendJson(res, 200, { ok: true, ...result });
	};

	ctx.effect(() => {
		const routes = [
			ctx.webServer.register({ kind: 'exact', path: '/local/godot-debug/context', handler: contextHandler }),
			ctx.webServer.register({ kind: 'exact', path: '/local/godot-debug/state', handler: stateHandler }),
			ctx.webServer.register({ kind: 'exact', path: '/local/godot-debug/start', handler: startHandler }),
			ctx.webServer.register({ kind: 'exact', path: '/local/godot-debug/stop', handler: stopHandler }),
			ctx.webServer.register({ kind: 'exact', path: '/local/godot-debug/restart', handler: restartHandler }),
			ctx.webServer.register({ kind: 'exact', path: '/local/godot-web/state', handler: webStateHandler }),
			ctx.webServer.register({ kind: 'exact', path: '/local/godot-web/build', handler: webBuildHandler }),
			ctx.webServer.register({ kind: 'exact', path: '/local/godot-web/logs', handler: webLogsHandler }),
		];
		return () => {
			for (const dispose of routes.reverse()) {
				try {
					dispose();
				} catch {
					// A route may already be gone during Host teardown.
				}
			}
			controller.dispose();
			webExporter.dispose();
		};
	}, 'godot-debug: HTTP routes, child process, and Web preview server');
}

/** Services required by the routes and the process controller. */
export const inject = ['webServer', 'subprocess', 'sessionPersistence'];
