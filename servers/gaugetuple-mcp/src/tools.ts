import type { CardResult, ProposedAction } from "@asktuple/contract";

/**
 * Thin Gaugetuple API client. Truth comes from Gaugetuple, never from model
 * text. Every read returns typed data or an `unavailable` card. Wire the real
 * endpoints where marked TODO; the shapes below match what the UI observed at
 * dev.gaugetuple.com so the shell can be built against them today.
 */
const BASE = process.env.GAUGETUPLE_API_BASE ?? "https://dev.gaugetuple.com";
const TOKEN = process.env.GAUGETUPLE_API_TOKEN ?? "";

async function api<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {},
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function unavailable(what: string): CardResult {
  return { card: "unavailable", payload: { what } };
}

// ---- Read tools -----------------------------------------------------------

export async function getPlatformOverview(): Promise<CardResult> {
  // TODO: replace with the real overview endpoint.
  const data = await api<Record<string, number>>("/api/overview");
  if (!data) return unavailable("platform overview");
  return {
    card: "overview_kpis",
    payload: data, // { goldenDatasets, evalDatasets, evalCriteria, successRate, totalEvaluations, totalRows, linkedDatasets }
    suggestions: ["Why is success rate 83%?", "List my recent eval runs"],
  };
}

export async function listEvalRuns(input: {
  evalType?: string;
  datasetId?: string;
  limit?: number;
}): Promise<CardResult> {
  const q = new URLSearchParams();
  if (input.evalType) q.set("evalType", input.evalType);
  if (input.datasetId) q.set("datasetId", input.datasetId);
  q.set("limit", String(input.limit ?? 20));
  const data = await api<unknown[]>(`/api/eval-runs?${q}`);
  if (!data) return unavailable("evaluation runs");
  return {
    card: "run_list",
    payload: { runs: data },
    suggestions: ["Open the latest run", "Compare against last week"],
  };
}

export async function getEvalRun(input: { runId: string }): Promise<CardResult> {
  const data = await api<unknown>(`/api/eval-runs/${encodeURIComponent(input.runId)}`);
  if (!data) return unavailable(`run ${input.runId}`);
  return { card: "run_detail", payload: data };
}

export async function getScoreAnalytics(input: {
  window?: string;
  evalType?: string;
}): Promise<CardResult> {
  const q = new URLSearchParams({ window: input.window ?? "30d" });
  if (input.evalType) q.set("evalType", input.evalType);
  const data = await api<unknown>(`/api/analytics?${q}`);
  if (!data) return unavailable("score analytics");
  return { card: "score_analytics", payload: data };
}

export async function listDatasets(input: { kind?: string }): Promise<CardResult> {
  const q = input.kind ? `?kind=${encodeURIComponent(input.kind)}` : "";
  const data = await api<unknown[]>(`/api/datasets${q}`);
  if (!data) return unavailable("datasets");
  return { card: "dataset_list", payload: { datasets: data } };
}

export async function listPromptJobs(input: { status?: string }): Promise<CardResult> {
  const q = input.status ? `?status=${encodeURIComponent(input.status)}` : "";
  const data = await api<unknown[]>(`/api/prompt-jobs${q}`);
  if (!data) return unavailable("prompt jobs");
  return { card: "prompt_job_list", payload: { jobs: data } };
}

// ---- Mutations. Return a ProposedAction. Never execute on call. -----------

export function proposeEvaluation(input: {
  evalType: string;
  datasetId: string;
  baselinePrompt?: string;
  candidatePrompt?: string;
  provider?: string;
}): CardResult {
  const proposal: ProposedAction = {
    id: `prop_${Date.now()}`,
    product: "gaugetuple",
    title: `Run a ${input.evalType} evaluation on dataset ${input.datasetId}`,
    execute: { toolId: "gaugetuple.propose_evaluation", input },
    capability: "run:evaluation",
    effects: [
      `Executes a ${input.evalType} run via ${input.provider ?? "the default provider"}.`,
      input.candidatePrompt
        ? "Compares the candidate prompt against the baseline (A/B regression check)."
        : "Scores the dataset against the linked golden baseline.",
      "Writes a new entry to Run History.",
    ],
    broadcastChannel: `run:${Date.now()}`,
  };
  return { card: "proposal", payload: proposal };
}

export function proposeGoldenDataset(input: {
  name: string;
  sourceEntryIds: string[];
}): CardResult {
  const proposal: ProposedAction = {
    id: `prop_${Date.now()}`,
    product: "gaugetuple",
    title: `Create golden dataset "${input.name}"`,
    execute: { toolId: "gaugetuple.propose_golden_dataset", input },
    capability: "write:golden_dataset",
    effects: [
      `Creates a versioned golden dataset from ${input.sourceEntryIds.length} entries.`,
      "Makes it available as a baseline for future evaluations.",
    ],
  };
  return { card: "proposal", payload: proposal };
}

export function proposeReportExport(input: { scope: string; window?: string }): CardResult {
  const proposal: ProposedAction = {
    id: `prop_${Date.now()}`,
    product: "gaugetuple",
    title: `Export a PPT report for ${input.scope}`,
    execute: { toolId: "gaugetuple.propose_report_export", input },
    capability: "export:report",
    effects: [`Generates a client-ready PPT for ${input.scope} (${input.window ?? "30d"}).`],
  };
  return { card: "proposal", payload: proposal };
}
