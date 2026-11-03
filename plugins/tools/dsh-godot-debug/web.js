/**
 * Web-preview builder for the Godot Debug bundle.
 *
 * A native Godot window cannot be embedded in the DSH Web renderer. This
 * module produces a debug Web export instead: it copies the project into a
 * private work directory, adds a Web export preset, builds the export with the
 * configured Godot binary, and serves the result from a loopback-only static
 * server. The DSH panel embeds that page in an iframe and receives browser
 * console output through a small same-origin log bridge.
 *
 * The original project is never modified: the export preset and renderer
 * override are written only into the temporary copy.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** Maximum JSON body accepted from the embedded page's log bridge. */
const MAX_LOG_BODY_BYTES = 256 * 1024;

/** Number of builds retained per project. */
const RETAINED_BUILDS = 3;

/** Longest build-log tail surfaced to the panel. */
const MAX_BUILD_LOG = 24_000;

/** Longest console text retained per Web build. */
const MAX_WEB_LOG_CHARS = 300_000;

/** Directory names copied out of a project when preparing the Web export. */
const EXCLUDED_PROJECT_ENTRIES = new Set(['.git', '.godot', 'build', 'docs', 'tests', 'tools']);

/** Content types used by the Godot Web export. */
const MIME_TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.wasm': 'application/wasm',
	'.pck': 'application/octet-stream',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.css': 'text/css; charset=utf-8',
	'.worklet.js': 'text/javascript; charset=utf-8',
};

/** A stable, attribute-poor Web export preset for one debug build. */
const WEB_EXPORT_PRESET = `[preset.0]

name="Web"
platform="Web"
runnable=true
advanced_options=false
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="build/web/index.html"
encryption_include_filters=""
encryption_exclude_filters=""
encrypt_pck=false
encrypt_directory=false
script_export_mode=2

[preset.0.options]

custom_template/debug=""
custom_template/release=""
variant/extensions_support=false
variant/thread_support=false
vram_texture_compression/for_desktop=true
vram_texture_compression/for_mobile=true
html/export_icon=true
html/custom_html_shell=""
html/head_include=""
html/canvas_resize_policy=2
html/focus_canvas_on_start=true
html/experimental_virtual_keyboard=true
progressive_web_app/enabled=false
progressive_web_app/ensure_cross_origin_isolation_headers=false
progressive_web_app/offline_page=""
progressive_web_app/display=0
progressive_web_app/orientation=1
progressive_web_app/icon_144x144=""
progressive_web_app/icon_180x180=""
progressive_web_app/icon_512x512=""
progressive_web_app/background_color=Color(0, 0, 0, 1)
`;

/** One Web build failure with a stable code for the panel. */
export class WebBuildError extends Error {
	/**
	 * @param code - stable discriminator consumed by the UI.
	 * @param message - diagnostic suitable for display.
	 */
	constructor(code, message) {
		super(message);
		this.name = 'WebBuildError';
		this.code = code;
	}
}

/** Join a build-log tail without exceeding the configured bound. */
function appendLogTail(current, next) {
	const combined = current + next;
	return combined.length <= MAX_BUILD_LOG ? combined : combined.slice(combined.length - MAX_BUILD_LOG);
}

/**
 * Insert a console/error bridge into a Godot Web HTML shell.
 *
 * The bridge forwards browser console output to the loopback static server so
 * the DSH panel can display the same class of engine messages as the native
 * stdout debugger. The exported `GODOT_CONFIG.args` is also replaced with the
 * requested user arguments; Godot only exposes arguments after `--` through
 * `OS.get_cmdline_user_args()`.
 *
 * @param html - original exported index.html.
 * @param buildId - build identity used by the log endpoint.
 * @param gameArgs - arguments after the engine's `--` separator.
 * @returns HTML with the bridge in the head.
 */
