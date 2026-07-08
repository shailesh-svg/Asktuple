# Gaugetuple Capture — Asktuple dev helper

Internal Newtuple Chrome extension. Three jobs, all feeding the Asktuple wiring:

0. **Enable iframe embedding (live-view demo)** — the Asktuple shell has a
   "Live Gaugetuple view" toggle that deep-links the REAL Gaugetuple UI into an
   iframe per resolved intent. Browsers block that two ways; the extension
   fixes both, scoped to `dev.gaugetuple.com` sub-frames only:
   - `rules.json` strips `X-Frame-Options` / CSP frame-blocking response headers.
   - The popup's **Enable iframe embedding** button rewrites your session
     cookies to `SameSite=None; Secure` so the login works inside the frame.
   If the frame still shows a login page, allow third-party cookies for
   `localhost:5173` in Chrome site settings. UI routes per intent live in
   `apps/shell/src/live/liveRoutes.ts` — correct the guesses there once.

1. **Copy session cookie** — one click, paste as `GAUGETUPLE_COOKIE` for the
   MCP capability server (unblocks P0 live reads).
2. **Record mutation requests** — while you use the real Gaugetuple UI, every
   POST/PUT/PATCH/DELETE to `/evals/*` or `/authtuple/*` is logged with method,
   path, and JSON body. Click through New Evaluation Wizard → submit, create a
   golden dataset, and Export PPT, then "Copy captured mutations" and paste the
   JSON back into the repo/chat. That is everything P1 needs to fill
   `executeApproved()` in `servers/gaugetuple-mcp/src/tools.ts`.

## Install

1. Chrome → `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this folder (`tools/gaugetuple-capture`).
3. Log in at `dev.gaugetuple.com`, click the extension icon.

Data stays local (chrome.storage.local, last 200 requests). The cookie goes to
your clipboard only. Remove the extension when P0/P1 are wired.
