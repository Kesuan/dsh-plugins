/**
 * Host half of the Session Delete bundle.
 *
 * The Web UI needs one operation the generated Remote namespaces do not offer:
 * permanently removing a stored Session. This plugin exposes that operation on
 * a same-origin loopback route, guarded by a custom header and an Origin check
 * so an ordinary cross-origin page cannot reach it. The route performs no
 * prompting; the Client dialog owns confirmation.
 */
import { deleteSession, SessionDeleteError } from './delete.js';

/** Longest accepted JSON request body. */
const MAX_BODY_BYTES = 8 * 1024;

/** Services this route cannot work without. */
export const inject = ['webServer', 'sessions', 'sessionPersistence', 'workspaceRegistry'];

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
 * @returns the parsed value.
 * @throws an Error with a `code` property for invalid or oversized bodies.
 */
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

/**
 * Whether a socket peer is this machine. The route is a local maintenance
 * operation even when the GUI listener is bound to a LAN interface.
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
 * Whether a request Origin names the same loopback listener. The advertised
 * origin uses the configured bind host, while a browser may reach the same
 * listener through `localhost` or `[::1]`; those aliases are equivalent for
 * this local-only route.
 * @param origin - the request's Origin header.
 * @param expected - the server's advertised origin.
 * @returns whether the request may proceed.
 */
function isAllowedOrigin(origin, expected) {
	if (origin === undefined) return true;
	if (origin === expected) return true;
	try {
		const actual = new URL(origin);
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

/**
 * Handle one deletion request.
 * @param ctx - Host context.
 * @param req - the HTTP request.
 * @param res - the HTTP response.
 */
async function handleDeleteRequest(ctx, req, res) {
	if (req.method !== 'POST') {
		sendJson(res, 405, { ok: false, error: 'method', message: 'POST is required' });
		return;
	}

	if (!isLoopbackAddress(req.socket.remoteAddress)) {
		sendJson(res, 403, { ok: false, error: 'loopback', message: 'local requests only' });
		return;
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
			return;
		}
	}

	if (req.headers['x-dsh-session-delete'] !== '1') {
		sendJson(res, 403, { ok: false, error: 'forbidden', message: 'missing deletion header' });
		return;
	}

	if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] ?? ''))) {
		sendJson(res, 415, { ok: false, error: 'content-type', message: 'application/json is required' });
		return;
	}

	const declaredLength = Number(req.headers['content-length']);
	if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
		sendJson(res, 413, { ok: false, error: 'too-large', message: 'request body is too large' });
		return;
	}

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

	if (body === null || typeof body !== 'object' || typeof body.sessionId !== 'string') {
		sendJson(res, 400, { ok: false, error: 'invalid', message: 'sessionId is required' });
		return;
	}

	try {
		const result = await deleteSession(ctx, body.sessionId);
		sendJson(res, 200, { ok: true, freedBytes: result.freedBytes, cacheRemoved: result.cacheRemoved });
	} catch (error) {
		if (error instanceof SessionDeleteError) {
			const status =
				error.code === 'not-found'
					? 404
					: error.code === 'live'
						? 409
						: error.code === 'invalid'
							? 400
							: error.code === 'layout'
								? 500
								: 500;
			sendJson(res, status, { ok: false, error: error.code, message: error.message });
			return;
		}
		console.error('[session-delete] failed to delete a Session', error);
		sendJson(res, 500, {
			ok: false,
			error: 'io',
			message: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Register the loopback deletion route.
 * @param ctx - Host context.
 */
export function apply(ctx) {
	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: 'exact',
				path: '/local/session-delete',
				handler: (req, res) => handleDeleteRequest(ctx, req, res),
			}),
		'session-delete: http route',
	);
}
