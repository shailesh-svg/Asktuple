import type { CardResult, ProposedAction } from "@asktuple/contract";

/**
 * Gaugetuple API client. Endpoints below were captured live from
 * dev.gaugetuple.com (a Next.js app; the API is same-origin under /evals and
 * /authtuple). Truth comes from Gaugetuple, never from model text. Every read
 * returns typed data or an `unavailable` card.
 *
 * Auth: the browser uses a session cookie. For a server-side gateway, set one of
 *   GAUGETUPLE_API_TOKEN  (sent as Authorization: Bearer ...)
 *   GAUGETUPLE_COOKIE     (sent as the Cookie header, copied from a logged-in session)
 * Reads that require auth return an `unavailable` card when neither is set.
 */
const BASE = process.env.GAUGETUPLE_API_BASE ?? "https://dev.gaugetuple.com";
const TOKEN = process.env.GAUGETUPLE_API_TOKEN ?? "";
const COOKIE = process.env.GAUGETUPLE_COOKIE ?? "";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (TOKEN) h.authorization = `Bearer ${TOKEN}`;
  if (COOKIE) h.cookie = COOKIE;
  return h;
}

async function api<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Count helper. Gaugetuple list endpoints may return an array or {items,total}. */
function count(data: any): number {
  if (data == null) return 0;
  if (typeof data.total === "number") return data.total;
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data.items)) return data.items.length;
  if (Array.isArray(data.results)) return data.results.length;
  return 0;
}
function rows(data: any): any[] {
  if (Array.isArray(data)) return data;
  return data?.items ?? data?.results ?? data?.data ?? [];
}

function unavailable(what: string): CardResult {
  return { card: "unavailable", payload: { what } };
}

/** Resolve the default project id (the dashboard scopes analytics by project). */
export async function defaultProjectId(): Promise<string | null> {
  const data = await api<any>("/evals/projects");
  const list = rows(data);
  return list[0]?.id ?? list[0]?.project_id ?? null;
}

// ---- Read tools -----------------------------------------------------------

export async function getPlatformOverview(): Promise<CardResult> {
  const [golden, evaluation, linked, configs, jobs] = await Promise.all([
    api<any>("/evals/dataset/list?type=golden&page=1&limit=1"),
    api<any>("/evals/dataset/list?type=evaluation&page=1&limit=1"),
    api<any>("/evals/dataset/list?type=linked&page=1&limit=1"),
    api<any>("/evals/configs/list?page=1&limit=1"),
    api<any>("/evals/eval_jobs/list?page=1&limit=1"),
  ]);
  if (!golden && !evaluation && !configs && !jobs) return unavailable("platform overview");
  return {
    card: "overview_kpis",
    payload: {
      goldenDatasets: count(golden),
      evalDatasets: count(evaluation),
      linkedDatasets: count(linked),
      evalCriteria: count(configs),
      totalEvaluations: count(jobs),
    },
    suggestions: ["List my recent eval runs", "Why is the pass rate where it is?"],
  };
}

export async function listEvalRuns(input: {
  evalType?: string;
  datasetId?: string;
  limit?: number;
}): Promise<CardResult> {
  const q = new URLSearchParams({ page: "1", limit: String(input.limit ?? 20) });
  if (input.evalType) q.set("eval_type", input.evalType);
  if (input.datasetId) q.set("dataset_id", input.datasetId);
  const data = await api<any>(`/evals/eval_jobs/list?${q}`);
  if (!data) return unavailable("evaluation runs");
  return {
    card: "run_list",
    payload: { runs: rows(data), total: count(data) },
    suggestions: ["Open the latest run", "Compare against last week"],
  };
}

export async function getEvalRun(input: { runId: string }): Promise<CardResult> {
  // TODO confirm: single-run route is inferred as /evals/eval_jobs/{id}.
  const data = await api<any>(`/evals/eval_jobs/${encodeURIComponent(input.runId)}`);
  if (!data) return unavailable(`run ${input.runId}`);
  return { card: "run_detail", payload: data };
}

export async function getScoreAnalytics(input: {
  window?: string;
  projectId?: string;
}): Promise<CardResult> {
  const days = (input.window ?? "30d").replace("d", "");
  const pid = input.projectId ?? (await defaultProjectId());
  if (!pid) return unavailable("a project to analyze");
  const [trends, providers, breakdown] = await Promise.all([
    api<any>(`/evals/dashboard/project-score-trends?project_id=${pid}&days=${days}`),
    api<any>(`/evals/dashboard/project-provider-comparison?project_id=${pid}&days=${days}`),
    api<any>(`/evals/dashboard/project-eval-type-breakdown?project_id=${pid}&days=${days}`),
  ]);
  if (!trends && !providers && !breakdown) return unavailable("score analytics");
  return {
    card: "score_analytics",
    payload: { window: `${days}d`, projectId: pid, trends, providers, breakdown },
  };
}

