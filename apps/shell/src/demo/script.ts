/**
 * The guided demo script: a deterministic, agent-led walkthrough that rides
 * the REAL pipeline — every step fires an actual intent through /door, renders
 * real cards from mock (or live) data, and ends with a genuine proposal ->
 * approval -> live streaming run. No LLM required; when the planner goes live
 * the same journey happens organically and this remains the pitch script.
 */

export interface DemoStep {
  title: string;
  /** What the guide says before/while this step's card is on screen. */
  narration: string;
  /** Intent fired through the door when the step starts (omit for wait steps). */
  intent?: string;
  /** "approve": wait for the user to click Approve; advance when the run starts. */
  waitFor?: "approve";
}

export const DEMO_SCRIPT: DemoStep[] = [
  {
    title: "Meet Gaugetuple",
    narration:
      "I'll walk you through the platform and then we'll run a real evaluation together. First, the 60-second primer — what Gaugetuple actually does.",
    intent: "What is Gaugetuple?",
  },
  {
    title: "The platform today",
    narration:
      "These KPIs are read live from the platform. Notice the tension: 59 evaluations, 53 criteria… and 0 golden datasets. People run evals but skip the setup that makes results defensible. That gap is why this door exists.",
    intent: "Show platform overview",
  },
  {
    title: "Your data",
    narration:
      "All 14 datasets are 'linked' — rows flowing in from live projects. None are golden reference sets yet. Real traffic, no curated truth. Keep that in mind for what comes next.",
    intent: "Show my linked datasets",
  },
  {
    title: "The audit trail",
    narration:
      "Run History: every evaluation, its eval type, provider, and pass rate. Spot the failed exact_match run at 42% — that's what a regression looks like when you catch it.",
    intent: "List my recent eval runs",
  },
  {
    title: "Why scores move",
    narration:
      "Analytics answers 'why': score trends over time, how providers compare as judges, and which eval types are weakest. An engineer debugs with this; a delivery lead reads release-readiness off the same numbers.",
    intent: "Why is the pass rate where it is?",
  },
  {
    title: "Now run one — by sentence",
    narration:
      "Instead of the five-screen wizard, we just say it: 'did my new prompt regress?'. The agent builds a concrete run proposal. Read what it will do — nothing executes until YOU approve. Click 'Approve and run' when ready.",
    intent: "Did my new prompt regress against the current one?",
    waitFor: "approve",
  },
  {
    title: "Watch it live",
    narration:
      "The run is executing — progress, rows scored, and the rolling pass rate stream in live. Anyone permitted can watch this, including read-only leadership profiles. The verdict lands without a single refresh.",
  },
  {
    title: "That's the door",
    narration:
      "Primer → truth → proposal → approval → live result. One sentence instead of five screens, with governance at every step. From here, just ask anything — or switch profiles to see the same door through a client's eyes.",
    intent: "What is a golden dataset?",
  },
];
