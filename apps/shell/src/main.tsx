import React from "react";
import { createRoot } from "react-dom/client";
import { cssVars } from "@asktuple/ui";
import { App } from "./App.js";

const style = document.createElement("style");
style.textContent =
  cssVars +
  `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: var(--font); color: var(--gray-900); background: var(--white); }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
