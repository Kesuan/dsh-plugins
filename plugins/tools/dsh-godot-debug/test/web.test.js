import assert from 'node:assert/strict';
import test from 'node:test';
import { addWebRendererOverride, injectLogBridge } from '../web.js';

test('addWebRendererOverride adds a Web-only compatibility renderer without touching the base renderer', () => {
	const input = '[rendering]\nrenderer/rendering_method="mobile"\ntextures/default_filters/anisotropic_filtering_level=4\n\n[input]\nx=1\n';
	const output = addWebRendererOverride(input);
	assert.match(output, /renderer\/rendering_method="mobile"/);
	assert.match(output, /renderer\/rendering_method\.web="gl_compatibility"/);
	assert.match(output, /\[input\]\nx=1/);
});

test('addWebRendererOverride preserves an existing Web override and appends a section when needed', () => {
	const existing = '[rendering]\nrenderer/rendering_method.web="gl_compatibility"\n';
	assert.equal(addWebRendererOverride(existing), existing);
	const appended = addWebRendererOverride('[application]\nconfig/name="x"\n');
	assert.match(appended, /\[rendering\]\nrenderer\/rendering_method\.web="gl_compatibility"/);
});

test('injectLogBridge forwards console messages and preserves the engine timing', () => {
	const html =
		'<html><head><title>x</title></head><body><script>const GODOT_CONFIG = {"args":[],"canvasResizePolicy":2}; engine.startGame()</script></body></html>';
	const output = injectLogBridge(html, 'build-123', ['--dev-hud', '--skip-intro']);
	assert.match(output, /build-123/);
	assert.match(output, /\/__godot\/log/);
	assert.match(output, /console\[level\]/);
	assert.match(output, /"args":\["--","--dev-hud","--skip-intro"\]/);
	assert.ok(output.indexOf('build-123') < output.indexOf('engine.startGame()'));
});