export function injectLogBridge(html, buildId, gameArgs = []) {
	const script = `<script>
(() => {
  const buildId = ${JSON.stringify(buildId)};
  const queue = [];
  let scheduled = false;
  const format = (value) => {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack || value.message;
    try { return JSON.stringify(value); } catch { return String(value); }
  };
  const send = (level, text) => {
    queue.push({ level, text: String(text).slice(0, 8000), time: Date.now() });
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(async () => {
      scheduled = false;
      const entries = queue.splice(0, 24);
      if (entries.length === 0) return;
      try {
        await fetch('/__godot/log', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ buildId, entries }),
          keepalive: true,
        });
      } catch {}
    }, 120);
  };
  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level];
    console[level] = (...args) => {
      send(level, args.map(format).join(' '));
      original.apply(console, args);
    };
  }
  window.addEventListener('error', (event) => {
    send('error', (event.message || 'Unhandled error') + ' @ ' + (event.filename || '') + ':' + (event.lineno || 0));
  });
  window.addEventListener('unhandledrejection', (event) => {
    send('error', 'Unhandled rejection: ' + format(event.reason));
  });
})();
<\/script>`;
	const args = gameArgs.length === 0 ? [] : ['--', ...gameArgs];
	const withArgs = html.replace(/"args":\[[^\]]*\]/, `"args":${JSON.stringify(args)}`);
	if (withArgs.includes('</head>')) return withArgs.replace('</head>', `${script}</head>`);
	return `${script}${withArgs}`;
}

/**
 * Add a Web-only Compatibility renderer override to a copied project file.
 * An existing override is preserved.
 */
export function addWebRendererOverride(projectText) {
	if (/^renderer\/rendering_method\.web\s*=/m.test(projectText)) return projectText;
	const lines = projectText.split('\n');
	const start = lines.findIndex((line) => line.trim() === '[rendering]');
	if (start < 0) {
		return `${projectText.replace(/\s*$/, '')}\n\n[rendering]\nrenderer/rendering_method.web="gl_compatibility"\n`;
	}
	let end = start + 1;
	while (end < lines.length && !lines[end].trimStart().startsWith('[')) end += 1;
	lines.splice(end, 0, 'renderer/rendering_method.web="gl_compatibility"');
	return lines.join('\n');
}

/** Validate a project directory without trusting client-supplied text. */
function validateProjectPath(value) {
	if (typeof value !== 'string' || value.trim() === '') {
		throw new WebBuildError('invalid-project', 'Project path is required.');
	}
	const projectPath = value.trim();
	if (!isAbsolute(projectPath)) {
		throw new WebBuildError('invalid-project', 'Project path must be absolute.');
	}
	return projectPath;
}

/** Build the user-argument list forwarded through the Web export's GODOT_CONFIG. */
function webGameArgs(request) {
	const args = [];
	if (request.devHud === true) args.push('--dev-hud');
	if (request.skipIntro === true) args.push('--skip-intro');
	const extra = request.extraArgs;
	if (extra !== undefined && extra !== null) {
		if (!Array.isArray(extra) || extra.length > 32) {
			throw new WebBuildError('invalid-args', 'Extra arguments must be an array of at most 32 strings.');
		}
		for (const item of extra) {
			if (typeof item !== 'string' || item.includes('\0') || item.length > 1024) {
				throw new WebBuildError('invalid-args', 'Each extra argument must be a string of at most 1024 characters.');
			}
			args.push(item);
		}
	}
	return args;
}

