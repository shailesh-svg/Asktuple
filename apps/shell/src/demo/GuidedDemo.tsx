import { DEMO_SCRIPT } from "./script.js";

/**
 * The narrator bar for the guided demo. Deterministic: steps fire real intents
 * through the door; the only unscripted action is the user's own Approve click
 * (the governance moment is deliberately not automated).
 */
export function GuidedDemo({
  step,
  runStarted,
  onNext,
  onExit,
}: {
  step: number;
  runStarted: boolean;
  onNext: () => void;
  onExit: () => void;
}) {
  const current = DEMO_SCRIPT[step];
  if (!current) return null;
  const waitingForApprove = current.waitFor === "approve" && !runStarted;
  const last = step === DEMO_SCRIPT.length - 1;

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        padding: "14px 18px",
        borderRadius: 16,
        background: "var(--cobalt)",
        color: "white",
        marginBottom: 24,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 1, whiteSpace: "nowrap", paddingTop: 2 }}>
        GUIDED DEMO · {step + 1}/{DEMO_SCRIPT.length}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{current.title}</div>
        <div style={{ fontSize: 13, opacity: 0.92, marginTop: 2, lineHeight: 1.5 }}>{current.narration}</div>
      </div>
      <div style={{ display: "flex", gap: 8, whiteSpace: "nowrap" }}>
        <button
          onClick={onNext}
          disabled={waitingForApprove}
          style={{
            padding: "8px 16px",
            borderRadius: 9999,
            border: "none",
            background: "white",
            color: "var(--cobalt)",
            font: "inherit",
            fontWeight: 600,
            cursor: waitingForApprove ? "default" : "pointer",
            opacity: waitingForApprove ? 0.5 : 1,
          }}
        >
          {waitingForApprove ? "Approve to continue" : last ? "Finish" : "Next →"}
        </button>
        <button
          onClick={onExit}
          style={{
            padding: "8px 12px",
            borderRadius: 9999,
            border: "1px solid rgba(255,255,255,.4)",
            background: "transparent",
            color: "white",
            font: "inherit",
            cursor: "pointer",
          }}
        >
          Exit
        </button>
      </div>
    </div>
  );
}
