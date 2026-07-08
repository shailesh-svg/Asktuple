import type { Response } from "express";
import type { RunEvent } from "@asktuple/contract";

/**
 * Run broadcast: a channel per approved run, streamed to the shell over SSE.
 * Whoever should see a run can watch it — including read-only profiles.
 *
 * Event SOURCE is pluggable. Today: a simulated lifecycle (mock mode / until
 * the real mutation endpoints are captured). After P1: replace simulateRun()
 * with a poller on the Gaugetuple run status via the MCP read tools.
 */

interface Channel {
  events: RunEvent[];
  done: boolean;
  subscribers: Set<Response>;
}

const channels = new Map<string, Channel>();

function channelFor(id: string): Channel {
  let ch = channels.get(id);
  if (!ch) {
    ch = { events: [], done: false, subscribers: new Set() };
    channels.set(id, ch);
  }
  return ch;
}

function emit(channelId: string, type: RunEvent["type"], data?: Record<string, unknown>): void {
  const ch = channelFor(channelId);
  const event: RunEvent = { channel: channelId, type, at: new Date().toISOString(), data };
  ch.events.push(event);
  if (type === "done" || type === "passed" || type === "failed") ch.done = true;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of ch.subscribers) {
    res.write(payload);
    if (ch.done) res.end();
  }
  if (ch.done) {
    ch.subscribers.clear();
    setTimeout(() => channels.delete(channelId), 10 * 60 * 1000).unref?.();
  }
}

/** Subscribe an HTTP response as an SSE client; replays history first. */
export function subscribe(channelId: string, res: Response): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  const ch = channelFor(channelId);
  for (const event of ch.events) res.write(`data: ${JSON.stringify(event)}\n\n`);
  if (ch.done) return void res.end();
  ch.subscribers.add(res);
  res.on("close", () => ch.subscribers.delete(res));
}

/**
 * Simulated run lifecycle with plausible rolling stats. Same event vocabulary
 * the real poller will emit, so the shell card doesn't change at P2-real.
 */
export function simulateRun(channelId: string, title: string, rows = 120): void {
  emit(channelId, "queued", { title, rows });
  let done = 0;
  let passed = 0;
  const start = Date.now();

  setTimeout(() => emit(channelId, "running", { title, provider: "deepeval" }), 900);

  const tick = setInterval(() => {
    const step = Math.min(rows - done, Math.ceil(rows / 6));
    done += step;
    passed += Math.round(step * (0.82 + Math.random() * 0.12));
    emit(channelId, "progress", {
      pct: Math.round((done / rows) * 100),
      rowsDone: done,
      rowsTotal: rows,
      passRate: Number((passed / done).toFixed(2)),
    });
    if (done >= rows) {
      clearInterval(tick);
      const passRate = Number((passed / rows).toFixed(2));
      const verdict = passRate >= 0.8 ? "passed" : "failed";
      emit(channelId, verdict, {
        passRate,
        rows,
        durationMs: Date.now() - start,
        worstCriterion: "No hallucinated ids (0.71)",
        summary:
          verdict === "passed"
            ? `Run completed: ${Math.round(passRate * 100)}% pass rate over ${rows} rows.`
            : `Run failed the bar: ${Math.round(passRate * 100)}% pass rate over ${rows} rows.`,
      });
    }
  }, 1200);
  tick.unref?.();
}
