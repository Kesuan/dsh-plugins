window.__ModuleLoader__.load({
  id: '@local/dsh-open-folder-link',
  factory() {
    /** Every file address DSH renders for a local path opens with this prefix. */
    const FILE_ADDRESS_PREFIX = 'dsh-resource://file/';

    /** Whether a value ends with a path separator, i.e. names a folder. */
    function isFolderPath(value) {
      return /[\\/]$/.test(value.trim());
    }

    /**
     * Decode one address segment, preserving its separators.
     * @param segments - encoded path segments.
     * @returns the decoded `/`-separated path.
     */
    function decodeSegments(segments) {
      return segments.map((segment) => decodeURIComponent(segment)).join('/');
    }

    /**
     * Read the local path out of a DSH file address.
     *
     * `dsh-resource://file/session/<sessionId>/<path>` carries a Session-scoped
     * path and `dsh-resource://file/absolute/<path>` an absolute one. Both
     * preserve leading slashes, and the address drops a trailing slash.
     * @param href - an anchor href.
     * @returns the local path, or null when the href is not a file address.
     */
    function fileAddressPath(href) {
      if (!href.startsWith(FILE_ADDRESS_PREFIX)) return null;
      const end = href.search(/[?#]/);
      const rest = href.slice(FILE_ADDRESS_PREFIX.length, end === -1 ? undefined : end);
      const [scope, ...segments] = rest.split('/');
      try {
        if (scope === 'session') {
          const [sessionId, ...pathSegments] = segments;
          if (sessionId === undefined || sessionId === '') return null;
          return decodeSegments(pathSegments);
        }
        if (scope === 'absolute') return decodeSegments(segments);
      } catch {
        return null;
      }
      return null;
    }

    /**
     * Read the local path out of a `file://` URL.
     * @param href - an anchor href.
     * @returns the local path, or null for any other URL.
     */
    function fileUrlPath(href) {
      let url;
      try {
        url = new URL(href);
      } catch {
        return null;
      }
      const path = decodeURIComponent(url.pathname);
      if (url.hostname !== '' && url.hostname !== 'localhost') {
        return `//${url.hostname}${path}`;
      }
      // Windows drive letters stay drive-rooted; other platforms keep the slash.
      return /^\/[A-Za-z]:\//.test(path) ? path.slice(1) : path;
    }

    /**
     * Resolve the folder path one rendered link points at.
     *
     * DSH renders a local file link as a `<button class="…fileLink…" title="<path>">`,
     * not an anchor, and its `title` keeps the trailing slash that marks a folder.
     * Anchors are still supported for `dsh-resource:` and `file:` hrefs.
     * @param element - the clicked element.
     * @returns the path to hand the Host, or null when this is not a local folder link.
     */
    function folderPathOf(element) {
      const anchor = element.closest('a[href]');
      if (anchor !== null) {
        const href = anchor.getAttribute('href');
        if (href !== null && href !== '' && !href.startsWith('#')) {
          if (href.startsWith(FILE_ADDRESS_PREFIX)) {
            // DSH file addresses drop the trailing slash, so the scheme decides.
            return fileAddressPath(href);
          }
          if (/^file:/i.test(href) && isFolderPath(href)) return fileUrlPath(href);
        }
      }

      const link = element.closest('[title]');
      if (link === null) return null;
      // Only the file-link control DSH renders for a local path qualifies: a
      // button-like element whose tooltip is a folder path.
      if (!link.matches('button, [role="button"], [class*="fileLink"]')) return null;
      const title = link.getAttribute('title');
      return title !== null && isFolderPath(title) ? title.trim() : null;
    }

    /**
     * Ask the Host half to open one folder in the desktop file manager.
     * @param path - Host filesystem path.
     */
    function openFolder(path) {
      fetch('/local/open-folder-link/open', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path }),
      }).catch((error) => {
        console.error('[open-folder-link] Could not open folder:', path, error);
      });
    }

    return {
      apply(ctx) {
        const listener = (event) => {
          if (event.defaultPrevented || event.button !== 0) return;
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          if (!(event.target instanceof Element)) return;

          const path = folderPathOf(event.target);
          if (path === null) return;

          // Claim the gesture before DSH's own handler opens the file preview.
          event.preventDefault();
          event.stopPropagation();

          openFolder(path);
        };

        ctx.effect(() => {
          window.addEventListener('click', listener, true);
          return () => window.removeEventListener('click', listener, true);
        }, 'open-folder-link: click handler');
      },
    };
  },
});
