# Gaugetuple API (observed)

Captured live from dev.gaugetuple.com (a Next.js app). The API is same-origin.
Auth is a browser session cookie; for the gateway set `GAUGETUPLE_API_TOKEN` or
`GAUGETUPLE_COOKIE`. Reads without auth return an `unavailable` card by design.

## Reads (wired in `servers/gaugetuple-mcp/src/tools.ts`)

| Purpose | Endpoint |
|---|---|
| Projects (for analytics scoping) | `GET /evals/projects` |
| Organizations | `GET /authtuple/organizations/` |
| Datasets | `GET /evals/dataset/list?type=golden\|evaluation\|linked&page=1&limit=200` |
| View configurations (criteria) | `GET /evals/configs/list?page=1&limit=50` |
| Eval runs / jobs | `GET /evals/eval_jobs/list?page=1&limit=N` |
| Prompt Lab jobs | `GET /evals/prompt-competitions?limit=10&offset=0` |
| EVA agent session | `GET /evals/agent/sessions/{sessionId}` |

### Dashboard / analytics

| Purpose | Endpoint |
|---|---|
| Global trends | `GET /evals/dashboard/trends?days=7` |
| Global eval-type breakdown | `GET /evals/dashboard/eval-type-breakdown?days=7` |
| Score distribution | `GET /evals/dashboard/score-distribution` |
| Project datasets | `GET /evals/dashboard/project-datasets?project_id={id}` |
| Project score trends | `GET /evals/dashboard/project-score-trends?project_id={id}&days=30` |
| Project provider comparison | `GET /evals/dashboard/project-provider-comparison?project_id={id}&days=30` |
| Project eval-type breakdown | `GET /evals/dashboard/project-eval-type-breakdown?project_id={id}&days=30` |

Platform overview KPIs are composed from the dataset/config/job list counts (no
single overview endpoint was observed).

## Mutations (not yet observed live — confirm before wiring `/approve`)

Trigger these once in the UI with the network tab open, then fill in the method,
path, and body:

- Run an evaluation (New Evaluation Wizard). Likely `POST /evals/eval_jobs`.
- Create a golden dataset. Likely `POST /evals/dataset` with `type=golden`.
- Export PPT report. Endpoint unknown.

## Reference values

- Eval types: `correctness`, `custom_llm_grader`, `relevancy`, `completeness`, `safety`, `coherence_clarity`, `f1`, `exact_match`.
- Providers: `deepeval`, `custom_llm`, `lighteval`, `newtuple`.
- Default project id seen in dev: `3cf39edc-09bf-4a07-83a6-c80e750d4fb4`.