export async function listDatasets(input: { kind?: string }): Promise<CardResult> {
  const type = input.kind ?? "golden"; // golden | evaluation | linked
  const data = await api<any>(`/evals/dataset/list?type=${encodeURIComponent(type)}&page=1&limit=200`);
  if (!data) return unavailable("datasets");
  return { card: "dataset_list", payload: { kind: type, datasets: rows(data), total: count(data) } };
}

export async function listPromptJobs(_input: { status?: string }): Promise<CardResult> {
  const data = await api<any>(`/evals/prompt-competitions?limit=20&offset=0`);
  if (!data) return unavailable("prompt jobs");
  return { card: "prompt_job_list", payload: { jobs: rows(data), total: count(data) } };
}

// ---- Mutations. Return a ProposedAction. Never execute on call. -----------
// A proposal's execute.toolId points at an execute_* tool, which the host will
// only call after an operator approves the stored proposal.

export function proposeEvaluation(input: {
  evalType: string;
  datasetId: string;
  datasetName?: string;
  baselinePrompt?: string;
  candidatePrompt?: string;
  provider?: string;
}): CardResult {
  const dataset = input.datasetName
    ? `"${input.datasetName}" (${input.datasetId})`
    : input.datasetId || "(pick one)";
  const proposal: ProposedAction = {
    id: `prop_${Date.now()}`,
    product: "gaugetuple",
    title: `Run a ${input.evalType} evaluation on dataset ${dataset}`,
    execute: { toolId: "gaugetuple.execute_evaluation", input },
    capability: "run:evaluation",
    effects: [
      `Executes a ${input.evalType} run via ${input.provider ?? "the default provider"}.`,
      input.candidatePrompt
        ? "Compares the candidate prompt against the baseline (A/B regression check)."
        : "Scores the dataset against the linked golden baseline.",
      "Writes a new entry to Run History (/evals/eval_jobs).",
    ],
    broadcastChannel: `run:${Date.now()}`,
  };
  return { card: "proposal", payload: proposal };
}

export function proposeGoldenDataset(input: {
  name: string;
  sourceEntryIds?: string[];
  sourceDatasetId?: string;
}): CardResult {
  const entries = input.sourceEntryIds?.length
    ? `from ${input.sourceEntryIds.length} entries`
    : input.sourceDatasetId
      ? `derived from dataset ${input.sourceDatasetId}`
      : "from scratch";
  const proposal: ProposedAction = {
    id: `prop_${Date.now()}`,
    product: "gaugetuple",
    title: `Create golden dataset "${input.name}"`,
    execute: { toolId: "gaugetuple.execute_golden_dataset", input },
    capability: "write:golden_dataset",
    effects: [
      `Creates a versioned golden dataset ${entries}.`,
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
    execute: { toolId: "gaugetuple.execute_report_export", input },
    capability: "export:report",
    effects: [`Generates a client-ready PPT for ${input.scope} (${input.window ?? "30d"}).`],
  };
  return { card: "proposal", payload: proposal };
}

// ---- Execute. Called by the host only after an approved proposal. ----------
// TODO(P1): capture the real mutation endpoints (New Evaluation Wizard submit,
// dataset create, Export PPT) with DevTools and wire the POSTs here.

export async function executeApproved(
  toolId: string,
  _input: Record<string, unknown>,
): Promise<{ ok: boolean; note: string }> {
  switch (toolId) {
    case "gaugetuple.execute_evaluation":
      // TODO confirm: POST /evals/eval_jobs
      return {
        ok: false,
        note: "Approved, but the Gaugetuple run-evaluation endpoint is not yet captured (P1). No run was created.",
      };
    case "gaugetuple.execute_golden_dataset":
      // TODO confirm: POST /evals/dataset (type=golden)
      return {
        ok: false,
        note: "Approved, but the Gaugetuple dataset-create endpoint is not yet captured (P1). No dataset was created.",
      };
    case "gaugetuple.execute_report_export":
      // TODO confirm: the dashboard "Export PPT" endpoint.
      return {
        ok: false,
        note: "Approved, but the Gaugetuple export endpoint is not yet captured (P1). No report was generated.",
      };
    default:
      return { ok: false, note: `Unknown execute tool ${toolId}.` };
  }
}
