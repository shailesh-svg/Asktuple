import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CardResult, Capability, CardType, ProductId, ToolKind, ToolManifest } from "@asktuple/contract";

/**
 * MCP client side of the host. Connects to each registered capability server,
 * rebuilds ToolManifests from tools/list _meta, and executes tools/call.
 *
 * Registering a new product = adding its URL to ASKTUPLE_SERVERS. No shell or
 * host code changes.
 */

const SERVER_URLS = (process.env.ASKTUPLE_SERVERS ?? "http://localhost:8788/mcp")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

interface Connection {
  url: string;
  client: Client | null;
  /** toolId -> MCP tool name on this server */
  tools: Map<string, string>;
}

const connections: Connection[] = SERVER_URLS.map((url) => ({
  url,
  client: null,
  tools: new Map(),
}));

let manifests: ToolManifest[] = [];

/** Domain primers each capability server ships at initialize (MCP instructions). */
const serverInstructions = new Map<string, string>();

async function connect(conn: Connection): Promise<void> {
  const client = new Client({ name: "asktuple-host", version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(conn.url)));
  conn.client = client;
  const instructions = client.getInstructions();
  if (instructions) serverInstructions.set(conn.url, instructions);
}

/** Concatenated primers from every connected server — appended to the planner's system prompt. */
export function getServerInstructions(): string {
  return [...serverInstructions.values()].join("\n\n");
}

function manifestFromMcpTool(tool: {
  name: string;
  description?: string;
  inputSchema?: unknown;
  _meta?: Record<string, unknown>;
}): ToolManifest | null {
  const meta = tool._meta ?? {};
  const id = meta["asktuple/id"];
  const capability = meta["asktuple/capability"];
  const kind = meta["asktuple/kind"];
  const card = meta["asktuple/card"];
  const product = meta["asktuple/product"];
  if (!id || !capability || !kind || !card || !product) return null; // not an Asktuple tool
  return {
    id: id as string,
    product: product as ProductId,
    kind: kind as ToolKind,
    capability: capability as Capability,
    summary: tool.description ?? "",
    inputSchema: (tool.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown>,
    card: card as CardType,
  };
}

/** (Re)discover tools from every server. Unreachable servers contribute nothing. */
export async function refreshTools(): Promise<ToolManifest[]> {
  const all: ToolManifest[] = [];
  for (const conn of connections) {
    try {
      if (!conn.client) await connect(conn);
      const { tools } = await conn.client!.listTools();
      conn.tools.clear();
      for (const t of tools) {
        const m = manifestFromMcpTool(t);
        if (m) {
          conn.tools.set(m.id, t.name);
          all.push(m);
        }
      }
    } catch (err) {
      conn.client = null; // reconnect next time
      console.warn(`[host] capability server unreachable: ${conn.url}`, (err as Error).message);
    }
  }
  manifests = all;
  return all;
}

export async function getTools(): Promise<ToolManifest[]> {
  if (manifests.length === 0) await refreshTools();
  return manifests;
}

/** Execute a tool by Asktuple id on whichever server advertises it. */
export async function callTool(toolId: string, input: Record<string, unknown>): Promise<CardResult> {
  await getTools();
  const conn = connections.find((c) => c.tools.has(toolId));
  if (!conn) return { card: "unavailable", payload: { what: toolId } };
  try {
    if (!conn.client) await connect(conn);
    const result = await conn.client!.callTool({
      name: conn.tools.get(toolId)!,
      arguments: input,
    });
    const text = (result.content as Array<{ type: string; text?: string }>).find(
      (c) => c.type === "text",
    )?.text;
    if (!text) return { card: "unavailable", payload: { what: toolId } };
    return JSON.parse(text) as CardResult;
  } catch (err) {
    conn.client = null;
    console.warn(`[host] tools/call failed for ${toolId}:`, (err as Error).message);
    return { card: "unavailable", payload: { what: toolId } };
  }
}
