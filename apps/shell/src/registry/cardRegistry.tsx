import { Fragment, useState } from "react";
import type { CardResult, CardType, ProposedAction } from "@asktuple/contract";

/**
 * The card registry. Keeps Asktuple "predictable, not surprising": the model
 * picks a tool, the tool declares a CardType, and the shell renders the matching
 * native component. The model never emits markup.
 */
export function renderCard(
  result: CardResult,
  ctx: { onAsk: (intent: string) => void; onApprove: (p: ProposedAction) => Promise<string> },
) {
  const render = REGISTRY[result.card] ?? (() => <Unknown card={result.card} />);
  return (
    <div>
      {render(result.payload, ctx)}
      {result.suggestions?.length ? (
        <div style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
          {result.suggestions.map((s) => (
            <button key={s} onClick={() => ctx.onAsk(s)} style={chip}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type Ctx = { onAsk: (i: string) => void; onApprove: (p: ProposedAction) => Promise<string> };

const REGISTRY: Partial<Record<CardType, (payload: any, ctx: Ctx) => JSX.Element>> = {
  doc: (p) => (
    <Section title={p?.title ?? "About"}>
      <div style={{ maxWidth: 680 }}>
        {(p?.body ?? []).map((para: string, i: number) => (
          <p key={i} style={{ color: "var(--gray-900)", lineHeight: 1.65, fontSize: 15, marginBottom: 12 }}>
            {para}
          </p>
        ))}
      </div>
    </Section>
  ),
  overview_kpis: (p) => (
    <Section title="Platform overview">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {Object.entries(p ?? {}).map(([k, v]) => (
          <Kpi key={k} label={humanize(k)} value={fmt(v)} />
        ))}
      </div>
    </Section>
  ),
  run_list: (p) => (
    <Section title="Evaluation runs" count={p?.total}>
      <SmartTable rows={p?.runs ?? []} empty="No evaluation runs." />
    </Section>
  ),
  run_detail: (p) => (
    <Section title="Run detail">
      <KeyValues obj={p} />
    </Section>
  ),
  score_analytics: (p) => (
    <Section title={`Score analytics · ${p?.window ?? ""}`}>
      <Panels
        panels={[
          ["Score trends", p?.trends],
          ["Provider comparison", p?.providers],
          ["Eval-type breakdown", p?.breakdown],
        ]}
      />
    </Section>
  ),
  dataset_list: (p) => (
    <Section title={`Datasets · ${p?.kind ?? ""}`} count={p?.total}>
      <SmartTable rows={p?.datasets ?? []} empty="No datasets." />
    </Section>
  ),
  prompt_job_list: (p) => (
    <Section title="Prompt Lab jobs" count={p?.total}>
      <SmartTable rows={p?.jobs ?? []} empty="No prompt jobs." />
    </Section>
  ),
  proposal: (p: ProposedAction, ctx) => <Proposal p={p} onApprove={ctx.onApprove} />,
  run_broadcast: (p) => (
    <Section title="Live run">
      <KeyValues obj={p} />
    </Section>
  ),
  unavailable: (p) => (
    <Section title="Unavailable">
      <p style={{ color: "var(--gray-600)", maxWidth: 620 }}>
        Could not read {p?.what ?? "this source"} from Gaugetuple, so Asktuple shows a degraded state
        rather than a guess. If you are running locally, the gateway needs a session:
        set <code style={codeInline}>GAUGETUPLE_COOKIE</code> or{" "}
        <code style={codeInline}>GAUGETUPLE_API_TOKEN</code> and restart it.
      </p>
    </Section>
  ),
};

// ---- Proposal with a working Approve button -------------------------------
function Proposal({ p, onApprove }: { p: ProposedAction; onApprove: (p: ProposedAction) => Promise<string> }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "denied">("idle");
  const [msg, setMsg] = useState("");
  return (
    <Section title="Proposed action">
      <div style={{ border: "1px solid var(--gray-200)", borderRadius: 16, padding: 20, maxWidth: 640 }}>
        <div style={{ fontWeight: 600, fontSize: 18 }}>{p.title}</div>
        <ul style={{ color: "var(--gray-600)", marginTop: 8, lineHeight: 1.5 }}>
          {p.effects.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        {state === "idle" || state === "running" ? (
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              style={approve}
              disabled={state === "running"}
              onClick={async () => {
                setState("running");
                try {
                  const r = await onApprove(p);
                  setMsg(r);
                  setState(r.startsWith("denied") ? "denied" : "done");
                } catch (e) {
                  setMsg(String(e));
                  setState("denied");
                }
              }}
            >
              {state === "running" ? "Running..." : "Approve and run"}
            </button>
            <button style={cancel} onClick={() => setState("idle")}>
              Cancel
            </button>
          </div>
        ) : (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              borderRadius: 12,
              background: state === "done" ? "#ECFDF5" : "#FEF2F2",
              color: state === "done" ? "var(--success)" : "var(--error)",
              fontSize: 14,
            }}
          >
            {state === "done" ? "Executed. " : "Denied. "}
            {msg}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--gray-600)" }}>
          Requires capability: {p.capability}. Nothing runs until you approve.
        </div>
      </div>
    </Section>
  );
}

// ---- native primitives ----------------------------------------------------
function SmartTable({ rows, empty }: { rows: any[]; empty: string }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <p style={{ color: "var(--gray-600)" }}>{empty}</p>;
  }
  const cols = Array.from(
    rows.slice(0, 20).reduce((s: Set<string>, r) => {
      if (r && typeof r === "object") Object.keys(r).forEach((k) => s.add(k));
      return s;
    }, new Set<string>()),
  ).slice(0, 7);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={th}>
                {humanize(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 ? "var(--gray-50)" : "white" }}>
              {cols.map((c) => (
                <td key={c} style={td}>
                  {fmt(r?.[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyValues({ obj }: { obj: any }) {
  if (!obj || typeof obj !== "object") return <p style={{ color: "var(--gray-600)" }}>{fmt(obj)}</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "6px 16px", maxWidth: 780 }}>
      {Object.entries(obj).map(([k, v]) => (
        <Fragment key={k}>
          <div style={{ color: "var(--gray-600)", fontSize: 13 }}>{humanize(k)}</div>
          <div style={{ fontSize: 13 }}>{fmt(v)}</div>
        </Fragment>
      ))}
    </div>
  );
}

function Panels({ panels }: { panels: [string, any][] }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {panels.map(([title, data]) => (
        <div key={title} style={{ border: "1px solid var(--gray-200)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--gray-600)", marginBottom: 8 }}>
            {title.toUpperCase()}
          </div>
          {Array.isArray(data) ? <SmartTable rows={data} empty="No data." /> : <KeyValues obj={data ?? {}} />}
        </div>
      ))}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontWeight: 600, fontSize: 20, color: "var(--gray-900)", marginBottom: 12 }}>
        {title}
        {typeof count === "number" ? (
          <span style={{ color: "var(--gray-600)", fontWeight: 400 }}> · {count}</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--gray-200)", borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--gray-600)" }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 30, fontWeight: 600, color: "var(--cobalt)", marginTop: 4 }}>{value}</div>
    </div>
  );
}
function Unknown({ card }: { card: string }) {
  return <p style={{ color: "var(--gray-600)" }}>No renderer for card "{card}".</p>;
}

// ---- formatting ------------------------------------------------------------
function humanize(k: string): string {
  return k
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString();
    if (v.length > 60) return v.slice(0, 57) + "…";
    return v;
  }
  const s = JSON.stringify(v);
  return s.length > 60 ? s.slice(0, 57) + "…" : s;
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  background: "var(--cobalt)",
  color: "white",
  fontWeight: 600,
  fontSize: 12,
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--gray-200)",
  verticalAlign: "top",
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
const codeInline: React.CSSProperties = {
  background: "var(--gray-50)",
  border: "1px solid var(--gray-200)",
  borderRadius: 6,
  padding: "1px 6px",
  fontSize: 12,
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
