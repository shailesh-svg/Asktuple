/**
 * Heuristic map: resolved tool -> a real Gaugetuple page, rendered live in an
 * iframe next to the card. This is the DEMO bridge until the MCP server owns
 * the full flow — it shows the actual product UI reacting to intent.
 *
 * The UI routes below are best guesses from the app structure; correct them in
 * this one file after eyeballing the real navigation. Unknown intents fall back
 * to the app root.
 *
 * Framing dev.gaugetuple.com requires the "Gaugetuple Capture" extension with
 * "Enable iframe embedding" clicked (strips frame headers + SameSite for the
 * session cookie). See tools/gaugetuple-capture/README.md.
 */

export const GAUGETUPLE_URL =
  (import.meta.env.VITE_GAUGETUPLE_URL as string | undefined) ?? "https://dev.gaugetuple.com";

/**
 * VERIFIED: /evals/* paths are the API namespace, not UI routes — they render
 * JSON 404s in the frame. Fill each value with the real UI path: open the page
 * in Gaugetuple's nav and copy the path from the address bar (e.g. the Run
 * History page, the Analytics dashboard, the New Evaluation wizard).
 */
const ROUTES: Record<string, string> = {
  "gaugetuple.get_platform_overview": "/",
  "gaugetuple.list_eval_runs": "/", // TODO: Run History page path
  "gaugetuple.get_eval_run": "/", // TODO: run detail path (append id later)
  "gaugetuple.get_score_analytics": "/", // TODO: Analytics page path
  "gaugetuple.list_datasets": "/", // TODO: Datasets page path
  "gaugetuple.list_prompt_jobs": "/", // TODO: Prompt Lab page path
  "gaugetuple.propose_evaluation": "/", // TODO: New Evaluation wizard path
  "gaugetuple.propose_golden_dataset": "/", // TODO: dataset create path
  "gaugetuple.propose_report_export": "/", // TODO: analytics/report path
};

export function liveUrlFor(resolvedToolId: string | null): string {
  const path = (resolvedToolId && ROUTES[resolvedToolId]) || "/";
  return `${GAUGETUPLE_URL}${path}`;
}
