import type { ToolManifest } from "@asktuple/contract";

/**
 * Gaugetuple capability manifest.
 *
 * Each entry maps a real Gaugetuple feature (observed at dev.gaugetuple.com) to
 * a tool the Asktuple host can route intent to. Read tools are safe; the two
 * `run:*` tools and the one `write:*` tool return a ProposedAction and never
 * execute on call.
 *
 * Eval types in Gaugetuple: correctness, custom_llm_grader, relevancy,
 * completeness, safety, coherence_clarity, f1, exact_match.
 * Providers: deepeval, custom_llm, lighteval, newtuple.
 */
export const GAUGETUPLE_TOOLS: ToolManifest[] = [
  {
    id: "gaugetuple.get_platform_overview",
    product: "gaugetuple",
    kind: "read",
    capability: "read:overview",
    summary: "Show platform KPIs: golden/eval datasets, criteria, success rate, totals.",
    input: {},
    card: "overview_kpis",
  },
  {
    id: "gaugetuple.list_eval_runs",
    product: "gaugetuple",
    kind: "read",
    capability: "read:runs",
    summary: "List recent evaluation runs, optionally filtered by eval type or dataset.",
    input: { evalType: "string", datasetId: "string", limit: "number" },
    card: "run_list",
  },
  {
    id: "gaugetuple.get_eval_run",
    product: "gaugetuple",
    kind: "read",
    capability: "read:runs",
    summary: "Get one evaluation run with per-criterion scores and pass rate.",
    input: { runId: "string" },
    card: "run_detail",
  },
  {
    id: "gaugetuple.get_score_analytics",
    product: "gaugetuple",
    kind: "read",
    capability: "read:analytics",
    summary: "Score trends, provider comparison, and eval-type breakdown over a window.",
    input: { window: "string", evalType: "string" },
    card: "score_analytics",
  },
  {
    id: "gaugetuple.list_datasets",
    product: "gaugetuple",
    kind: "read",
    capability: "read:datasets",
    summary: "List golden and evaluation datasets and their linkage.",
    input: { kind: "string" },
    card: "dataset_list",
  },
  {
    id: "gaugetuple.list_prompt_jobs",
    product: "gaugetuple",
    kind: "read",
    capability: "read:prompt_jobs",
    summary: "List Prompt Lab improvement jobs and candidate model results.",
    input: { status: "string" },
    card: "prompt_job_list",
  },

  // ---- Mutations. These return a ProposedAction; they do not execute. ----
  {
    id: "gaugetuple.propose_evaluation",
    product: "gaugetuple",
    kind: "mutation",
    capability: "run:evaluation",
    summary:
      "Propose an evaluation run (for example an A/B regression check of a new prompt vs the current one).",
    input: {
      evalType: "string",
      datasetId: "string",
      baselinePrompt: "string",
      candidatePrompt: "string",
      provider: "string",
    },
    card: "proposal",
  },
  {
    id: "gaugetuple.propose_golden_dataset",
    product: "gaugetuple",
    kind: "mutation",
    capability: "write:golden_dataset",
    summary: "Propose creating a golden dataset from provided examples (turns the 0 into a 1).",
    input: { name: "string", sourceEntryIds: "string[]" },
    card: "proposal",
  },
  {
    id: "gaugetuple.propose_report_export",
    product: "gaugetuple",
    kind: "mutation",
    capability: "export:report",
    summary: "Propose exporting a client-ready PPT report of a run or a window of analytics.",
    input: { scope: "string", window: "string" },
    card: "proposal",
  },
];
