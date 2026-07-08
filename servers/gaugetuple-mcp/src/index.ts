import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { CardResult } from "@asktuple/contract";
import { GAUGETUPLE_TOOLS } from "./manifest.js";
import { INSTRUCTIONS, explain } from "./knowledge.js";
import * as T from "./tools.js";

/**
 * Gaugetuple capability server — a real MCP server (Streamable HTTP).
 *
 * Advertises tools/list with Asktuple metadata in _meta:
 *   asktuple/capability  the Capability the caller must hold
 *   asktuple/kind        read | mutation | execute
 *   asktuple/card        the CardType the shell renders the result into
 *   asktuple/product     "gaugetuple"
 *
 * The Asktuple host is one client of this server; any MCP host can be another.
 * Tool results are CardResults serialized as JSON text content. This server
 * holds no authorization state — profile scoping and the proposal/approve flow
 * live in the host.
 */

/** MCP tool names must match [a-zA-Z0-9_-]; strip the "gaugetuple." prefix. */
const localName = (id: string) => id.split(".").pop()!;

async function callAsktupleTool(id: string, input: Record<string, unknown>): Promise<CardResult> {
  switch (id) {
    case "gaugetuple.explain":
      return explain(input as { topic?: string });
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
    case "gaugetuple.execute_evaluation":
    case "gaugetuple.execute_golden_dataset":
    case "gaugetuple.execute_report_export": {
      const result = await T.executeApproved(id, input);
      return { card: "unavailable", payload: result };
    }
    default:
      return { card: "unavailable", payload: { what: id } };
  }
}

function buildServer(): Server {
  // `instructions` is the MCP-native way to ship domain knowledge: every host
  // (Asktuple's planner, Claude, an IDE) receives the primer at initialize.
  const server = new Server(
    { name: "asktuple-gaugetuple", version: "0.1.0" },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: GAUGETUPLE_TOOLS.map((t) => ({
      name: localName(t.id),
      description: t.summary,
      inputSchema: t.inputSchema as any,
      _meta: {
        "asktuple/id": t.id,
        "asktuple/capability": t.capability,
        "asktuple/kind": t.kind,
        "asktuple/card": t.card,
        "asktuple/product": t.product,
      },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = GAUGETUPLE_TOOLS.find((t) => localName(t.id) === req.params.name);
    if (!tool) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ card: "unavailable", payload: { what: req.params.name } }) }],
        isError: true,
      };
    }
    const result = await callAsktupleTool(tool.id, (req.params.arguments ?? {}) as Record<string, unknown>);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  });

  return server;
}

// Stateless Streamable HTTP: one server+transport pair per request.
const app = express();
app.use(cors());
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Stateless mode has no session to GET/DELETE.
app.get("/mcp", (_req, res) => res.status(405).json({ error: "stateless server; POST only" }));
app.delete("/mcp", (_req, res) => res.status(405).json({ error: "stateless server; POST only" }));

const PORT = Number(process.env.PORT ?? 8788);
app.listen(PORT, () => console.log(`Gaugetuple MCP server on :${PORT}/mcp`));