/** Read and parse one bounded JSON body from the static server. */
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		let size = 0;
		let failed = false;
		const chunks = [];
		req.on('data', (chunk) => {
			if (failed) return;
			size += chunk.length;
			if (size > MAX_LOG_BODY_BYTES) {
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
				resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
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

/** Write one JSON response for the static/log server. */
function sendJson(res, status, payload) {
	const body = JSON.stringify(payload);
	res.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'content-length': String(Buffer.byteLength(body)),
		'cache-control': 'no-store',
		'access-control-allow-origin': '*',
	});
	res.end(body);
}

/** Write one small text response for the static/log server. */
function sendText(res, status, text) {
	res.writeHead(status, {
		'content-type': 'text/plain; charset=utf-8',
		'content-length': String(Buffer.byteLength(text)),
		'cache-control': 'no-store',
		'access-control-allow-origin': '*',
	});
	res.end(text);
}

/**
 * Owns the temporary export worktree, the static preview server, and the
 * browser-origin log buffer for one Host plugin instance.
 */
export class GodotWebExporter {
	#ctx;
	#config;
	#cacheRoot;
	#server = null;
	#port = 0;
	#serverPromise = null;
	#activeHandle = null;
	#building = false;
	#state = {
		status: 'idle',
		buildId: null,
		projectPath: null,
		url: null,
		startedAt: null,
		endedAt: null,
		error: null,
		logTail: '',
	};
	#logs = new Map();

	/**
	 * @param ctx - Host context with the subprocess service.
	 * @param config - defaults resolved from the bundle patch.
	 */
	constructor(ctx, config = {}) {
		this.#ctx = ctx;
		this.#config = {
			projectPath:
				typeof config.projectPath === 'string' && config.projectPath !== ''
					? config.projectPath
					: '/Users/kesuan/项目/Project-Flow',
			godotExecutable:
				process.env.GODOT ||
				(typeof config.godotExecutable === 'string' && config.godotExecutable !== ''
					? config.godotExecutable
					: '/Applications/Godot.app/Contents/MacOS/Godot'),
		};
		this.#cacheRoot = join(tmpdir(), 'dsh-godot-debug-web');
	}

	/** The current build and previous success facts for the panel. */
	snapshot() {
		return { ...this.#state };
	}

	/** Read one build's browser-console entries after a cursor. */
	getLogs(buildId, after = 0) {
		const buffer = this.#logs.get(buildId);
		if (buffer === undefined) return null;
		const cursorAfter = Number.isFinite(after) && after > 0 ? Math.floor(after) : 0;
		return {
			logs: buffer.entries.filter((entry) => entry.seq > cursorAfter),
			cursor: buffer.nextSeq - 1,
		};
	}

	/** The loopback origin serving built assets, once the server is running. */
	get origin() {
		return this.#port === 0 ? null : `http://127.0.0.1:${this.#port}`;
	}

	/** Start the static server on first use. */
	async #ensureServer() {
		if (this.#server !== null) return;
		if (this.#serverPromise !== null) {
			await this.#serverPromise;
			return;
		}
		this.#serverPromise = new Promise((resolveServer, rejectServer) => {
			const server = createServer((req, res) => {
				this.#handleRequest(req, res).catch((error) => {
					console.error('[godot-debug] web preview request failed', error);
					if (!res.headersSent) sendText(res, 500, 'internal error');
					else res.destroy();
				});
			});
			server.once('error', rejectServer);
			server.listen(0, '127.0.0.1', () => {
				this.#port = server.address().port;
				this.#server = server;
				resolveServer();
			});
		});
		try {
			await this.#serverPromise;
		} finally {
			if (this.#server === null) this.#serverPromise = null;
		}
	}

	/**
	 * Build one debug Web export from a private copy of the project.
	 * @param request - optional project path and Godot executable override.
	 * @returns the ready build metadata.
	 */
	async build(request = {}) {
		if (this.#building) throw new WebBuildError('already-building', 'A Web export is already being built.');
		const projectPath = validateProjectPath(
			typeof request.projectPath === 'string' ? request.projectPath : this.#config.projectPath,
		);
		const godotExecutable =
			typeof request.godotExecutable === 'string' && request.godotExecutable !== ''
				? request.godotExecutable
				: this.#config.godotExecutable;
		const gameArgs = webGameArgs(request);
		this.#building = true;
		const startedAt = Date.now();
		const buildId = `${startedAt.toString(36)}-${randomUUID().slice(0, 6)}`;
		const projectHash = createHash('sha1').update(projectPath).digest('hex').slice(0, 12);
		const workRoot = join(this.#cacheRoot, 'work');
		const workDir = join(workRoot, `${projectHash}-${buildId}`);
		const buildRoot = join(this.#cacheRoot, 'builds', projectHash, buildId);
		this.#state = {
			status: 'building',
			buildId,
			projectPath,
			url: null,
			startedAt,
			endedAt: null,
			error: null,
			logTail: '',
		};
		this.#logs.set(buildId, { entries: [], nextSeq: 1, chars: 0 });

		try {
			await this.#ensureServer();
			await mkdir(workRoot, { recursive: true });
			await cp(projectPath, workDir, {
				recursive: true,
				preserveTimestamps: true,
				filter: (source) => {
					const rel = relative(projectPath, source);
					if (rel === '') return true;
					return !EXCLUDED_PROJECT_ENTRIES.has(rel.split(sep)[0]);
				},
			});
			const projectFile = join(workDir, 'project.godot');
			await writeFile(projectFile, addWebRendererOverride(await readFile(projectFile, 'utf8')), 'utf8');
			await writeFile(join(workDir, 'export_presets.cfg'), WEB_EXPORT_PRESET, 'utf8');
			await mkdir(join(workDir, 'build', 'web'), { recursive: true });

			const importLog = await this.#runProcess(
				[godotExecutable, '--headless', '--path', workDir, '--import'],
				workDir,
				120_000,
			);
			this.#state.logTail = appendLogTail(this.#state.logTail, importLog);
			const exportLog = await this.#runProcess(
				[godotExecutable, '--headless', '--path', workDir, '--export-debug', 'Web', 'build/web/index.html'],
				workDir,
				180_000,
			);
			this.#state.logTail = appendLogTail(this.#state.logTail, exportLog);

			const builtIndex = join(workDir, 'build', 'web', 'index.html');
			const html = await readFile(builtIndex, 'utf8');
			await writeFile(builtIndex, injectLogBridge(html, buildId, gameArgs), 'utf8');
			await mkdir(join(this.#cacheRoot, 'builds', projectHash), { recursive: true });
			await rename(join(workDir, 'build', 'web'), buildRoot);
			await rm(workDir, { recursive: true, force: true });
			await this.#cleanupBuilds(projectHash);

			this.#state.status = 'ready';
			this.#state.endedAt = Date.now();
			this.#state.url = `${this.origin}/build/${projectHash}/${buildId}/index.html`;
			return this.snapshot();
		} catch (error) {
			await rm(workDir, { recursive: true, force: true }).catch(() => {});
			const message = error instanceof Error ? error.message : String(error);
			this.#state.status = 'failed';
			this.#state.endedAt = Date.now();
			this.#state.error = message;
			if (error instanceof WebBuildError) throw error;
			throw new WebBuildError('web-build-failed', message);
		} finally {
			this.#building = false;
		}
	}

	/** Delete old builds for one project, keeping the newest few. */
	async #cleanupBuilds(projectHash) {
		const root = join(this.#cacheRoot, 'builds', projectHash);
		let entries;
		try {
			entries = await readdir(root, { withFileTypes: true });
		} catch {
			return;
		}
		const builds = [];
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			try {
				const info = await stat(join(root, entry.name));
				builds.push({ name: entry.name, time: info.mtimeMs });
			} catch {
				// A concurrent cleanup may have removed it already.
			}
		}
		builds.sort((left, right) => right.time - left.time);
		await Promise.all(
			builds.slice(RETAINED_BUILDS).map((entry) => rm(join(root, entry.name), { recursive: true, force: true })),
		);
	}

	/** Run one Godot command and return its combined output. */
	async #runProcess(argv, cwd, timeoutMs) {
		let handle;
		try {
			handle = this.#ctx.subprocess.spawn({
				argv,
				cwd,
				stdio: {
					stdin: 'ignore',
					stdout: { maxBytes: 512 * 1024 },
					stderr: { maxBytes: 512 * 1024 },
				},
				graceMs: 3_000,
			});
		} catch (error) {
			throw new WebBuildError('web-build-failed', error instanceof Error ? error.message : String(error));
		}
		this.#activeHandle = handle;
		const timer = setTimeout(() => {
			try {
				handle.terminate();
			} catch {
				// The process may have exited just before the timeout.
			}
		}, timeoutMs);
		let outcome;
		try {
			outcome = await handle.done;
		} catch (error) {
			throw new WebBuildError('web-build-failed', error instanceof Error ? error.message : String(error));
		} finally {
			clearTimeout(timer);
			if (this.#activeHandle === handle) this.#activeHandle = null;
		}
		const stdout = handle.collected.stdout?.readFrom(0).text ?? '';
		const stderr = handle.collected.stderr?.readFrom(0).text ?? '';
		const output = `${stdout}${stderr}`.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
		if (outcome.exitCode !== 0) {
			const tail = output.trim().slice(-4_000);
			throw new WebBuildError(
				'web-build-failed',
				tail === '' ? `Godot exited with code ${outcome.exitCode}.` : `Godot export failed:\n${tail}`,
			);
		}
		return output;
	}

	/** Append one browser log entry for a known build. */
	#appendWebLog(buildId, level, text, time) {
		const buffer = this.#logs.get(buildId);
		if (buffer === undefined) return;
		const cleaned = String(text).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
		buffer.entries.push({
			seq: buffer.nextSeq++,
			level: ['log', 'info', 'warn', 'error'].includes(level) ? level : 'log',
			time: Number.isFinite(time) ? time : Date.now(),
			text: cleaned.slice(0, 8_000),
		});
		buffer.chars += cleaned.length;
		while (buffer.chars > MAX_WEB_LOG_CHARS && buffer.entries.length > 0) {
			const removed = buffer.entries.shift();
			buffer.chars -= removed.text.length;
		}
	}

	/** Handle the static server's log endpoints and build assets. */
	async #handleRequest(req, res) {
		const url = new URL(req.url ?? '/', 'http://127.0.0.1');
		if (req.method === 'OPTIONS') {
			res.writeHead(204, {
				'access-control-allow-origin': '*',
				'access-control-allow-methods': 'GET, POST, OPTIONS',
				'access-control-allow-headers': 'content-type',
			});
			res.end();
			return;
		}
		if (url.pathname === '/__godot/log') {
			if (req.method !== 'POST') {
				sendText(res, 405, 'POST is required');
				return;
			}
			let body;
			try {
				body = await readJsonBody(req);
			} catch (error) {
				sendText(res, 400, error instanceof Error ? error.message : String(error));
				return;
			}
			if (body === null || typeof body !== 'object' || typeof body.buildId !== 'string' || !Array.isArray(body.entries)) {
				sendText(res, 400, 'invalid log payload');
				return;
			}
			if (!this.#logs.has(body.buildId)) {
				sendText(res, 404, 'unknown build');
				return;
			}
			for (const entry of body.entries.slice(0, 80)) {
				if (entry === null || typeof entry !== 'object') continue;
				this.#appendWebLog(body.buildId, entry.level, entry.text, Number(entry.time));
			}
			res.writeHead(204, { 'access-control-allow-origin': '*' });
			res.end();
			return;
		}
		if (url.pathname === '/__godot/logs') {
			if (req.method !== 'GET') {
				sendText(res, 405, 'GET is required');
				return;
			}
			const buildId = url.searchParams.get('buildId') ?? '';
			const after = Number(url.searchParams.get('after'));
			const buffer = this.#logs.get(buildId);
			if (buffer === undefined) {
				sendJson(res, 404, { ok: false, error: 'unknown-build' });
				return;
			}
			const cursorAfter = Number.isFinite(after) && after > 0 ? Math.floor(after) : 0;
			sendJson(res, 200, {
				ok: true,
				logs: buffer.entries.filter((entry) => entry.seq > cursorAfter),
				cursor: buffer.nextSeq - 1,
			});
			return;
		}
		if (url.pathname.startsWith('/build/')) {
			if (req.method !== 'GET' && req.method !== 'HEAD') {
				sendText(res, 405, 'GET is required');
				return;
			}
			await this.#serveBuildFile(req, res, url);
			return;
		}
		sendText(res, 404, 'not found');
	}

	/** Serve one file from an immutable build directory. */
	async #serveBuildFile(req, res, url) {
		let pathname;
		try {
			pathname = decodeURIComponent(url.pathname);
		} catch {
			sendText(res, 400, 'invalid path');
			return;
		}
		const segments = pathname.split('/').filter((segment) => segment !== '');
		if (segments.length < 4 || segments[0] !== 'build') {
			sendText(res, 404, 'not found');
			return;
		}
		const [, projectHash, buildId, ...rest] = segments;
		if (!/^[0-9a-f]{12}$/.test(projectHash) || !/^[a-z0-9-]+$/.test(buildId) || rest.length === 0) {
			sendText(res, 404, 'not found');
			return;
		}
		const root = resolve(this.#cacheRoot, 'builds', projectHash, buildId);
		const target = resolve(root, ...rest);
		if (target !== root && !target.startsWith(root + sep)) {
			sendText(res, 403, 'forbidden');
			return;
		}
		let info;
		try {
			info = await stat(target);
		} catch {
			sendText(res, 404, 'not found');
			return;
		}
		if (!info.isFile()) {
			sendText(res, 404, 'not found');
			return;
		}
		const extension = extname(target).toLowerCase();
		const headers = {
			'content-type': MIME_TYPES[extension] ?? 'application/octet-stream',
			'content-length': String(info.size),
			'cache-control': extension === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
			'access-control-allow-origin': '*',
			'cross-origin-resource-policy': 'cross-origin',
		};
		res.writeHead(200, headers);
		if (req.method === 'HEAD') {
			res.end();
			return;
		}
		createReadStream(target).pipe(res);
	}

	/** Stop the static server and any in-flight Godot export. */
	dispose() {
		if (this.#activeHandle !== null) {
			try {
				this.#activeHandle.terminate();
			} catch {
				// The subprocess service may already be tearing down.
			}
			this.#activeHandle = null;
		}
		if (this.#server !== null) {
			try {
				this.#server.close();
				this.#server.closeAllConnections?.();
			} catch {
				// Server already closed.
			}
			this.#server = null;
			this.#serverPromise = null;
			this.#port = 0;
		}
	}
}
