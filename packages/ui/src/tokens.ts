/**
 * Newtuple brand tokens. Single source of truth for Asktuple's look.
 * Derived from the Newtuple style guide. Cobalt is the only accent.
 */
export const tokens = {
  color: {
    cobalt: "#0047AB", // signature accent. Use sparingly and purposefully.
    cobaltGradient: "linear-gradient(90deg, #0047AB 0%, #00B8D9 100%)", // hero only
    white: "#FFFFFF",
    black: "#000000",
    gray900: "#111827", // body text
    gray600: "#4B5563", // secondary text, labels
    gray200: "#E5E7EB", // borders, rules
    gray50: "#F9FAFB", // subtle fills, alt rows
    // Functional only, never decorative.
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
  },
  font: {
    family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  },
  radius: { card: "16px", pill: "9999px" },
  space: (n: number) => `${n * 4}px`,
} as const;

/** Inject as CSS variables at the app root. */
export const cssVars = `
  :root {
    --cobalt: ${tokens.color.cobalt};
    --white: ${tokens.color.white};
    --gray-900: ${tokens.color.gray900};
    --gray-600: ${tokens.color.gray600};
    --gray-200: ${tokens.color.gray200};
    --gray-50: ${tokens.color.gray50};
    --success: ${tokens.color.success};
    --warning: ${tokens.color.warning};
    --error: ${tokens.color.error};
    --font: ${tokens.font.family};
    --radius-card: ${tokens.radius.card};
  }
`;
