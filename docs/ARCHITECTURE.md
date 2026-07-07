# Architecture

## The shape

```
                 ┌─────────────────────────────────────────┐
   plain-language│                Asktuple shell            │
   intent  ─────▶│  profile picker · intent box · card      │
                 │  registry (fixed, predictable UI)        │
                 └───────────────┬─────────────────────────┘
                                 │ DoorRequest { profile, intent }
                                 ▼
                 ┌─────────────────────────────────────────┐
                 │              Asktuple host                │
                 │  1. filter tools by profile capability    │
                 │  2. resolve intent -> one tool (LLM,      │
                 │     constrained to the allowed tools)     │
                 │  3. execute reads; return mutations as    │
                 │     proposals; re-check on /approve       │
                 └───────┬───────────────┬───────────────────┘
                         │               │
              ┌──────────▼───┐   ┌────────▼────────┐   (later)
              │ gaugetuple   │   │  flowtuple mcp  │   dialogtuple mcp
              │ capability   │   │  (add a server, │
              │ server       │   │   no shell edit)│
              └──────┬───────┘   └─────────────────┘
                     │ typed reads / mutations, returns CardResult
                     ▼
              Gaugetuple API  (the single source of truth)
```

## Four rules the code enforces

1. **Truth boundary.** Tools return typed data plus a `CardType`, never prose the
   shell has to trust. A source that cannot be read returns an `unavailable`
   card. The model never fabricates results, run state, or capabilities.
2. **Predictable UI.** The shell renders from a fixed card registry keyed by
   `CardType`. The model selects a tool and fills inputs; it does not emit markup.
   The same request from the same profile produces the same interface every time.
3. **Capability scoping at the tool boundary.** Every tool declares a required
   `Capability`. The host filters the tool list by the caller's profile *before*
   intent resolution, so a profile cannot invoke what it may not do. Approval
   re-checks capability server-side.
4. **Governed mutation.** Mutation tools return a `ProposedAction`. Nothing runs
   until an operator approves it through the host.

## Why this beats a bespoke portal-manifest (the my-ai-portal spine)

my-ai-portal proved the governed-proposal flow and the truth boundary. Keep both.
Two changes make it a product rather than a personal workbench:

- **Per-product capability servers instead of one hand-written manifest.** Each
  tuple product owns and ships its own tool contract. Adding Flowtuple or
  Dialogtuple is additive: register a server, its tools appear at the door. No
  shell rewrite, no growing central manifest to keep in sync. This is the "MCP
  UI" idea made concrete: a standard tool protocol, one host, many products.
- **Profiles scope capability, not just presentation.** my-ai-portal treats a
  persona as a display filter. For adoption that is not enough. Scoping the tool
  list to the role is what makes the surface feel light, and it is a real
  authorization boundary rather than hidden buttons.

## Build order

Phase 0. Manifest plus one read intent ("show my last eval run"). Internal engineers.
Phase 1. The regression check end to end: `propose_evaluation` with approval and result. The sharp first win.
Phase 2. `propose_golden_dataset` (turn the 0 into a 1). Add the eval-engineer profile.
Phase 3. Live run broadcast plus the client/leadership read-only profile.
Phase 4. Widen intents, then register the Flowtuple and Dialogtuple servers.

## Open questions to resolve against Gaugetuple

- Does Gaugetuple expose roles/permissions via API so `PROFILE_CAPABILITIES` can
  mirror the real model rather than duplicate it?
- What is the safe, signed, read-only surface for live run broadcast?
- Which mutation endpoints exist (run evaluation, create golden dataset, export
  report) and what do they accept?
- Should the intent resolver itself be evaluated in Gaugetuple? The door becomes
  its own first eval client.
