/**
 * What a BROWSER sees when it cannot be served a preview.
 *
 * A preview origin is a real website address: people paste it, bookmark it, and
 * open it in a fresh tab with no cookie. Answering `{"error":"Unauthorized"}`
 * there is a bug — it is a machine's answer rendered as the whole page, and it
 * tells the person nothing and offers them nothing.
 *
 * So a document navigation gets a page: what this is, and one action that fixes
 * it. Sub-resource and XHR requests keep the JSON, because a `fetch('/api')`
 * inside the app must not suddenly receive HTML.
 *
 * Self-contained (inline CSS, no network), theme-aware, and styled from the web
 * app's tokens — the same approach as `portUnreachableHtml` in routes/preview.ts.
 */

export type PreviewGateReason = 'unauthorized' | 'forbidden' | 'unknown';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) =>
    ch === '&' ? '&amp;'
    : ch === '<' ? '&lt;'
    : ch === '>' ? '&gt;'
    : ch === '"' ? '&quot;'
    : '&#39;');
}

interface GateCopy {
  title: string;
  body: string;
  action: 'sign-in' | 'none';
}

function copyFor(reason: PreviewGateReason): GateCopy {
  switch (reason) {
    case 'unauthorized':
      return {
        title: 'Sign in to open this preview',
        body: 'This is a private preview of a Kortix sandbox. Sign in with the account that owns it and you will come straight back here.',
        action: 'sign-in',
      };
    case 'forbidden':
      return {
        title: 'This preview address is not signed',
        body: 'The request reached Kortix without the edge signature that binds it to this hostname. Open the preview from your Kortix session.',
        action: 'sign-in',
      };
    case 'unknown':
      return {
        title: 'This preview is no longer available',
        body: 'The sandbox behind this address does not exist any more. Sessions release their sandboxes when they are deleted.',
        action: 'none',
      };
  }
}

/**
 * The page itself. `returnTo` is the URL the person is trying to reach; the
 * sign-in action carries it to the web app, which sends them back with a
 * one-shot token once they are authenticated (see /preview/authorize).
 */
export function previewGatePage(input: {
  reason: PreviewGateReason;
  frontendUrl: string;
  returnTo: string;
}): string {
  const { title, body, action } = copyFor(input.reason);
  const base = input.frontendUrl.replace(/\/+$/, '');
  const href = `${base}/preview/authorize?to=${encodeURIComponent(input.returnTo)}`;

  // `target="_top"` matters: a preview is usually an iframe inside the Kortix
  // session panel, and a sign-in flow started INSIDE that frame would try to
  // render the whole web app in a preview pane. Break out to the tab instead.
  const button =
    action === 'sign-in' && base
      ? `<a class="btn" id="signin" href="${escapeHtml(href)}" target="_top" rel="noopener">Sign in to Kortix</a>`
      : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root {
    color-scheme: light dark;
    --background: oklch(1 0 0);
    --foreground: oklch(0 0 0);
    --secondary: oklch(0.9431 0 0);
    --muted-foreground: oklch(0.5103 0 0);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --background: oklch(0.1398 0 0);
      --foreground: oklch(1 0 0);
      --secondary: oklch(0.2264 0 0);
      --muted-foreground: oklch(0.683 0 0);
    }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: var(--secondary); color: var(--foreground); padding: 24px;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    text-align: center; max-width: 380px;
  }
  h1 { font-size: 15px; font-weight: 600; margin: 0; }
  p { font-size: 13px; color: var(--muted-foreground); margin: 0; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    height: 32px; padding: 0 14px; margin-top: 4px; border-radius: 8px;
    font: inherit; font-weight: 500; text-decoration: none; cursor: pointer;
    background: var(--foreground); color: var(--background);
    transition: opacity .15s;
  }
  .btn:hover { opacity: .9; }
  code {
    font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--muted-foreground); word-break: break-all;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
    ${button}
    <code>${escapeHtml(input.returnTo)}</code>
  </div>
  <script>
    // Carry the address the browser is ACTUALLY on, including any fragment the
    // server never sees, so the round trip lands on the same page.
    (function () {
      var a = document.getElementById('signin');
      if (!a) return;
      try {
        var u = new URL(a.href);
        u.searchParams.set('to', window.location.href);
        a.href = u.toString();
      } catch (e) {}
    })();
  </script>
</body>
</html>`;
}
