import type { CardResult, CardType, ProposedAction } from "@asktuple/contract";

/**
 * The card registry. This is what keeps Asktuple "predictable, not surprising":
 * the model picks a tool, the tool declares a CardType, and the shell renders
 * the matching component. The model never emits markup.
 *
 * Add a card type by adding a contract entry and a renderer here. That is the
 * only place UI is defined.
 */
export function renderCard(result: CardResult, onAsk: (intent: string) => void) {
  const el = REGISTRY[result.card]?.(result.payload) ?? <Unknown card={result.card} />;
  return (
    <div>
      {el}
      {result.suggestions?.length ? (
        <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          {result.suggestions.map((s) => (
            <button key={s} onClick={() => onAsk(s)} style={chip}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const REGISTRY: Partial<Record<CardType, (payload: any) => JSX.Element>> = {
  overview_kpis: (p) => (
    <Section title="Platform overview">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {Object.entries(p ?? {}).map(([k, v]) => (
          <Kpi key={k} label={k} value={String(v)} />
        ))}
      </div>
    </Section>
  ),
  run_list: (p) => (
    <Section title="Evaluation runs">
      <pre style={code}>{JSON.stringify(p.runs ?? [], null, 2)}</pre>
    </Section>
  ),
  run_detail: (p) => (
    <Section title="Run detail">
      <pre style={code}>{JSON.stringify(p, null, 2)}</pre>
    </Section>
  ),
  score_analytics: (p) => (
    <Section title="Score analytics">
      <pre style={code}>{JSON.stringify(p, null, 2)}</pre>
    </Section>
  ),
  dataset_list: (p) => (
    <Section title="Datasets">
      <pre style={code}>{JSON.stringify(p.datasets ?? [], null, 2)}</pre>
    </Section>
  ),
  prompt_job_list: (p) => (
    <Section title="Prompt Lab jobs">
      <pre style={code}>{JSON.stringify(p.jobs ?? [], null, 2)}</pre>
    </Section>
  ),
  proposal: (p: ProposedAction) => <Proposal p={p} />,
  run_broadcast: (p) => (
    <Section title="Live run">
      <pre style={code}>{JSON.stringify(p, null, 2)}</pre>
    </Section>
  ),
  unavailable: (p) => (
    <Section title="Unavailable">
      <p style={{ color: "var(--gray-600)" }}>
        Could not read {p?.what ?? "this source"} from Gaugetuple. Showing a degraded state rather
        than a guess.
      </p>
    </Section>
  ),
};

function Proposal({ p }: { p: ProposedAction }) {
  return (
    <Section title="Proposed action">
      <div style={{ border: "1px solid var(--gray-200)", borderRadius: 16, padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 18 }}>{p.title}</div>
        <ul style={{ color: "var(--gray-600)", marginTop: 8 }}>
          {p.effects.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button style={approve}>Approve and run</button>
          <button style={cancel}>Cancel</button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--gray-600)" }}>
          Requires capability: {p.capability}. Nothing runs until you approve.
        </div>
      </div>
    </Section>
  );
}

// ---- primitives -----------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontWeight: 600, fontSize: 20, color: "var(--gray-900)", marginBottom: 12 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--gray-200)", borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--gray-600)" }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: "var(--cobalt)" }}>{value}</div>
    </div>
  );
}
function Unknown({ card }: { card: string }) {
  return <p style={{ color: "var(--gray-600)" }}>No renderer for card "{card}".</p>;
}

const code: React.CSSProperties = {
  background: "var(--gray-50)",
  border: "1px solid var(--gray-200)",
  borderRadius: 12,
  padding: 16,
  fontSize: 12,
  overflow: "auto",
};
const chip: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 9999,
  border: "1px solid var(--gray-200)",
  background: "var(--gray-50)",
  font: "inherit",
  fontSize: 13,
  cursor: "pointer",
};
const approve: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 9999,
  border: "none",
  background: "var(--cobalt)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};
const cancel: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 9999,
  border: "1px solid var(--gray-200)",
  background: "white",
  cursor: "pointer",
};
