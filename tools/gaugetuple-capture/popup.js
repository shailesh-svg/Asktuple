const $ = (id) => document.getElementById(id);

function setStatus(msg) {
  $("status").textContent = msg;
}

async function refresh() {
  const { captured = [] } = await chrome.storage.local.get({ captured: [] });
  $("count").textContent = String(captured.length);
  $("log").textContent = captured
    .map((e) => `${e.method} ${e.path}\n${e.body ? JSON.stringify(e.body, null, 2) : "(no body)"}\n`)
    .join("\n");
}

$("cookie").addEventListener("click", async () => {
  const cookies = await chrome.cookies.getAll({ domain: "dev.gaugetuple.com" });
  if (!cookies.length) return setStatus("No cookies found — log in at dev.gaugetuple.com first.");
  const header = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  await navigator.clipboard.writeText(header);
  setStatus(`Copied ${cookies.length} cookies. Paste as: GAUGETUPLE_COOKIE='<paste>' pnpm dev:gaugetuple`);
});

$("export").addEventListener("click", async () => {
  const { captured = [] } = await chrome.storage.local.get({ captured: [] });
  if (!captured.length) return setStatus("Nothing captured yet — click through the wizard first.");
  await navigator.clipboard.writeText(JSON.stringify(captured, null, 2));
  setStatus(`Copied ${captured.length} requests as JSON. Paste into the Asktuple repo / chat to wire executeApproved().`);
});

$("iframe").addEventListener("click", async () => {
  // The Asktuple live view frames dev.gaugetuple.com from localhost:5173, a
  // third-party context. Cookies default to SameSite=Lax and are not sent to
  // the frame, so the app shows a login page. Rewriting the session cookies to
  // SameSite=None; Secure lets the existing login work inside the iframe.
  // (Frame-blocking headers are already stripped by rules.json.)
  const cookies = await chrome.cookies.getAll({ domain: "dev.gaugetuple.com" });
  if (!cookies.length) return setStatus("No cookies — log in at dev.gaugetuple.com first.");
  let updated = 0;
  for (const c of cookies) {
    try {
      await chrome.cookies.set({
        url: `https://dev.gaugetuple.com${c.path}`,
        name: c.name,
        value: c.value,
        path: c.path,
        secure: true,
        httpOnly: c.httpOnly,
        sameSite: "no_restriction",
        expirationDate: c.expirationDate,
        ...(c.domain.startsWith(".") ? { domain: c.domain } : {}),
      });
      updated++;
    } catch {
      /* some cookies (e.g. __Host-) refuse edits; the session one usually accepts */
    }
  }
  setStatus(`Iframe embedding enabled: ${updated}/${cookies.length} cookies now SameSite=None. Reload the Asktuple live view. If still blank, allow third-party cookies for localhost:5173 in Chrome site settings.`);
});

$("clear").addEventListener("click", async () => {
  await chrome.storage.local.set({ captured: [] });
  setStatus("Cleared.");
  refresh();
});

refresh();
setInterval(refresh, 1500);
