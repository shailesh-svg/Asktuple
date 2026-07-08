# Asktuple — Engineering Handoff

Purpose: hand this project to an engineer/agent who will execute. This is the
current, factual state plus the exact remaining work with acceptance criteria.
No strategy re-litigation; that lives in `README.md`, `docs/ARCHITECTURE.md`,
and `docs/PROFILES.md`.

## What Asktuple is (one paragraph)

A single natural-language door in front of Newtuple's internal products, starting
with Gaugetuple (AI evaluation). User types intent → host resolves profile +
capability, reads truth from the product API, assembles a native card. Mutations
return an approval proposal. Reads never fabricate; unavailable sources render a
degraded card. Adding a product later = adding a capability server, not editing
the shell.

## Repo

- GitHub: `https://github.com/shailesh-svg/Asktuple` (branch `main`).
- Local working copy currently at:
  `~/Library/Application Support/Claude/local-agent-mode-sessions/.../outputs/asktuple`
  MOVE IT to a stable path (e.g. `~/dev/asktuple`) — the current location is a
  temp session folder and can be cleared.
- Stack: pnpm workspace, TypeScript. Client = Vite + React. Server = Express + tsx.

## Run

```bash
pnpm install
# terminal 1 — gateway on :8787
GAUGETUPLE_COOKIE='<paste a logged-in dev.gaugetuple.com cookie>' pnpm dev:gaugetuple
# terminal 2 — shell on :5173
pnpm dev
```

Requires Node 18+ (developed on Node 26, pnpm 9). Open http://localhost:5173.

## Current status (verified)

- `pnpm install`, `pnpm -r typecheck` (all 4 packages), and `pnpm --filter @asktuple/shell build` all pass.
- Gateway smoke-tested: capability filtering, intent→tool resolution, proposal
  generation, and `/approve` capability re-check (403 for disallowed profile) all work.
- Shell renders native cards: KPI tiles, tables (runs/datasets/prompt jobs),
  analytics panels, working Approve button, degraded state.
- Read tools are wired to the REAL Gaugetuple endpoints (see below). Without a
  session they correctly return `unavailable`.

## File map

```
packages/contract/src/index.ts        Types + PROFILE_CAPABILITIES + toolsForProfile(). The contract.
packages/ui/src/tokens.ts             Newtuple brand tokens (cobalt #0047AB, Inter).
servers/gaugetuple-mcp/src/manifest.ts Tool list: id, capability, card, input.
servers/gaugetuple-mcp/src/tools.ts    Gaugetuple API client + read impls + mutation proposals.
servers/gaugetuple-mcp/src/index.ts    Express gateway: /tools, /door (resolve+execute), /approve. Keyword resolver (PLACEHOLDER).
apps/shell/src/App.tsx                 Profile picker, ask(), approve().
apps/shell/src/door/Door.tsx           Intent box + per-profile starter chips.
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

## Auth options (server-side gateway)

Set either env var before starting the gateway:
- `GAUGETUPLE_COOKIE` — full Cookie header copied from a logged-in session.
- `GAUGETUPLE_API_TOKEN` — sent as `Authorization: Bearer`.
If Gaugetuple has no service-token path, add one; a shared front door should not
depend on a human's browser cookie in production.

## Remaining work (priority order, with acceptance criteria)

### P0 — Confirm live reads
Provide a valid `GAUGETUPLE_COOKIE`, load the shell, run "show platform overview"
and "list my eval runs".
- Done when: overview shows the real counts (≈59 runs, 53 criteria, 14 linked) and
  the run table shows real rows. If it 401s, inspect the gateway fetch and adjust
  the auth header (cookie vs bearer vs same-site).

### P1 — Capture mutation endpoints, wire real execution
On dev.gaugetuple.com with DevTools → Network recording, trigger: New Evaluation
Wizard (submit), create a golden dataset, Export PPT. Record method, path, body.
Then in `servers/gaugetuple-mcp/src/index.ts` `/approve`, replace the TODO with the
real POST(s), keyed by `toolId`.
- Done when: approving a `propose_evaluation` in the shell creates a real run in
  Gaugetuple Run History, and `/approve` still 403s for `client_viewer`.

### P2 — Live run broadcast
After a run is created, stream progress to the `run_broadcast` card. Add an SSE
endpoint on the gateway (`GET /runs/:channel/events`) that polls the Gaugetuple
run status and emits `RunEvent`s (type already in contract). Render a live
progress card and let read-only profiles subscribe.
- Done when: approving a run opens a live card that updates to passed/failed
  without a manual refresh.

### P3 — Replace the keyword resolver with constrained LLM tool-selection
`resolveIntent()` in `index.ts` is a deterministic placeholder. Replace with an
LLM call that is given ONLY `toolsForProfile(...)` and must return a toolId + inputs.
Must not invent tools or data. Keep the placeholder as offline fallback.
- Done when: free-form intents route correctly and out-of-scope intents return a
  graceful "no tool" result, with the resolved toolId shown for transparency.

### P4 — Real analytics charts
`score_analytics` currently renders panels/tables. Add recharts (already common in
the ecosystem) for score trends and provider comparison once the payload shape is
confirmed against a live response.

### P5 — Real authorization model
`PROFILE_CAPABILITIES` in `packages/contract` is hand-defined. Wire it to
Gaugetuple's actual roles/permissions (via `/authtuple/organizations/` or a roles
endpoint) so it cannot drift. `/approve` must check server-side against the real model.

## Gotchas

- `resolveIntent` is keyword-based on purpose; do not ship it as the resolver.
- The first commit accidentally included `package-lock.json` and a `_tmp_*` file.
  `.gitignore` now excludes them; run `git rm --cached package-lock.json _tmp_*`
  once and commit.
- We use pnpm (`workspace:*`). Do not `npm install` at the root.
- Shell → gateway is cross-origin (5173→8787); gateway has CORS enabled. Keep it.

## Definition of done for Phase 1

An AI Engineer types "did my new prompt regress vs the current one", gets a
proposal built from real datasets/criteria, approves it, a real evaluation runs in
Gaugetuple, and the result renders live in the shell — while a Client profile can
watch the run but cannot trigger or approve it.
