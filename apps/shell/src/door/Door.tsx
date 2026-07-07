import { useState } from "react";
import type { ProfileId } from "@asktuple/contract";

const STARTERS: Record<ProfileId, string[]> = {
  ai_engineer: ["Did my new prompt regress against the current one?", "List my recent eval runs"],
  eval_engineer: ["Create a golden dataset from these examples", "Show configurations"],
  delivery_lead: ["Is the model ready to ship?", "Export a client report for the latest run"],
  client_viewer: ["Show the success dashboard", "Export a PPT report"],
};

/** The plain-language entry. Chat is the door, not the product. */
export function Door({
  onAsk,
  loading,
  profile,
}: {
  onAsk: (intent: string) => void;
  loading: boolean;
  profile: ProfileId;
}) {
  const [text, setText] = useState("");

  return (
    <div style={{ marginTop: 24 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onAsk(text.trim());
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe what you want..."
          rows={3}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 12,
            border: "1px solid var(--gray-200)",
            font: "inherit",
            resize: "vertical",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "10px 16px",
            borderRadius: 9999,
            border: "none",
            background: "var(--cobalt)",
            color: "white",
            font: "inherit",
            fontWeight: 600,
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Asking..." : "Ask"}
        </button>
      </form>

      <div style={{ marginTop: 16, fontSize: 11, letterSpacing: 1, color: "var(--gray-600)" }}>
        TRY
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        {STARTERS[profile].map((s) => (
          <button
            key={s}
            onClick={() => onAsk(s)}
            style={{
              textAlign: "left",
              padding: "6px 10px",
              borderRadius: 9999,
              border: "1px solid var(--gray-200)",
              background: "var(--gray-50)",
              font: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
