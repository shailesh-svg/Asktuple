# Asktuple — Engineering Handoff

Purpose: hand this project to an engineer/agent who will execute. This is the
current, factual state plus the exact remaining work with acceptance criteria.
No strategy re-litigation; that lives in `README.md`, `docs/ARCHITECTURE.md`,
and `docs/PROFILES.md`.

## What Asktuple is (one paragraph)

A single natural-language door in front of Newtuple's internal products, starting
with Gaugetuple (AI evaluation). User types intent → host resolves profile +
capability, plans against the product API (reads first, to ground the request in
real data), and assembles a native card. Mutations return an approval proposal
stored server-side. Reads never fabricate; unavailable sources render a degraded
card. Adding a product later = registering another MCP capability server, not
editing the shell or the host.

## Repo

- GitHub: `https://github.com/shailesh-svg/Asktuple` (branch `main`).
- Local working copy currently in a temp session folder — MOVE IT to a stable
  path (e.g. `~/dev/asktuple`).
- Stack: pnpm workspace, TypeScript. Client = Vite + React. Host + capability
  server = Express + tsx. Capability server speaks real MCP
  (`@modelcontextprotocol/sdk`, Streamable HTTP). Planner = Anthropic SDK.

## Run

```bash
pnpm install
# terminal 1 — Gaugetuple MCP capability server on :8788/mcp
GAUGETUPLE_COOKIE='<paste a logged-in dev.gaugetuple.com cookie>' pnpm dev:gaugetuple
# terminal 2 — Asktuple host on :8787 (LLM planner needs Anthropic credentials)
ANTHROPIC_API_KEY='<key>' pnpm dev:host
# terminal 3 — shell on :5173
pnpm dev
```

Without `ANTHROPIC_API_KEY` the host falls back to the deterministic keyword
resolver (works, but is routing only — no plan-then-propose). Without
`GAUGETUPLE_COOKIE` reads correctly return `unavailable` cards.

## Architecture (current, verified)

```
shell (:5173) ──/door /approve /tools──▶ host (:8787) ──MCP tools/list+call──▶ gaugetuple-mcp (:8788/mcp) ──▶ Gaugetuple API
```

- **gaugetuple-mcp** is a real MCP server. Tools carry Asktuple metadata in
  `_meta` (`asktuple/capability`, `asktuple/kind`, `asktuple/card`). Three tool
  kinds: `read` (execute freely), `mutation` (return a ProposedAction, never
  execute), `execute` (never advertised to the planner; reachable only through
  an approved proposal). Any MCP host can consume this server.
- **host** discovers tools over MCP (`ASKTUPLE_SERVERS`, comma-separated URLs —
  this is how Flowtuple/Dialogtuple get added), filters by profile capability
  BEFORE resolution, then runs the **planner**: an LLM agentic loop
  (claude-opus-4-8) given only the profile-scoped tools. Read intents → one
  read tool, card renders directly. Mutation intents → the planner calls read
  tools first (real dataset ids/names) then the propose_* tool with concrete
  inputs. Keyword resolver is the offline fallback.
- **Proposals are stored server-side** with a minted id (15 min TTL, one-shot).
  `/approve` takes ONLY `{profile, proposalId}` — re-checks capability, then
  calls the execute_* tool over MCP. A client cannot submit a toolId+input.
- **Shell** renders from the fixed card registry; shows a resolution trace
  (which tool, planner vs fallback, which reads grounded it).

## Verified (smoke-tested end to end)

- `pnpm install`, `pnpm -r typecheck` (5 packages), shell build: pass.
- Host discovers 12 tools from the MCP server; execute tools never appear in
  `/tools` for any profile.
- `/door` regression intent → proposal card with server-minted id (keyword path;
  LLM path not yet run — no Anthropic credentials on the dev machine).
- `/approve` by id executes the stub and returns the honest P1 note; replaying
  the same id → 404; forged `{toolId,input}` body → 400; `client_viewer`
  approving a `run:evaluation` proposal → 403.

## File map

