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

$("clear").addEventListener("click", async () => {
  await chrome.storage.local.set({ captured: [] });
  setStatus("Cleared.");
  refresh();
});

refresh();
setInterval(refresh, 1500);
