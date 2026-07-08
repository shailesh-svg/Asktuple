import { useState } from "react";
import type { DoorResponse, ProfileId, ProposedAction } from "@asktuple/contract";
import { Door } from "./door/Door.js";
import { renderCard } from "./registry/cardRegistry.js";
import { LiveView } from "./live/LiveView.js";
import { liveUrlAfterApproval } from "./live/liveRoutes.js";

const GATEWAY = import.meta.env.VITE_ASKTUPLE_GATEWAY ?? "http://localhost:8787";

const PROFILES: { id: ProfileId; label: string }[] = [
  { id: "ai_engineer", label: "AI Engineer" },
  { id: "eval_engineer", label: "Eval Engineer" },
  { id: "delivery_lead", label: "Delivery Lead" },
  { id: "client_viewer", label: "Client / Leadership" },
];

/**
 * The Asktuple shell. Chat is the entry door, not the whole product. The
 * response renders as a native card in the workbench, chosen from a fixed
 * registry. Switching profile changes both what you can ask and what you see.
 */
export function App() {
  const [profile, setProfile] = useState<ProfileId>("ai_engineer");
  const [response, setResponse] = useState<DoorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveView, setLiveView] = useState(false);
  const [liveOverride, setLiveOverride] = useState<string | null>(null);

  async function ask(intent: string) {
    setLoading(true);
    setLiveOverride(null); // a new intent re-points the live view by its own route
    try {
      const res = await fetch(`${GATEWAY}/door`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, intent }),
      });
      setResponse(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function approve(p: ProposedAction): Promise<string> {
    // Approval is by proposal id only — the host holds what will execute.
    const res = await fetch(`${GATEWAY}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile, proposalId: p.id }),
    });
    if (res.status === 403) return "denied: your profile lacks this capability.";
    if (res.status === 404) return "denied: this proposal expired or was already used. Ask again to get a fresh one.";
    const data = await res.json().catch(() => ({}));
    if (data.ok) setLiveOverride(liveUrlAfterApproval()); // show where the work landed
    return data.note ?? (data.ok ? "Executed." : "Could not execute.");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", height: "100vh" }}>
      <aside style={{ borderRight: "1px solid var(--gray-200)", padding: 24 }}>
        <div style={{ fontWeight: 700, color: "var(--cobalt)", letterSpacing: 2, fontSize: 14 }}>
          ASKTUPLE
        </div>
        <p style={{ color: "var(--gray-600)", fontSize: 14, marginTop: 4 }}>
          One door to Gaugetuple. Just ask.
        </p>

        <label
          style={{ display: "block", marginTop: 24, fontSize: 11, letterSpacing: 1, color: "var(--gray-600)" }}
        >
          PROFILE
        </label>
        <select
          value={profile}
          onChange={(e) => setProfile(e.target.value as ProfileId)}
          style={{
            marginTop: 6,
            width: "100%",
            padding: 8,
            borderRadius: 8,
            border: "1px solid var(--gray-200)",
            font: "inherit",
          }}
        >
          {PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <Door onAsk={ask} loading={loading} profile={profile} />

        <label
          style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, fontSize: 13, color: "var(--gray-600)", cursor: "pointer" }}
        >
          <input type="checkbox" checked={liveView} onChange={(e) => setLiveView(e.target.checked)} />
          Live Gaugetuple view (demo)
        </label>
      </aside>

      <main style={{ padding: 32, overflow: "auto" }}>
        {response ? (
          <>
            {renderCard(response.result, { onAsk: ask, onApprove: approve })}
            <Trace response={response} />
            {liveView && <LiveView resolvedToolId={response.resolvedToolId} overrideUrl={liveOverride} />}
          </>
        ) : (
          <Empty />
        )}
      </main>
    </div>
  );
}

/** Transparency: which tool answered, how it was resolved, what was read on the way. */
function Trace({ response }: { response: DoorResponse }) {
  if (!response.resolvedToolId) return null;
  const reads = (response.steps ?? []).filter((s) => s.toolId !== response.resolvedToolId);
  return (
    <div style={{ marginTop: 20, fontSize: 12, color: "var(--gray-600)" }}>
      Resolved to <code>{response.resolvedToolId}</code> via {response.resolver === "llm" ? "the planner" : "keyword fallback"}
      {reads.length > 0 && (
        <> · grounded on {reads.map((s) => <code key={s.toolId} style={{ marginLeft: 4 }}>{s.toolId.split(".").pop()}</code>)}</>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div style={{ color: "var(--gray-600)", maxWidth: 560 }}>
      <h1 style={{ fontWeight: 300, fontSize: 40, color: "var(--gray-900)" }}>
        What do you want to evaluate?
      </h1>
      <p>
        Describe it in plain language. Asktuple resolves who you are, reads what is true in
        Gaugetuple, and assembles the right view. Anything that changes data comes back as a
        proposal you approve.
      </p>
    </div>
  );
}
