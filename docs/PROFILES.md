# Profiles: who uses evals, and from what angle

The core observation from the Gaugetuple walkthrough: internal and business users
use the **same features from different angles**. Same data, different intent. Run
History is a regression audit to an engineer and a release-readiness check to a
delivery lead. Analytics is a debugging tool to one and a client quality report to
another. Export PPT is noise to a builder and the deliverable to an account owner.

So we do not build separate feature sets. We build one capability surface and four
lenses over it. Profiles decide what a person can ask and what they can do.

## The four profiles

| Profile | Angle | Sees | Can do (capabilities) |
|---|---|---|---|
| AI Engineer | Build side | Recent runs, regression views, prompt jobs | read overview/runs/analytics/datasets/prompt jobs, run evaluation, run prompt job |
| Eval Engineer | Build side | Everything above plus configurations and golden sets | all reads, write golden dataset, run evaluation/prompt job, export report |
| Delivery Lead / PM | Ship decision | Pass-rate rollups, run history, analytics | reads, run standard evaluation, export report. No criteria authoring. |
| Client / Leadership | Read-only | Success dashboards, live run broadcasts, reports | read overview/runs/analytics, export report. No mutation. |

Capabilities are enforced at the tool boundary in `packages/contract`
(`PROFILE_CAPABILITIES`) and re-checked on approval in the gateway. A client
profile does not merely have mutation buttons hidden; the mutation tools are
never in its tool list, so the intent resolver cannot reach them.

## Feature to intent, by angle

| Gaugetuple feature | Internal intent | Business intent | Tool | Card |
|---|---|---|---|---|
| Platform overview | "How healthy is the eval suite?" | "What's our quality posture?" | get_platform_overview | overview_kpis |
| Run History | "Did my prompt regress?" | "Is the model ready to ship?" | list_eval_runs / get_eval_run | run_list / run_detail |
| Analytics | "Why did the score drop?" | "Trend for the client report" | get_score_analytics | score_analytics |
| New Evaluation | "A/B my candidate prompt" | "Test against our standard" | propose_evaluation | proposal |
| Golden datasets | "Set a reference set" | (rare) | propose_golden_dataset | proposal |
| Prompt Lab | "Improve this prompt" | (rare) | list_prompt_jobs | prompt_job_list |
| Export PPT | (rare) | "Client-ready report" | propose_report_export | proposal |
| Safety eval type | "Fix failing cases" | "Compliance sign-off" | list_eval_runs (safety) | run_list |

## Note on EVA

Gaugetuple already has an in-app assistant, EVA, that answers eval questions in
chat with text and follow-up chips. Asktuple is a different layer. EVA answers
inside one product; Asktuple operates across products, assembles native
interactive views, scopes by profile, governs mutations, and broadcasts runs.
Asktuple should wrap or supersede EVA, not duplicate it.