```
packages/contract/src/index.ts        Types + PROFILE_CAPABILITIES + toolsForProfile(). The contract.
packages/ui/src/tokens.ts             Newtuple brand tokens (cobalt #0047AB, Inter).
servers/gaugetuple-mcp/src/manifest.ts Tool list: id, capability, kind, JSON Schema input, card.
servers/gaugetuple-mcp/src/knowledge.ts Domain primer (MCP instructions -> planner prompt) + explain tool topics.
servers/gaugetuple-mcp/src/tools.ts    Gaugetuple API client + read impls + proposals + execute stubs.
servers/gaugetuple-mcp/src/index.ts    MCP server (Streamable HTTP, stateless) on :8788/mcp.
servers/host/src/index.ts              Host: /tools, /door, /approve. resolveProfile() = P5 hook.
servers/host/src/mcp.ts                MCP client; ASKTUPLE_SERVERS registry; manifest discovery.
servers/host/src/planner.ts            LLM planner (agentic loop) + keyword fallback.
servers/host/src/proposals.ts          Server-side proposal store (TTL, one-shot approve).
apps/shell/src/App.tsx                 Profile picker, ask(), approve-by-id, resolution trace.
apps/shell/src/registry/cardRegistry.tsx  Fixed CardType → component map. All UI lives here.
docs/GAUGETUPLE_API.md                 Observed real API (endpoints + reference values).
```

## Gaugetuple API (observed live; full detail in docs/GAUGETUPLE_API.md)

Same-origin under `/evals`. Auth = session cookie in browser.

Reads (wired): `/evals/eval_jobs/list`, `/evals/dataset/list?type=golden|evaluation|linked`,
`/evals/configs/list`, `/evals/prompt-competitions`, `/evals/projects`,
`/evals/dashboard/project-{score-trends,provider-comparison,eval-type-breakdown}`.

Mutations (NOT yet observed — must be captured): run evaluation (likely
`POST /evals/eval_jobs`), create golden dataset (likely `POST /evals/dataset`),
export PPT (unknown).

## Auth options

Gateway → Gaugetuple: set `GAUGETUPLE_COOKIE` (full Cookie header) or
`GAUGETUPLE_API_TOKEN` (Bearer) before starting `dev:gaugetuple`. If Gaugetuple
has no service-token path, add one; a shared front door should not depend on a
human's browser cookie in production.

Host → Anthropic: `ANTHROPIC_API_KEY` (or any SDK-resolvable credential).
Planner model override: `ASKTUPLE_PLANNER_MODEL` (default `claude-opus-4-8`).

## Remaining work (priority order, with acceptance criteria)

### P0 — Confirm live reads + live planner
Provide `GAUGETUPLE_COOKIE` and `ANTHROPIC_API_KEY`, run "did my new prompt
regress vs the current one" as AI Engineer.
- Done when: the planner calls list_datasets/list_eval_runs first and the
  proposal names a REAL dataset (id + name), and "show platform overview" shows
  the real counts (≈59 runs, 53 criteria, 14 linked).

### P1 — Capture mutation endpoints, wire real execution
On dev.gaugetuple.com with DevTools → Network recording, trigger: New Evaluation
Wizard (submit), create a golden dataset, Export PPT. Record method, path, body.
Then fill in `executeApproved()` in `servers/gaugetuple-mcp/src/tools.ts`.
- Done when: approving a `propose_evaluation` in the shell creates a real run in
  Gaugetuple Run History, and `/approve` still 403s for `client_viewer`.

### P2 — Live run broadcast
After a run is created, stream progress to the `run_broadcast` card. Add an SSE
endpoint on the host (`GET /runs/:channel/events`) that polls the Gaugetuple run
status via MCP and emits `RunEvent`s (type already in contract).
- Done when: approving a run opens a live card that updates to passed/failed
  without a manual refresh.

### P3 — Real analytics charts
`score_analytics` currently renders panels/tables. Add recharts for score trends
and provider comparison once the payload shape is confirmed live.

### P4 — Real authorization model
`resolveProfile()` in `servers/host/src/index.ts` trusts the request body — it
is the single hook for P5-grade identity. Derive profile from a real session
(authtuple/SSO) and wire `PROFILE_CAPABILITIES` to Gaugetuple's actual roles so
it cannot drift. Use per-user Gaugetuple credentials so the audit trail is true.

## Gotchas

- The keyword resolver is the FALLBACK, not the resolver. Do not demo without
  Anthropic credentials and call it the product.
- MCP server is stateless Streamable HTTP (a fresh server per POST). If you add
  server-initiated notifications later, switch to session mode.
- Anthropic tool names cannot contain dots; the host maps `gaugetuple.x` ⇄
  `gaugetuple__x` at the API boundary (`planner.ts`).
- We use pnpm (`workspace:*`). Do not `npm install` at the root.
- Shell → host is cross-origin (5173→8787); host has CORS enabled. Keep it.

## Definition of done for Phase 1

An AI Engineer types "did my new prompt regress vs the current one", the planner
reads real datasets/criteria and returns a concrete proposal, they approve it, a
real evaluation runs in Gaugetuple, and the result renders live in the shell —
while a Client profile can watch the run but cannot trigger or approve it.
