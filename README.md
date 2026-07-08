# Asktuple

One natural-language door to Newtuple's internal products. You describe what you
want in plain language. Asktuple resolves who you are, reads what is true in the
product, and assembles the right native view. Anything that changes data comes
back as a proposal you approve. Execution is watchable live by whoever should
see it.

First product behind the door: **Gaugetuple** (AI evaluation). Flowtuple and
Dialogtuple come later, by adding a capability server, not by rewriting the shell.

## Why this exists

Gaugetuple works. Adoption does not, even among our own engineers. Running a
trustworthy evaluation is a five-screen ritual (golden dataset, criteria,
pipeline, run, analytics), and each screen assumes you already know evaluation
methodology. The live dashboard shows the tell: 53 criteria, 59 runs, 2,346 rows
across 14 datasets, and **0 golden datasets, 0 evaluation datasets**. People run
evaluations but skip the structured setup that makes results defensible, because
the ceremony is too heavy. Asktuple turns the ceremony into a sentence of intent.

## Architecture in one paragraph

Each product ships its own **MCP capability server** (real MCP, Streamable HTTP)
that advertises typed tools with Asktuple metadata: required capability, kind
(read / mutation / execute), and card type. Asktuple is the **host**: it
discovers tools over MCP, filters them by the caller's profile BEFORE intent
resolution, then runs an LLM **planner** constrained to that tool list. Read
intents render directly. Mutation intents are planned — reads first, so the
proposal names real datasets and criteria — and come back as server-stored
**proposals**; approval is by proposal id only, re-checked for capability, and
routed to execute tools the planner can never see. The shell renders from a
fixed **card registry**. The model selects and fills tools; it never invents
data and never paints UI. See `docs/ARCHITECTURE.md`.

## Layout

```
apps/shell             The Asktuple door (Vite + React). Profile picker, intent box, card registry.
packages/contract      The shared contract: profiles, capabilities, tools, cards, proposals, run events.
packages/ui            Newtuple brand tokens.
servers/host           The Asktuple host: MCP client, LLM planner, proposal store, /door /approve /tools.
servers/gaugetuple-mcp The Gaugetuple MCP capability server: manifest, API client, propose/execute tools.
docs/                  ARCHITECTURE.md, PROFILES.md, HANDOFF.md, GAUGETUPLE_API.md.
```

## Run it

```bash
pnpm install
GAUGETUPLE_COOKIE='<dev.gaugetuple.com cookie>' pnpm dev:gaugetuple  # MCP server on :8788/mcp
ANTHROPIC_API_KEY='<key>' pnpm dev:host                              # host on :8787
pnpm dev                                                             # shell on :5173
```

Without Anthropic credentials the host falls back to a deterministic keyword
resolver; without a Gaugetuple session, reads render degraded cards by design.
Adding a product = registering its MCP server URL in `ASKTUPLE_SERVERS`.

## Principles (inherited and improved from my-ai-portal)

Kept: governed proposals for every mutation; the truth boundary (a source that
cannot be read renders a degraded card, never a guess). Improved: the bespoke
portal-manifest is replaced by per-product capability servers and a standard tool
contract, so adding a product is additive; and profiles scope real capability at
the tool boundary, not just presentation.

## Brand

Newtuple style. Cobalt (`#0047AB`) is the only accent. Inter typeface. Generous
whitespace. Calm authority in copy. Tokens live in `packages/ui/src/tokens.ts`.
