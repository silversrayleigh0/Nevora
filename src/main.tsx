import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { checkAi } from "./lib/ai";
import { initSession } from "./lib/session";
import { useApp } from "./store/app";

initSession();
// Lets automated browser tests drive a signed-in session locally. Removed from production builds.
if (import.meta.env.DEV) Object.assign(window, { __nevora: { useApp } });
void checkAi();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
