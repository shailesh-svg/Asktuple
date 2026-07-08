import type { ToolManifest } from "@asktuple/contract";

/**
 * Gaugetuple capability manifest.
 *
 * Each entry maps a real Gaugetuple feature (observed at dev.gaugetuple.com) to
 * a tool the Asktuple host can route intent to. Read tools are safe; mutation
 * tools return a ProposedAction and never execute on call. Execute tools are
 * NOT advertised to the planner — they run only through an approved proposal.
 *
 * Eval types in Gaugetuple: correctness, custom_llm_grader, relevancy,
 * completeness, safety, coherence_clarity, f1, exact_match.
 * Providers: deepeval, custom_llm, lighteval, newtuple.
 */

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });

function schema(
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> {
  return { type: "object", properties, required, additionalProperties: false };
}

export const GAUGETUPLE_TOOLS: ToolManifest[] = [
  {
    id: "gaugetuple.get_platform_overview",
    product: "gaugetuple",
    kind: "read",
    capability: "read:overview",
    summary: "Show platform KPIs: golden/eval datasets, criteria, success rate, totals.",
    inputSchema: schema({}),
    card: "overview_kpis",
  },
  {
    id: "gaugetuple.list_eval_runs",
    product: "gaugetuple",
    kind: "read",
    capability: "read:runs",
    summary: "List recent evaluation runs, optionally filtered by eval type or dataset.",
    inputSchema: schema({
      evalType: str("Eval type filter, e.g. correctness, safety, relevancy."),
      datasetId: str("Filter runs to one dataset id."),
      limit: num("Max rows, default 20."),
    }),
    card: "run_list",
  },
  {
    id: "gaugetuple.get_eval_run",
    product: "gaugetuple",
    kind: "read",
    capability: "read:runs",
    summary: "Get one evaluation run with per-criterion scores and pass rate.",
    inputSchema: schema({ runId: str("The run/job id.") }, ["runId"]),
    card: "run_detail",
  },
  {
    id: "gaugetuple.get_score_analytics",
    product: "gaugetuple",
    kind: "read",
    capability: "read:analytics",
    summary: "Score trends, provider comparison, and eval-type breakdown over a window.",
    inputSchema: schema({
      window: str("Time window like 7d or 30d. Default 30d."),
      projectId: str("Project to scope analytics to. Defaults to the first project."),
    }),
    card: "score_analytics",
  },
  {
    id: "gaugetuple.list_datasets",
    product: "gaugetuple",
    kind: "read",
    capability: "read:datasets",
    summary: "List golden, evaluation, or linked datasets. Use to find real dataset ids/names.",
    inputSchema: schema({
      kind: str("Dataset kind: golden | evaluation | linked. Default golden."),
    }),
    card: "dataset_list",
  },
  {
    id: "gaugetuple.list_prompt_jobs",
    product: "gaugetuple",
    kind: "read",
    capability: "read:prompt_jobs",
    summary: "List Prompt Lab improvement jobs and candidate model results.",
    inputSchema: schema({ status: str("Optional status filter.") }),
    card: "prompt_job_list",
  },

  // ---- Mutations. These return a ProposedAction; they do not execute. ----
  {
    id: "gaugetuple.propose_evaluation",
    product: "gaugetuple",
    kind: "mutation",
    capability: "run:evaluation",
    summary:
      "Propose an evaluation run (e.g. an A/B regression check of a new prompt vs the current one). " +
      "Fill inputs with REAL ids/names gathered from read tools first.",
    inputSchema: schema(
      {
        evalType: str("One of: correctness, custom_llm_grader, relevancy, completeness, safety, coherence_clarity, f1, exact_match."),
        datasetId: str("A real dataset id from list_datasets."),
        datasetName: str("The dataset's human name, for the proposal card."),
        baselinePrompt: str("The current/baseline prompt, if this is an A/B check."),
        candidatePrompt: str("The new/candidate prompt, if this is an A/B check."),
        provider: str("One of: deepeval, custom_llm, lighteval, newtuple."),
      },
      ["evalType", "datasetId"],
    ),
    card: "proposal",
  },
  {
    id: "gaugetuple.propose_golden_dataset",
    product: "gaugetuple",
    kind: "mutation",
    capability: "write:golden_dataset",
    summary: "Propose creating a golden dataset from provided examples (turns the 0 into a 1).",
    inputSchema: schema(
      {
        name: str("Name for the new golden dataset."),
        sourceEntryIds: { type: "array", items: { type: "string" }, description: "Entry ids to seed from." },
        sourceDatasetId: str("Existing dataset id to derive from, if any."),
      },
      ["name"],
    ),
    card: "proposal",
  },
  {
    id: "gaugetuple.propose_report_export",
    product: "gaugetuple",
    kind: "mutation",
    capability: "export:report",
    summary: "Propose exporting a client-ready PPT report of a run or a window of analytics.",
    inputSchema: schema(
      {
        scope: str("What the report covers, e.g. 'latest correctness run' or 'last 30 days'."),
        window: str("Time window like 30d."),
      },
      ["scope"],
    ),
    card: "proposal",
  },

  // ---- Execute tools. Reachable ONLY via an approved proposal on the host. ----
  {
    id: "gaugetuple.execute_evaluation",
    product: "gaugetuple",
    kind: "execute",
    capability: "run:evaluation",
    summary: "Execute an approved evaluation run.",
    inputSchema: schema({}),
    card: "run_broadcast",
  },
  {
    id: "gaugetuple.execute_golden_dataset",
    product: "gaugetuple",
    kind: "execute",
    capability: "write:golden_dataset",
    summary: "Execute an approved golden dataset creation.",
    inputSchema: schema({}),
    card: "dataset_list",
  },
  {
    id: "gaugetuple.execute_report_export",
    product: "gaugetuple",
    kind: "execute",
    capability: "export:report",
    summary: "Execute an approved report export.",
    inputSchema: schema({}),
    card: "unavailable",
  },
];
