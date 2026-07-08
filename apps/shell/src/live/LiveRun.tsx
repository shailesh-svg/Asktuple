import { useEffect, useRef, useState } from "react";
import type { RunEvent } from "@asktuple/contract";

/**
 * The dynamic run stream: stats, facts, and progress arriving live over SSE
 * from the host's broadcast channel. This is the native counterpart to the
 * iframe live view — it renders whether or not the iframe toggle is on, and
 * it's what read-only profiles watch.
 */
export function LiveRun({ gateway, channel }: { gateway: string; channel: string }) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "closed">("connecting");
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource(`${gateway}/runs/${encodeURIComponent(channel)}/events`);
    sourceRef.current = source;
    source.onopen = () => setStatus("live");
    source.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as RunEvent;
      setEvents((prev) => [...prev, event]);
      if (event.type === "done" || event.type === "passed" || event.type === "failed") {
        setStatus("closed");
        source.close();
      }
    };
    source.onerror = () => {
      setStatus("closed");
      source.close();
    };
    return () => source.close();
  }, [gateway, channel]);

  const last = events[events.length - 1];
  const progress = [...events].reverse().find((e) => e.type === "progress")?.data as
    | { pct?: number; rowsDone?: number; rowsTotal?: number; passRate?: number }
    | undefined;
  const final = events.find((e) => e.type === "passed" || e.type === "failed");
  const pct = final ? 100 : (progress?.pct ?? (events.some((e) => e.type === "running") ? 5 : 0));
  const passRate = (final?.data?.passRate as number | undefined) ?? progress?.passRate;

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ border: "1px solid var(--gray-200)", borderRadius: 16, padding: 20, maxWidth: 640 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ ...dot, background: final ? (final.type === "passed" ? "#10B981" : "#EF4444") : "var(--cobalt)" }} />
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {final ? (final.type === "passed" ? "Run passed" : "Run failed") : "Run in progress"}
          </div>
          <span style={{ fontSize: 11, color: "var(--gray-600)", marginLeft: "auto" }}>
            {status === "live" ? "● live" : status === "connecting" ? "connecting…" : "stream ended"} · {channel}
          </span>
        </div>

        <div style={{ marginTop: 14, height: 8, borderRadius: 9999, background: "var(--gray-50)", border: "1px solid var(--gray-200)", overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: final && final.type === "failed" ? "#EF4444" : "var(--cobalt)",
              transition: "width .6s ease",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 13, color: "var(--gray-600)" }}>
          <Stat label="Progress" value={`${pct}%`} />
          <Stat label="Rows" value={progress ? `${progress.rowsDone}/${progress.rowsTotal}` : "—"} />
          <Stat label="Pass rate" value={passRate != null ? `${Math.round(passRate * 100)}%` : "—"} />
        </div>

        {final?.data?.summary ? (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 12,
              background: final.type === "passed" ? "#ECFDF5" : "#FEF2F2",
              color: final.type === "passed" ? "var(--success)" : "var(--error)",
              fontSize: 14,
            }}
          >
            {String(final.data.summary)}
            {final.data.worstCriterion ? (
              <div style={{ fontSize: 12, marginTop: 4 }}>Weakest criterion: {String(final.data.worstCriterion)}</div>
            ) : null}
          </div>
        ) : null}

        <div style={{ marginTop: 12, maxHeight: 140, overflow: "auto", fontSize: 12, color: "var(--gray-600)" }}>
          {events.map((e, i) => (
            <div key={i} style={{ padding: "2px 0" }}>
              <span style={{ color: "var(--cobalt)", fontWeight: 600 }}>{e.type}</span>{" "}
              {new Date(e.at).toLocaleTimeString()}
              {e.type === "progress" && e.data ? ` — ${e.data.rowsDone}/${e.data.rowsTotal} rows, ${Math.round(((e.data.passRate as number) ?? 0) * 100)}% passing` : ""}
            </div>
          ))}
          {!events.length && <div>Waiting for events…{last ? "" : ""}</div>}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 1 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--gray-900)" }}>{value}</div>
    </div>
  );
}

const dot: React.CSSProperties = { width: 10, height: 10, borderRadius: 9999, display: "inline-block" };
