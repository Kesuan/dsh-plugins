/**
 * Host entry of the Godot Debug bundle.
 *
 * All behavior lives in `server.js`; this file keeps the bundle package-root
 * export stable for the Loader.
 */
export { apply, inject, GodotDebugController, GodotDebugError, buildGodotArgv } from './server.js';
