import { useState } from "react";
import { liveUrlFor } from "./liveRoutes.js";

/**
 * Live Gaugetuple view: the real product UI in an iframe, deep-linked from the
 * resolved intent. Fully interactive — the demo shows Asktuple driving the
 * actual app, not a mock of it. Requires the capture extension's
 * "Enable iframe embedding" (see the hint shown under the frame).
 */
export function LiveView({ resolvedToolId }: { resolvedToolId: string | null }) {
  const url = liveUrlFor(resolvedToolId);
  const [key, setKey] = useState(0);

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontWeight: 600, fontSize: 16, color: "var(--gray-900)", margin: 0 }}>
          Live Gaugetuple
        </h2>
        <code
          style={{
            fontSize: 11,
            color: "var(--gray-600)",
            background: "var(--gray-50)",
            border: "1px solid var(--gray-200)",
            borderRadius: 6,
            padding: "2px 8px",
            maxWidth: 420,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {url}
        </code>
        <button style={miniBtn} onClick={() => setKey((k) => k + 1)}>
          Reload
        </button>
        <a href={url} target="_blank" rel="noreferrer" style={{ ...miniBtn, textDecoration: "none", color: "var(--gray-900)" }}>
          Open in tab ↗
        </a>
      </div>
      <iframe
        key={key}
        src={url}
        title="Gaugetuple live view"
        style={{
          width: "100%",
          height: "68vh",
          border: "1px solid var(--gray-200)",
          borderRadius: 16,
          background: "white",
        }}
      />
      <p style={{ fontSize: 12, color: "var(--gray-600)", marginTop: 6 }}>
        Blank or login page? Install the Gaugetuple Capture extension, log in at
        dev.gaugetuple.com, click <b>Enable iframe embedding</b> in its popup, then Reload.
        Route wrong for this intent? Fix the one-line map in{" "}
        <code>apps/shell/src/live/liveRoutes.ts</code>.
      </p>
    </section>
  );
}

const miniBtn: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 9999,
  border: "1px solid var(--gray-200)",
  background: "white",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};
