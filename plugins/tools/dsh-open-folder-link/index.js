/**
 * Host half of the Open Folder Link bundle.
 *
 * The Client half detects a folder link and asks this half to open it. The
 * route is loopback-only and hands the path to the Session Controller's
 * authorized desktop opener, so the Client never needs a Cordis Remote
 * namespace of its own.
 */

/** Largest accepted request body. */
const MAX_BODY_BYTES = 8 * 1024;

/** Only the plugin's own route answers here. */
const ROUTE_PATH = '/local/open-folder-link/open';

/**
 * Write one JSON response.
 * @param res - the HTTP response.
 * @param status - HTTP status code.
 * @param payload - JSON-serializable body.
 */
function sendJson(res, status, payload) {
	const body = JSON.stringify(payload);
	res.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'content-length': String(Buffer.byteLength(body)),
		'cache-control': 'no-store',
	});
	res.end(body);
}

/**
 * Read and parse one bounded JSON body.
 * @param req - the HTTP request.
 * @returns the parsed object, or undefined when the body is not an object.
 */
function readJsonBody(req) {
	return new Promise((resolve) => {
		let size = 0;
		let settled = false;
		const chunks = [];
		const finish = (value) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};
		req.on('data', (chunk) => {
			size += chunk.length;
			if (size > MAX_BODY_BYTES) {
				req.destroy();
				finish(undefined);
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => {
			try {
				const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
				finish(value !== null && typeof value === 'object' ? value : undefined);
			} catch {
				finish(undefined);
			}
		});
		req.on('error', () => finish(undefined));
	});
}

/**
 * Whether a socket peer is this machine.
 * @param address - `req.socket.remoteAddress`.
 * @returns whether the peer is loopback.
 */
function isLoopbackAddress(address) {
	return (
		address === '127.0.0.1' ||
		address === '::1' ||
		address === '::ffff:127.0.0.1' ||
		address === '::ffff:7f00:1'
	);
}

/**
 * Open one folder in the desktop file manager.
 * @param ctx - Host context.
 * @param req - the HTTP request.
 * @param res - the HTTP response.
 */
async function handleOpen(ctx, req, res) {
	if (req.method !== 'POST') {
		sendJson(res, 405, { ok: false, error: 'method', message: 'POST is required' });
		return;
	}
	if (!isLoopbackAddress(req.socket.remoteAddress)) {
		sendJson(res, 403, { ok: false, error: 'loopback', message: 'local requests only' });
		return;
	}

	const body = await readJsonBody(req);
	if (body === undefined || typeof body.path !== 'string' || body.path === '') {
		sendJson(res, 400, { ok: false, error: 'invalid', message: 'a non-empty path is required' });
		return;
	}

	try {
		// The Remote method requires its caller-lifetime signal; this route is the
		// whole operation, so it owns one and never aborts it.
		await ctx.sessionController.openWorkspacePath(
			{ path: body.path, action: 'reveal' },
			new AbortController().signal,
		);
		sendJson(res, 200, { ok: true, opened: true, path: body.path });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const code = typeof error?.code === 'string' ? error.code : 'open-failed';
		sendJson(res, 502, { ok: false, error: code, message, path: body.path });
	}
}

/** Services this bundle cannot work without. */
export const inject = ['webServer', 'sessionController'];

/**
 * Register the loopback open route.
 * @param ctx - Host context.
 */
export function apply(ctx) {
	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: 'exact',
				path: ROUTE_PATH,
				handler: (req, res) => void handleOpen(ctx, req, res),
			}),
		'open-folder-link: open route',
	);
}
