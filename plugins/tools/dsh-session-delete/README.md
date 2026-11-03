# Session Delete

Permanently deletes one stored DSH Session from the sidebar, behind a
confirmation dialog. This is **out-of-band maintenance with a UI**: DSH's
Session persistence seam is append-only and exposes no delete operation, so the
plugin removes the stored Session directory itself.

## Behavior

- Adds **Delete session…** to the Session row's `...` menu, after Copy Session
  ID, with a red label.
- The dialog names the Session and warns that the action is irreversible and
  stops the Session's running turns, subagents, background jobs, and reminders.
- On confirm, the Host:
  1. refuses a Session that is still open in the Host;
  2. archives the Session with `{ stopActivity: true }` so the durable archive
     gate blocks every wake-up a stop induces;
  3. removes `<sessions>/<project>/<sessionId>/` (all log generations and
     `session.lock`);
  4. removes the Session's projection checkpoint under
     `storages/session_projcache/sessions/`;
  5. releases the id from the archive and pin sets;
  6. reloads the page so the sidebar list reflects the removal.
- Forks and subagent children are separate Sessions and are not deleted. Their
  stored `parentSession` references become dangling, which the Host tolerates.
- Attachments are content-addressed and shared, so image/file blobs are left in
  place; deleting a log can leave orphaned blobs.

## Limits

- The route is served by the Host Web server. The Web GUI reaches it directly
  and the Desktop `dsh-app://app` renderer forwards it through the app's
  protocol handler. A deployment with no Host process has no route.
- The Session must be closed first. A live Session is refused rather than
  stopped, because a live writer can recreate the log.
- The deletion relies on the JSONL backend's `root`/`locate()` and the
  `session_projcache` path. A future storage layout change may defeat the
  directory lookup; the plugin then fails closed instead of deleting a
  different directory.
- No trash folder and no undo.

## Install

From the DSH profile that should expose the menu:

```text
plugin_manager install_bundle target=/path/to/dsh-session-delete
```

Refresh the Web page after installation to load the new Client module.
