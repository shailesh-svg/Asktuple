import { randomUUID } from "node:crypto";
import type { ProfileId, ProposedAction } from "@asktuple/contract";

/**
 * Server-side proposal store. A proposal is approvable only by the id the host
 * minted when it was created — /approve never accepts a toolId+input from the
 * client, so a client cannot craft and self-approve a mutation. In-memory with
 * a TTL for now; swap for a table when proposals need to survive restarts.
 */

const TTL_MS = 15 * 60 * 1000;

interface StoredProposal {
  proposal: ProposedAction;
  profile: ProfileId;
  createdAt: number;
}

const store = new Map<string, StoredProposal>();

function sweep(): void {
  const now = Date.now();
  for (const [id, p] of store) {
    if (now - p.createdAt > TTL_MS) store.delete(id);
  }
}

/** Store a proposal, minting the id the client must use to approve it. */
export function createProposal(proposal: ProposedAction, profile: ProfileId): ProposedAction {
  sweep();
  const id = `prop_${randomUUID()}`;
  const stored: ProposedAction = { ...proposal, id };
  store.set(id, { proposal: stored, profile, createdAt: Date.now() });
  return stored;
}

export function getProposal(id: string): StoredProposal | null {
  sweep();
  return store.get(id) ?? null;
}

/** One-shot: an approved proposal cannot be replayed. */
export function consumeProposal(id: string): StoredProposal | null {
  const p = getProposal(id);
  if (p) store.delete(id);
  return p;
}
