import express from "express";
import cors from "cors";
import {
  PROFILE_CAPABILITIES,
  toolsForProfile,
  type DoorRequest,
  type DoorResponse,
  type ProfileId,
  type ProposedAction,
} from "@asktuple/contract";
import { getTools, refreshTools, callTool } from "./mcp.js";
import { plan } from "./planner.js";
import { createProposal, consumeProposal } from "./proposals.js";

/**
 * Asktuple host. One door, many capability servers.
 *
 * /door     intent -> profile-scoped tool list -> planner -> card.
 *           Reads execute; mutations come back as stored proposals.
 * /approve  executes a stored proposal by id after re-checking capability.
 *           Never accepts a toolId+input from the client.
 * /tools    what this profile may even see (transparency + shell chips).
 */

const app = express();
app.use(cors());
app.use(express.json());

/**
 * TODO(P5): derive the profile from a real session (authtuple/SSO) instead of
 * trusting the request body. The shape is ready: everything downstream takes a
 * ProfileId from this one function.
 */
function resolveProfile(body: { profile?: ProfileId }): ProfileId {
  return body.profile ?? "client_viewer";
}

app.get("/tools", async (req, res) => {
  const profile = (req.query.profile as ProfileId) ?? "client_viewer";
  res.json({ profile, tools: toolsForProfile(await getTools(), profile) });
});

app.post("/door", async (req, res) => {
  const body = req.body as DoorRequest;
  const profile = resolveProfile(body);
  const tools = toolsForProfile(await getTools(), profile);
  const outcome = await plan(body.intent ?? "", profile, tools);

  let result = outcome.result;
  if (result.card === "proposal") {
    // Mint the approvable id server-side; the client can only echo it back.
    const stored = createProposal(result.payload as ProposedAction, profile);
    result = { ...result, payload: stored };
  }

  const response: DoorResponse = {
    resolvedToolId: outcome.resolvedToolId,
    resolver: outcome.resolver,
    steps: outcome.steps,
    result,
  };
  res.json(response);
});

app.post("/approve", async (req, res) => {
  const { proposalId } = req.body as { profile?: ProfileId; proposalId?: string };
  const profile = resolveProfile(req.body);
  if (!proposalId) return res.status(400).json({ error: "proposalId required" });

  const stored = consumeProposal(proposalId);
  if (!stored) return res.status(404).json({ error: "proposal_not_found_or_expired" });

  // Re-check capability server-side against the approving profile.
  if (!PROFILE_CAPABILITIES[profile]?.includes(stored.proposal.capability)) {
    return res.status(403).json({ error: "capability_denied" });
  }

  const result = await callTool(stored.proposal.execute.toolId, stored.proposal.execute.input);
  const payload = result.payload as { ok?: boolean; note?: string };
  res.json({
    ok: payload?.ok ?? false,
    executed: stored.proposal.execute.toolId,
    note: payload?.note ?? "Executed.",
    broadcastChannel: stored.proposal.broadcastChannel ?? null,
  });
});

const PORT = Number(process.env.PORT ?? 8787);
app.listen(PORT, async () => {
  console.log(`Asktuple host on :${PORT}`);
  const tools = await refreshTools();
  console.log(`[host] discovered ${tools.length} tools from capability servers`);
});
