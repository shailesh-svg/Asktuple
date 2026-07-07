import express from "express";
import cors from "cors";
import {
  toolsForProfile,
  PROFILE_CAPABILITIES,
  type DoorRequest,
  type DoorResponse,
  type ProfileId,
} from "@asktuple/contract";
import { GAUGETUPLE_TOOLS } from "./manifest.js";
import * as T from "./tools.js";

/**
 * Asktuple host gateway (Gaugetuple edition).
 *
 * Flow: intent -> filter tools by profile -> resolve to one tool -> execute
 * reads immediately, return mutations as proposals -> /approve executes an
 * approved proposal after re-checking capability.
 *
 * The `resolveIntent` function is a deterministic placeholder. Swap it for an
 * LLM call that must choose from the profile-scoped tool list only. The model
 * selects a tool and fills inputs; it never invents data or UI.
 */

const app = express();
app.use(cors());
app.use(express.json());

/** Placeholder resolver. Real version: LLM constrained to the allowed tools. */
function resolveIntent(intent: string, profile: ProfileId): { toolId: string; input: Record<string, unknown> } | null {
  const allowed = toolsForProfile(GAUGETUPLE_TOOLS, profile);
  const has = (id: string) => allowed.find((t) => t.id === id)?.id ?? null;
  const q = intent.toLowerCase();

  if (/regress|a\/b|compare|candidate|vs\b/.test(q)) {
    const id = has("gaugetuple.propose_evaluation");
    if (id) return { toolId: id, input: { evalType: "correctness", datasetId: "" } };
  }
  if (/golden|reference set|ground truth/.test(q)) {
    const id = has("gaugetuple.propose_golden_dataset");
    if (id) return { toolId: id, input: { name: "New golden set", sourceEntryIds: [] } };
  }
  if (/export|ppt|report|client/.test(q)) {
    const id = has("gaugetuple.propose_report_export");
    if (id) return { toolId: id, input: { scope: "latest run" } };
  }
  if (/run|evaluation|eval history/.test(q)) {
    const id = has("gaugetuple.list_eval_runs");
    if (id) return { toolId: id, input: { limit: 20 } };
  }
  if (/analytic|score|trend|pass rate|drop/.test(q)) {
    const id = has("gaugetuple.get_score_analytics");
    if (id) return { toolId: id, input: { window: "30d" } };
  }
  if (/dataset/.test(q)) {
    const id = has("gaugetuple.list_datasets");
    if (id) return { toolId: id, input: {} };
  }
  if (/prompt/.test(q)) {
    const id = has("gaugetuple.list_prompt_jobs");
    if (id) return { toolId: id, input: {} };
  }
  const id = has("gaugetuple.get_platform_overview");
  return id ? { toolId: id, input: {} } : null;
}

async function execute(toolId: string, input: Record<string, unknown>) {
  switch (toolId) {
    case "gaugetuple.get_platform_overview":
      return T.getPlatformOverview();
    case "gaugetuple.list_eval_runs":
      return T.listEvalRuns(input as any);
    case "gaugetuple.get_eval_run":
      return T.getEvalRun(input as any);
    case "gaugetuple.get_score_analytics":
      return T.getScoreAnalytics(input as any);
    case "gaugetuple.list_datasets":
      return T.listDatasets(input as any);
    case "gaugetuple.list_prompt_jobs":
      return T.listPromptJobs(input as any);
    case "gaugetuple.propose_evaluation":
      return T.proposeEvaluation(input as any);
    case "gaugetuple.propose_golden_dataset":
      return T.proposeGoldenDataset(input as any);
    case "gaugetuple.propose_report_export":
      return T.proposeReportExport(input as any);
    default:
      return { card: "unavailable" as const, payload: { what: toolId } };
  }
}

/** Tools this profile is allowed to see. */
app.get("/tools", (req, res) => {
  const profile = (req.query.profile as ProfileId) ?? "ai_engineer";
  res.json({ profile, tools: toolsForProfile(GAUGETUPLE_TOOLS, profile) });
});

/** Resolve an intent and render a card. Reads run; mutations come back as proposals. */
app.post("/door", async (req, res) => {
  const { profile, intent } = req.body as DoorRequest;
  const resolved = resolveIntent(intent, profile);
  if (!resolved) {
    const response: DoorResponse = {
      resolvedToolId: null,
      result: { card: "unavailable", payload: { what: "a tool for this request" } },
    };
    return res.json(response);
  }
  const result = await execute(resolved.toolId, resolved.input);
  res.json({ resolvedToolId: resolved.toolId, result } satisfies DoorResponse);
});

/** Approve and execute a proposal. Re-checks capability against the profile. */
app.post("/approve", async (req, res) => {
  const { profile, toolId, input } = req.body as {
    profile: ProfileId;
    toolId: string;
    input: Record<string, unknown>;
  };
  const tool = GAUGETUPLE_TOOLS.find((t) => t.id === toolId);
  if (!tool || !PROFILE_CAPABILITIES[profile].includes(tool.capability)) {
    return res.status(403).json({ error: "capability_denied" });
  }
  // TODO: call the real Gaugetuple mutation endpoint here, then open a broadcast channel.
  res.json({ ok: true, executed: toolId, note: "Wire the real Gaugetuple mutation endpoint." });
});

const PORT = Number(process.env.PORT ?? 8787);
app.listen(PORT, () => console.log(`Asktuple gateway (gaugetuple) on :${PORT}`));
