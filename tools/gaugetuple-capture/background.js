// Records mutation requests to dev.gaugetuple.com while you use the real UI.
// Captures method, path, and JSON body — exactly what P1 needs to fill
// executeApproved() in servers/gaugetuple-mcp/src/tools.ts.

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function decodeBody(details) {
  try {
    const raw = details.requestBody?.raw?.[0]?.bytes;
    if (raw) {
      const text = new TextDecoder("utf-8").decode(raw);
      try {
        return JSON.parse(text);
      } catch {
        return text.slice(0, 4000);
      }
    }
    if (details.requestBody?.formData) return details.requestBody.formData;
  } catch {
    /* body not readable; method+path still valuable */
  }
  return null;
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!MUTATION_METHODS.has(details.method)) return;
    const url = new URL(details.url);
    // Only the app API surfaces matter.
    if (!/^\/(evals|authtuple)\//.test(url.pathname)) return;

    const entry = {
      at: new Date().toISOString(),
      method: details.method,
      path: url.pathname + url.search,
      body: decodeBody(details),
    };
    chrome.storage.local.get({ captured: [] }, ({ captured }) => {
      captured.push(entry);
      chrome.storage.local.set({ captured: captured.slice(-200) });
    });
  },
  { urls: ["https://dev.gaugetuple.com/*"] },
  ["requestBody"],
);
