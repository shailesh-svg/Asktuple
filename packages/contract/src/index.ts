/**
 * @asktuple/contract
 *
 * The shared contract between the Asktuple host (the shell) and each product's
 * MCP capability server (Gaugetuple first, Flowtuple and Dialogtuple later).
 *
 * Design rules encoded here:
 *  1. Truth boundary. Tools return typed data plus a CardType. Never prose the
 *     shell has to trust. If a source is unavailable, the tool returns an
 *     `unavailable` result and the shell renders a degraded card.
 *  2. Predictable UI. The shell renders from a fixed card registry keyed by
 *     CardType. The model selects a tool; it never paints markup.
 *  3. Capability scoping. Every tool declares a required Capability. The host
 *     filters tools by the caller's profile BEFORE intent resolution, so a
 *     profile cannot invoke what it is not allowed to do.
 *  4. Governed mutation. Any tool that changes state returns a ProposedAction.
 *     Nothing runs until an operator approves it.
 */

// ---------------------------------------------------------------------------
// Profiles and capabilities
// ---------------------------------------------------------------------------

/** Who is at the door. Same product, different lens. */
export type ProfileId =
  | "ai_engineer" // builds prompts and models; runs regression checks
  | "eval_engineer" // authors criteria, golden sets, configurations
  | "delivery_lead" // ship decision; runs standard suites; reads rollups
  | "client_viewer"; // read-only dashboards and live run broadcasts

/**
 * A capability is the unit of authorization. It must mirror the product's real
 * permission model, not a parallel one that can drift. Read capabilities are
 * safe by default; `run:*` and `write:*` gate mutation.
 */
export type Capability =
  | "read:overview"
  | "read:runs"
  | "read:analytics"
  | "read:datasets"
  | "read:prompt_jobs"
  | "write:golden_dataset"
  | "run:evaluation"
  | "run:prompt_job"
  | "export:report";

/** The capabilities each profile is granted. Enforced at the tool boundary. */
export const PROFILE_CAPABILITIES: Record<ProfileId, Capability[]> = {
  ai_engineer: [
    "read:overview",
    "read:runs",
    "read:analytics",
    "read:datasets",
    "read:prompt_jobs",
    "run:evaluation",
    "run:prompt_job",
  ],
  eval_engineer: [
    "read:overview",
    "read:runs",
    "read:analytics",
    "read:datasets",
    "read:prompt_jobs",
    "write:golden_dataset",
    "run:evaluation",
    "run:prompt_job",
    "export:report",
  ],
  delivery_lead: [
    "read:overview",
    "read:runs",
    "read:analytics",
    "read:datasets",
    "run:evaluation",
    "export:report",
  ],
  client_viewer: ["read:overview", "read:runs", "read:analytics", "export:report"],
};

// ---------------------------------------------------------------------------
// Tool manifest (what a product's MCP server advertises)
// ---------------------------------------------------------------------------

/**
 * "read" and "mutation" tools are advertised to the intent planner.
 * "execute" tools are never advertised: they are reachable only through an
 * approved proposal, so a client cannot invoke a mutation directly.
 */
export type ToolKind = "read" | "mutation" | "execute";

export interface ToolManifest {
  /** Namespaced id, e.g. "gaugetuple.list_eval_runs". */
  id: string;
  product: ProductId;
  kind: ToolKind;
  /** Required capability. The host filters by profile before resolving intent. */
  capability: Capability;
  /** One line the intent resolver reads to route a request. */
  summary: string;
  /** JSON Schema for the tool's input (also what the MCP server advertises). */
  inputSchema: Record<string, unknown>;
  /** The card type this tool renders into on success. */
  card: CardType;
}

export type ProductId = "gaugetuple" | "flowtuple" | "dialogtuple";

// ---------------------------------------------------------------------------
// Card contracts (the fixed vocabulary the shell can render)
// ---------------------------------------------------------------------------

export type CardType =
  | "overview_kpis"
  | "run_list"
  | "run_detail"
  | "score_analytics"
  | "dataset_list"
  | "prompt_job_list"
  | "proposal" // a ProposedAction awaiting approval
  | "run_broadcast" // a live, read-only run view
  | "unavailable"; // degraded state, source could not be read

/** Every tool result carries its card type and the typed payload for it. */
export interface CardResult<T = unknown> {
  card: CardType;
  payload: T;
  /** Follow-up intents the shell can offer as chips (like EVA does today). */
  suggestions?: string[];
}

// ---------------------------------------------------------------------------
// Governed mutation
// ---------------------------------------------------------------------------

/**
 * A mutation tool never executes on call. It returns a ProposedAction that the
 * shell renders as a proposal card. Execution happens only after an operator
 * approves it through the host, which re-checks capability.
 */
export interface ProposedAction {
  id: string;
  product: ProductId;
  /** Human-readable, e.g. "Run a Correctness evaluation of prompt v3 vs v2". */
  title: string;
  /** The exact tool + input the host will execute on approval. */
  execute: { toolId: string; input: Record<string, unknown> };
  capability: Capability;
  /** What the operator is agreeing to, in plain terms. */
  effects: string[];
  /** Set when the run, once approved, can be watched live. */
  broadcastChannel?: string;
}

// ---------------------------------------------------------------------------
// Broadcast (live run views for whoever should see them)
// ---------------------------------------------------------------------------

export type RunEventType = "queued" | "running" | "progress" | "passed" | "failed" | "done";

export interface RunEvent {
  channel: string;
  type: RunEventType;
  at: string; // ISO timestamp
  /** 0..100 for progress; result summary on done. */
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Host request/response envelope
// ---------------------------------------------------------------------------

export interface DoorRequest {
  profile: ProfileId;
  /** Plain-language intent typed at the door. */
  intent: string;
}

/** One step the planner took on the way to the rendered card (transparency). */
export interface PlanStep {
  toolId: string;
  ok: boolean;
}

export interface DoorResponse {
  /** The tool the host resolved the intent to (for transparency). */
  resolvedToolId: string | null;
  /** How the intent was resolved: LLM planner, or the offline keyword fallback. */
  resolver: "llm" | "keyword";
  /** Reads the planner executed to ground the result (empty for direct reads). */
  steps: PlanStep[];
  result: CardResult;
}

/** Utility: which tools may this profile even see (execute tools are never advertised). */
export function toolsForProfile(tools: ToolManifest[], profile: ProfileId): ToolManifest[] {
  const allowed = new Set(PROFILE_CAPABILITIES[profile]);
  return tools.filter((t) => t.kind !== "execute" && allowed.has(t.capability));
}
