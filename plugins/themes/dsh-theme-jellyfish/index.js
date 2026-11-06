/**
 * Host half of the Jellyfish theme bundle.
 *
 * The whole theme is a browser concern: `client.js` registers the palette
 * through the Client Theme service, injects the aquarium stylesheet, adds
 * the Settings accent row, and shadows the sidebar brand slots with the
 * jellyfish mark and wordmark. This module only keeps the bundle row loadable
 * and the Client module discoverable through the package manifest.
 */
export function apply() {}
