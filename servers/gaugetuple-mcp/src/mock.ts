/**
 * Mock Gaugetuple responses, shaped like the observed live API
 * (docs/GAUGETUPLE_API.md). Enabled with GAUGETUPLE_MOCK=1 so the whole door —
 * cards, planner grounding, proposal flow — is testable end to end before a
 * real session cookie exists. Reference values match the live dashboard:
 * 59 runs, 53 criteria, 0 golden, 0 evaluation, 14 linked datasets.
 */

const PROJECT_ID = "3cf39edc-09bf-4a07-83a6-c80e750d4fb4";

const RUNS = [
  { id: "run_9f21", name: "support-bot correctness v14", eval_type: "correctness", provider: "deepeval", status: "completed", pass_rate: 0.87, dataset_id: "ds_link_03", rows: 120, created_at: "2026-07-07T14:12:00Z" },
  { id: "run_8e4c", name: "support-bot correctness v13", eval_type: "correctness", provider: "deepeval", status: "completed", pass_rate: 0.91, dataset_id: "ds_link_03", rows: 120, created_at: "2026-07-05T09:40:00Z" },
  { id: "run_7d0a", name: "claims-summarizer relevancy", eval_type: "relevancy", provider: "custom_llm", status: "completed", pass_rate: 0.78, dataset_id: "ds_link_07", rows: 260, created_at: "2026-07-03T18:02:00Z" },
  { id: "run_6b93", name: "claims-summarizer safety sweep", eval_type: "safety", provider: "newtuple", status: "completed", pass_rate: 0.99, dataset_id: "ds_link_07", rows: 260, created_at: "2026-07-01T11:25:00Z" },
  { id: "run_5a71", name: "router exact-match regression", eval_type: "exact_match", provider: "lighteval", status: "failed", pass_rate: 0.42, dataset_id: "ds_link_01", rows: 88, created_at: "2026-06-28T16:55:00Z" },
];

const LINKED_DATASETS = [
  { id: "ds_link_01", name: "router-golden-questions", type: "linked", rows: 88, linked_project: "Router", updated_at: "2026-06-20T10:00:00Z" },
  { id: "ds_link_03", name: "support-bot-conversations", type: "linked", rows: 120, linked_project: "Support Bot", updated_at: "2026-07-01T08:30:00Z" },
  { id: "ds_link_07", name: "claims-summaries-q2", type: "linked", rows: 260, linked_project: "Claims", updated_at: "2026-06-25T13:45:00Z" },
];

const CONFIGS = Array.from({ length: 5 }, (_, i) => ({
  id: `cfg_${i + 1}`,
  name: ["Correctness (strict)", "Relevancy", "Completeness", "Safety", "Coherence & clarity"][i],
  eval_type: ["correctness", "relevancy", "completeness", "safety", "coherence_clarity"][i],
  provider: "deepeval",
}));

const PROMPT_JOBS = [
  { id: "pj_31", name: "support-bot system prompt v15 candidates", status: "completed", best_model: "claude-sonnet-4-6", improvement: "+4.2%", created_at: "2026-07-06T12:00:00Z" },
  { id: "pj_29", name: "claims-summarizer tone rewrite", status: "running", best_model: null, improvement: null, created_at: "2026-07-08T07:10:00Z" },
];

function trendPoint(day: string, score: number) {
  return { date: day, avg_score: score, runs: Math.round(score * 10) % 4 + 1 };
}

export function mockResponse(path: string): unknown | null {
  if (path.startsWith("/evals/projects")) {
    return [{ id: PROJECT_ID, name: "Support Bot" }, { id: "b1a2c3d4-0000-4000-8000-000000000002", name: "Claims" }];
  }
  if (path.startsWith("/evals/eval_jobs/list")) {
    return { items: RUNS, total: 59 };
  }
  if (path.startsWith("/evals/eval_jobs/")) {
    const id = decodeURIComponent(path.split("/").pop()!.split("?")[0]);
    const run = RUNS.find((r) => r.id === id) ?? RUNS[0];
    return {
      ...run,
      criteria: [
        { name: "Factual accuracy", score: 0.9, threshold: 0.8, passed: true },
        { name: "Grounding", score: 0.84, threshold: 0.8, passed: true },
        { name: "No hallucinated ids", score: 0.71, threshold: 0.9, passed: false },
      ],
    };
  }
  if (path.startsWith("/evals/dataset/list")) {
    const type = new URLSearchParams(path.split("?")[1] ?? "").get("type") ?? "golden";
    if (type === "linked") return { items: LINKED_DATASETS, total: 14 };
    return { items: [], total: 0 }; // golden and evaluation are genuinely 0 — the adoption gap
  }
  if (path.startsWith("/evals/configs/list")) {
    return { items: CONFIGS, total: 53 };
  }
  if (path.startsWith("/evals/prompt-competitions")) {
    return { items: PROMPT_JOBS, total: 12 };
  }
  if (path.startsWith("/evals/dashboard/project-score-trends")) {
    return ["2026-06-10", "2026-06-17", "2026-06-24", "2026-07-01", "2026-07-08"].map((d, i) =>
      trendPoint(d, [0.81, 0.84, 0.9, 0.91, 0.87][i]),
    );
  }
  if (path.startsWith("/evals/dashboard/project-provider-comparison")) {
    return [
      { provider: "deepeval", avg_score: 0.89, runs: 31 },
      { provider: "custom_llm", avg_score: 0.78, runs: 14 },
      { provider: "lighteval", avg_score: 0.62, runs: 8 },
      { provider: "newtuple", avg_score: 0.97, runs: 6 },
    ];
  }
  if (path.startsWith("/evals/dashboard/project-eval-type-breakdown")) {
    return [
      { eval_type: "correctness", runs: 24, avg_score: 0.88 },
      { eval_type: "relevancy", runs: 12, avg_score: 0.79 },
      { eval_type: "safety", runs: 9, avg_score: 0.98 },
      { eval_type: "exact_match", runs: 8, avg_score: 0.55 },
      { eval_type: "completeness", runs: 6, avg_score: 0.81 },
    ];
  }
  return null;
}
