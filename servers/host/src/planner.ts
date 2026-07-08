import Anthropic from "@anthropic-ai/sdk";
import type { CardResult, PlanStep, ProfileId, ToolManifest } from "@asktuple/contract";
import { callTool } from "./mcp.js";

/**
 * Intent planner. Given ONLY the profile-scoped tool list, an LLM either:
 *  - answers a read intent by calling one (or a few) read tools — the last
 *    read's card renders directly; or
 *  - assembles a mutation by first reading real data (datasets, criteria,
 *    runs) and then calling the mutation tool with complete, concrete inputs.
 *    The mutation tool returns a ProposedAction; nothing executes.
 *
 * The model never sees execute tools, never emits UI, and never fabricates
 * data — everything rendered comes from a tool result. If the LLM is
 * unreachable (no credentials, offline), the keyword resolver takes over.
 */

const MODEL = process.env.ASKTUPLE_PLANNER_MODEL ?? "claude-opus-4-8";
const MAX_TURNS = 6;

export interface PlanOutcome {
  resolver: "llm" | "keyword";
  resolvedToolId: string | null;
  steps: PlanStep[];
  result: CardResult;
}

const SYSTEM = `You are the intent resolver behind Asktuple, the natural-language door to Newtuple's internal products (currently Gaugetuple, an AI-evaluation platform).

Rules — these are the product's trust contract, not suggestions:
1. Use ONLY the tools provided. If none fits the request, reply in one plain sentence and call no tool.
2. Never invent data, ids, run states, or capabilities. Everything you assert must come from a tool result in this conversation.
3. Read intents: call the single most relevant read tool (you may refine with one follow-up call if the first result shows you need a different filter). The user sees the LAST read tool's result as a native card — you do not need to summarize it.
4. Mutation intents (propose_*): the proposal must be CONCRETE. First call read tools to find the real dataset ids/names, eval types in use, or runs the user is referring to, then call the propose_* tool with those real values filled in. Never call a propose_* tool with empty or made-up ids.
5. If the user's request is ambiguous between profiles' angles (e.g. "is it ready to ship"), prefer the reading that matches their profile, which is given with the request.`;

/** Anthropic tool names must match [a-zA-Z0-9_-]; toolIds contain dots. */
const toApiName = (id: string) => id.replace(/\./g, "__");
const fromApiName = (name: string) => name.replace(/__/g, ".");

function truncateForModel(result: CardResult): string {
  const s = JSON.stringify(result);
  return s.length > 6000 ? `${s.slice(0, 6000)}…(truncated)` : s;
}

export async function planWithLlm(
  intent: string,
  profile: ProfileId,
  tools: ToolManifest[],
): Promise<PlanOutcome> {
  const client = new Anthropic();
  const byId = new Map(tools.map((t) => [t.id, t]));
  const apiTools: Anthropic.Tool[] = tools.map((t) => ({
    name: toApiName(t.id),
    description: `[${t.kind}] ${t.summary}`,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Profile: ${profile}\nIntent: ${intent}` },
  ];
  const steps: PlanStep[] = [];
  let lastRead: { toolId: string; result: CardResult } | null = null;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      tools: apiTools,
      messages,
    });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      // Done without a mutation: render the last read, or a graceful no-tool.
      if (lastRead) {
        return { resolver: "llm", resolvedToolId: lastRead.toolId, steps, result: lastRead.result };
      }
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim();
      return {
        resolver: "llm",
        resolvedToolId: null,
        steps,
        result: { card: "unavailable", payload: { what: text || "a tool for this request" } },
      };
    }

    // A mutation call ends the plan: its result IS the proposal card.
    const mutation = toolUses.find((b) => byId.get(fromApiName(b.name))?.kind === "mutation");
    if (mutation) {
      const toolId = fromApiName(mutation.name);
      const result = await callTool(toolId, mutation.input as Record<string, unknown>);
      steps.push({ toolId, ok: result.card !== "unavailable" });
      return { resolver: "llm", resolvedToolId: toolId, steps, result };
    }

    // Execute reads, feed results back, continue planning.
    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const toolId = fromApiName(use.name);
      const result = await callTool(toolId, use.input as Record<string, unknown>);
      const ok = result.card !== "unavailable";
      steps.push({ toolId, ok });
      if (ok && byId.get(toolId)?.kind === "read") lastRead = { toolId, result };
      toolResults.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: truncateForModel(result),
        is_error: !ok,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Turn budget exhausted; render the best thing we have.
  if (lastRead) {
    return { resolver: "llm", resolvedToolId: lastRead.toolId, steps, result: lastRead.result };
  }
  return {
    resolver: "llm",
    resolvedToolId: null,
    steps,
    result: { card: "unavailable", payload: { what: "a plan within the step budget" } },
  };
}

// ---- Offline fallback: the original deterministic keyword resolver. --------

export async function planWithKeywords(
  intent: string,
  tools: ToolManifest[],
): Promise<PlanOutcome> {
  const has = (id: string) => tools.find((t) => t.id === id)?.id ?? null;
  const q = intent.toLowerCase();

  let pick: { toolId: string; input: Record<string, unknown> } | null = null;
  if (/regress|a\/b|compare|candidate|vs\b/.test(q)) {
    const id = has("gaugetuple.propose_evaluation");
    if (id) pick = { toolId: id, input: { evalType: "correctness", datasetId: "" } };
  }
  if (!pick && /golden|reference set|ground truth/.test(q)) {
    const id = has("gaugetuple.propose_golden_dataset");
    if (id) pick = { toolId: id, input: { name: "New golden set", sourceEntryIds: [] } };
  }
  if (!pick && /export|ppt|report|client/.test(q)) {
    const id = has("gaugetuple.propose_report_export");
    if (id) pick = { toolId: id, input: { scope: "latest run" } };
  }
  if (!pick && /run|evaluation|eval history/.test(q)) {
    const id = has("gaugetuple.list_eval_runs");
    if (id) pick = { toolId: id, input: { limit: 20 } };
  }
  if (!pick && /analytic|score|trend|pass rate|drop/.test(q)) {
    const id = has("gaugetuple.get_score_analytics");
    if (id) pick = { toolId: id, input: { window: "30d" } };
  }
  if (!pick && /dataset/.test(q)) {
    const id = has("gaugetuple.list_datasets");
    if (id) pick = { toolId: id, input: {} };
  }
  if (!pick && /prompt/.test(q)) {
    const id = has("gaugetuple.list_prompt_jobs");
    if (id) pick = { toolId: id, input: {} };
  }
  if (!pick) {
    const id = has("gaugetuple.get_platform_overview");
    if (id) pick = { toolId: id, input: {} };
  }

  if (!pick) {
    return {
      resolver: "keyword",
      resolvedToolId: null,
      steps: [],
      result: { card: "unavailable", payload: { what: "a tool for this request" } },
    };
  }
  const result = await callTool(pick.toolId, pick.input);
  return {
    resolver: "keyword",
    resolvedToolId: pick.toolId,
    steps: [{ toolId: pick.toolId, ok: result.card !== "unavailable" }],
    result,
  };
}

export async function plan(
  intent: string,
  profile: ProfileId,
  tools: ToolManifest[],
): Promise<PlanOutcome> {
  try {
    return await planWithLlm(intent, profile, tools);
  } catch (err) {
    console.warn("[host] LLM planner unavailable, using keyword fallback:", (err as Error).message);
    return planWithKeywords(intent, tools);
  }
}
