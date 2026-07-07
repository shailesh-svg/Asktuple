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

Each product ships its own **MCP-style capability server** that advertises typed
tools (reads and mutations). Asktuple is the **host**: it filters tools by the
caller's profile, resolves plain-language intent to one tool, executes reads, and
returns mutations as **proposals** that need approval. Tools return typed data
plus a **card type**; the shell renders from a fixed **card registry**, so the
same request always produces the same interface. The model selects a tool. It
never invents data and never paints UI. See `docs/ARCHITECTURE.md`.

## Layout

```
apps/shell            The Asktuple door (Vite + React). Profile picker, intent box, card registry.
packages/contract     The shared contract: profiles, capabilities, tools, cards, proposals, run events.
packages/ui           Newtuple brand tokens.
servers/gaugetuple-mcp The Gaugetuple capability server + host gateway. Manifest, tools, /door, /approve.
docs/                 ARCHITECTURE.md, PROFILES.md.
```

## Run it

```bash
pnpm install
cp .env.example .env          # set GAUGETUPLE_API_BASE / token
pnpm dev:gaugetuple           # gateway on :8787
pnpm dev                      # shell on :5173
```

The Gaugetuple API endpoints in `servers/gaugetuple-mcp/src/tools.ts` are marked
`TODO`; the response shapes match what the UI observed at dev.gaugetuple.com, so
the shell and contract can be built against them before the endpoints are wired.

## Principles (inherited and improved from my-ai-portal)

Kept: governed proposals for every mutation; the truth boundary (a source that
cannot be read renders a degraded card, never a guess). Improved: the bespoke
portal-manifest is replaced by per-product capability servers and a standard tool
contract, so adding a product is additive; and profiles scope real capability at
the tool boundary, not just presentation.

## Brand

Newtuple style. Cobalt (`#0047AB`) is the only accent. Inter typeface. Generous
whitespace. Calm authority in copy. Tokens live in `packages/ui/src/tokens.ts`.
