import { useState } from "react";
import type { DoorResponse, ProfileId, ProposedAction } from "@asktuple/contract";
import { Door } from "./door/Door.js";
import { renderCard } from "./registry/cardRegistry.js";
import { LiveView } from "./live/LiveView.js";
import { LiveRun } from "./live/LiveRun.js";
import { liveUrlAfterApproval } from "./live/liveRoutes.js";
import { GuidedDemo } from "./demo/GuidedDemo.js";
import { DEMO_SCRIPT } from "./demo/script.js";

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
  const [runChannel, setRunChannel] = useState<string | null>(null);
  const [demoStep, setDemoStep] = useState<number | null>(null);

  function startDemo() {
    setDemoStep(0);
    setLiveView(true); // the demo drives the real product screen alongside the cards
    const first = DEMO_SCRIPT[0];
    if (first.intent) ask(first.intent);
  }

  function demoNext() {
    if (demoStep == null) return;
    const next = demoStep + 1;
    if (next >= DEMO_SCRIPT.length) {
      setDemoStep(null);
      return;
    }
    setDemoStep(next);
    const step = DEMO_SCRIPT[next];
    if (step.intent) ask(step.intent);
  }

  async function ask(intent: string) {
    setLoading(true);
    setLiveOverride(null); // a new intent re-points the live view by its own route
    setRunChannel(null);
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
    if (data.ok) {
      setLiveOverride(liveUrlAfterApproval()); // show where the work landed
      if (data.broadcastChannel) setRunChannel(data.broadcastChannel); // open the live stream
    }
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

        <button
          onClick={startDemo}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "10px 16px",
            borderRadius: 9999,
            border: "1px solid var(--cobalt)",
            background: "white",
            color: "var(--cobalt)",
            font: "inherit",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ▶ Guided demo
        </button>
      </aside>

      <main style={{ padding: 32, overflow: "auto" }}>
        {demoStep != null && (
          <GuidedDemo
            step={demoStep}
            runStarted={runChannel != null}
            onNext={demoNext}
            onExit={() => setDemoStep(null)}
          />
        )}
        {response ? (
          <>
            {renderCard(response.result, { onAsk: ask, onApprove: approve })}
            {runChannel && <LiveRun gateway={GATEWAY} channel={runChannel} />}
            <Trace response={response} />
            {liveView && <LiveView resolvedToolId={response.resolvedToolId} overrideUrl={liveOverride} />}
          </>
        ) : (
          <Empty onAsk={ask} />
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

/** Onboarding: the guided tour IS the empty state — each step fires a real intent. */
const TOUR: { step: string; why: string; intent: string }[] = [
  {
    step: "What is Gaugetuple?",
    why: "60-second primer: datasets, criteria, eval types, runs.",
    intent: "What is Gaugetuple?",
  },
  {
    step: "See the platform",
    why: "Live KPIs — note the 0 golden datasets. That's the gap.",
    intent: "Show platform overview",
  },
  {
    step: "Look at real runs",
    why: "Run History is the audit trail: pass rates, providers, verdicts.",
    intent: "List my recent eval runs",
  },
  {
    step: "Run a check by sentence",
    why: "The agent finds real datasets, proposes a concrete run — you approve it, then watch it stream live.",
    intent: "Did my new prompt regress against the current one?",
  },
];

function Empty({ onAsk }: { onAsk: (intent: string) => void }) {
  return (
    <div style={{ color: "var(--gray-600)", maxWidth: 640 }}>
      <h1 style={{ fontWeight: 300, fontSize: 40, color: "var(--gray-900)" }}>
        What do you want to evaluate?
      </h1>
      <p>
        Describe it in plain language. Asktuple resolves who you are, reads what is true in
        Gaugetuple, and assembles the right view. Anything that changes data comes back as a
        proposal you approve.
      </p>

      <div style={{ marginTop: 28, fontSize: 11, letterSpacing: 1 }}>NEW HERE? TAKE THE TOUR</div>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {TOUR.map((t, i) => (
          <button
            key={t.step}
            onClick={() => onAsk(t.intent)}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "baseline",
              textAlign: "left",
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid var(--gray-200)",
              background: "white",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            <span style={{ color: "var(--cobalt)", fontWeight: 700, fontSize: 15 }}>{i + 1}</span>
            <span>
              <span style={{ color: "var(--gray-900)", fontWeight: 600 }}>{t.step}</span>
              <span style={{ display: "block", fontSize: 13, marginTop: 2 }}>{t.why}</span>
            </span>
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, marginTop: 12 }}>
        Or just ask anything — "what is a golden dataset?", "why did the score drop?".
      </p>
    </div>
  );
}
