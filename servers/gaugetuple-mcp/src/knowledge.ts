import type { CardResult } from "@asktuple/contract";

/**
 * Gaugetuple domain knowledge, shipped BY the capability server:
 *  - INSTRUCTIONS: a condensed primer the MCP server hands every host at
 *    initialize; the Asktuple planner appends it to its system prompt so the
 *    agent understands the domain before planning.
 *  - explain(topic): the doc tool — users (and agents) ask "what is a golden
 *    dataset?" and get a doc card with chained follow-ups (the onboarding tour).
 *
 * Human-depth version of all of this: docs/GAUGETUPLE.md.
 */

export const INSTRUCTIONS = `Gaugetuple domain primer (for planning):
- Gaugetuple evaluates AI outputs: an evaluation run = dataset x criteria x provider -> row scores, pass rate, verdict in Run History.
- Dataset kinds: golden (reference truth/baselines), evaluation (curated inputs), linked (rows from live projects). TODAY: 14 linked datasets exist, 0 golden, 0 evaluation - regression checks usually run on linked data; proposing to CREATE a golden set from good rows is high-value.
- Eval types: correctness (regressions/accuracy), relevancy (on-topic), completeness, safety (compliance), coherence_clarity, f1, exact_match (verbatim), custom_llm_grader.
- Providers (judge engines): deepeval (default), custom_llm, lighteval, newtuple.
- Criteria/configurations define what is measured and the threshold (53 exist).
- Map intent to eval type: "regressed?" -> correctness; "safe?" -> safety; "on-topic?" -> relevancy; "verbatim?" -> exact_match.
- A defensible regression check compares the SAME dataset + criteria + provider across prompt versions.
- Never invent dataset/run ids: list real ones first. Mutations always return proposals for human approval.`;

interface DocTopic {
  title: string;
  body: string[];
  related: string[]; // follow-up intents, chained as suggestion chips
}

const TOPICS: Record<string, DocTopic> = {
  overview: {
    title: "What is Gaugetuple?",
    body: [
      "Gaugetuple is Newtuple's AI evaluation platform: it scores AI outputs (prompts, models, pipelines) against datasets and criteria, tracks scores over time, and turns them into evidence — regression checks for engineers, release-readiness for delivery leads, quality reports for clients.",
      "An evaluation run = dataset × criteria × provider → row-level scores, a pass rate, and a verdict in Run History.",
      "Current platform state: 59 runs, 53 criteria, 14 linked datasets (2,346 rows) — and 0 golden datasets, which is the adoption gap this door exists to close.",
    ],
    related: ["What is a golden dataset?", "What are eval types?", "Show platform overview"],
  },
  golden_dataset: {
    title: "Golden datasets",
    body: [
      "A golden dataset is the reference set: inputs with known-good outputs. It is the baseline every future run compares against — a regression check without one is an opinion, not evidence.",
      "Gaugetuple has three dataset kinds: golden (reference truth), evaluation (curated inputs to score), and linked (rows flowing from a live project).",
      "Today all 14 datasets are linked and 0 are golden. Creating a golden set from your best linked rows is the single highest-value setup step — and you can propose it from here in one sentence.",
    ],
    related: ["Create a golden dataset from my best rows", "List my datasets", "What are eval types?"],
  },
  eval_types: {
    title: "Eval types (scoring methods)",
    body: [
      "correctness — did outputs get worse/better? The regression-check type. · relevancy — is the output on-topic? · completeness — did it cover everything? · safety — compliance and harm checks. · coherence_clarity — readability and structure. · f1 / exact_match — precision-recall or verbatim matching. · custom_llm_grader — your own LLM judge.",
      "Rule of thumb: 'did my prompt regress?' → correctness. 'Is it safe to ship?' → safety. 'Is it answering the question?' → relevancy.",
    ],
    related: ["What are providers?", "Did my new prompt regress against the current one?"],
  },
  providers: {
    title: "Providers (judge engines)",
    body: [
      "The provider is the engine that computes scores: deepeval (default), custom_llm, lighteval, and newtuple.",
      "For a fair comparison across runs, keep the provider (and criteria, and dataset) constant — change only the thing you are testing.",
    ],
    related: ["What are eval types?", "Why is the pass rate where it is?"],
  },
  workflow: {
    title: "How an evaluation works (the workflow)",
    body: [
      "The classic ritual: 1) prepare a dataset → 2) author criteria (eval types + thresholds) → 3) configure the pipeline (dataset × criteria × provider) → 4) run → 5) read out in Run History and Analytics, export a PPT for clients.",
      "Steps 1–2 assume evaluation methodology knowledge, which is where adoption dies — 59 runs exist but 0 golden datasets.",
      "Through this door the ritual is one sentence: describe the check you want; the agent finds real datasets and criteria, proposes a concrete run, and you approve it. The run then streams live.",
    ],
    related: ["Did my new prompt regress against the current one?", "What is a golden dataset?"],
  },
  asktuple: {
    title: "How this door works (Asktuple)",
    body: [
      "You describe intent in plain language. The agent sees only the tools your profile allows, reads real data first, and either renders a card (reads) or returns a proposal (mutations). Nothing changes data until you approve.",
      "After approval, the run broadcasts live: progress, rolling pass rate, verdict — and the real Gaugetuple UI can render alongside in the live view.",
      "Every answer shows which tool resolved it and which reads grounded it.",
    ],
    related: ["Show platform overview", "List my recent eval runs", "Did my new prompt regress against the current one?"],
  },
};

const ALIASES: Record<string, keyof typeof TOPICS> = {
  gaugetuple: "overview",
  platform: "overview",
  golden: "golden_dataset",
  dataset: "golden_dataset",
  datasets: "golden_dataset",
  "eval type": "eval_types",
  types: "eval_types",
  scoring: "eval_types",
  provider: "providers",
  judge: "providers",
  workflow: "workflow",
  evaluation: "workflow",
  run: "workflow",
  asktuple: "asktuple",
  door: "asktuple",
  help: "asktuple",
};

export function explain(input: { topic?: string }): CardResult {
  const q = (input.topic ?? "overview").toLowerCase();
  const key =
    (Object.keys(TOPICS) as (keyof typeof TOPICS)[]).find((k) => q.includes(k.replace("_", " "))) ??
    (Object.keys(ALIASES).find((a) => q.includes(a)) ? ALIASES[Object.keys(ALIASES).find((a) => q.includes(a))!] : "overview");
  const topic = TOPICS[key];
  return {
    card: "doc",
    payload: { title: topic.title, body: topic.body },
    suggestions: topic.related,
  };
}
