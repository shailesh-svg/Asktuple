import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Asktuple MCP server: the DOOR itself as MCP tools, over stdio.
 *
 * This is the layer that lets any MCP host — Claude Code, Claude Desktop, an
 * IDE, another agent — drive Asktuple end to end, INCLUDING live actions:
 * ask in natural language, receive proposals, approve them, watch the run.
 *
 * Governance is preserved, not bypassed:
 *  - `ask` never mutates; a mutation intent returns a stored proposal id.
 *  - `approve_proposal` is the live action. In every serious MCP host the
 *    tool call itself surfaces a human confirmation prompt — that prompt IS
 *    the approval click, so a human stays in the loop even agent-to-agent.
 *  - Capability scoping still applies per profile, enforced by the host.
 *
 * Register in Claude Code:
 *   claude mcp add asktuple -- pnpm --dir <repo> --filter @asktuple/asktuple-mcp dev
 * Requires the Asktuple host running (ASKTUPLE_HOST, default :8787).
 */

const HOST = process.env.ASKTUPLE_HOST ?? "http://localhost:8787";

const PROFILES = ["ai_engineer", "eval_engineer", "delivery_lead", "client_viewer"];

const INSTRUCTIONS = `Asktuple is the natural-language door to Newtuple's internal products (Gaugetuple AI-evaluation first).
Flow: ask(intent, profile) -> a typed card. Reads return data. Mutation intents return a PROPOSAL with a proposalId — nothing has executed.
To execute a live action, call approve_proposal with that id (the human confirmation on this tool call is the approval). If the result contains a broadcastChannel, poll run_status to watch progress and get the verdict.
Profiles scope capability: client_viewer is read-only; ai_engineer can run evaluations; eval_engineer can also create golden datasets; delivery_lead can run standard evals and export reports.`;

async function hostFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${HOST}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (body as { error?: string }).error ?? `HTTP ${res.status}`, status: res.status };
  return body;
}

const TOOLS = [
  {
    name: "ask",
    description:
      "Ask Asktuple anything in natural language ('list my eval runs', 'did my prompt regress?', 'what is a golden dataset?'). " +
      "Returns a typed card. If the intent is a mutation, returns a proposal (result.payload.id is the proposalId) — nothing executes until approve_proposal.",
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "string", description: "Plain-language request." },
        profile: { type: "string", enum: PROFILES, description: "Whose lens/capabilities to use. Default ai_engineer." },
      },
      required: ["intent"],
      additionalProperties: false,
    },
  },
  {
    name: "list_capabilities",
    description: "List the tools a profile may use behind the door (transparency / to know what is askable).",
    inputSchema: {
      type: "object",
      properties: {
        profile: { type: "string", enum: PROFILES, description: "Default ai_engineer." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "approve_proposal",
    description:
      "EXECUTE a previously returned proposal — this is the live action (e.g. actually run the evaluation). " +
      "One-shot: a proposalId works once and expires after 15 minutes. Returns ok/note and a broadcastChannel to watch the run.",
    inputSchema: {
      type: "object",
      properties: {
        proposalId: { type: "string", description: "The id from a proposal card returned by ask." },
        profile: { type: "string", enum: PROFILES, description: "Approving profile; must hold the required capability." },
      },
      required: ["proposalId"],
      additionalProperties: false,
    },
  },
  {
    name: "run_status",
    description:
      "Snapshot of a live run's broadcast: events so far (queued/running/progress with rows + pass rate) and whether it finished. Poll until done:true for the verdict.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "broadcastChannel from approve_proposal." },
      },
      required: ["channel"],
      additionalProperties: false,
    },
  },
];

async function call(name: string, args: Record<string, unknown>): Promise<unknown> {
  const profile = (args.profile as string) ?? "ai_engineer";
  switch (name) {
    case "ask":
      return hostFetch("/door", { method: "POST", body: JSON.stringify({ profile, intent: args.intent }) });
    case "list_capabilities":
      return hostFetch(`/tools?profile=${encodeURIComponent(profile)}`);
    case "approve_proposal":
      return hostFetch("/approve", {
        method: "POST",
        body: JSON.stringify({ profile, proposalId: args.proposalId }),
      });
    case "run_status":
      return hostFetch(`/runs/${encodeURIComponent(args.channel as string)}`);
    default:
      return { error: `unknown tool ${name}` };
  }
}

const server = new Server(
  { name: "asktuple", version: "0.1.0" },
  { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const result = await call(req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>);
  const isError = typeof result === "object" && result !== null && "error" in result;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    isError,
  };
});

await server.connect(new StdioServerTransport());
console.error(`Asktuple MCP server on stdio (host: ${HOST})`);
