import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";

// sidepanel.html sert aussi de popup (?mode=popup) ou de fenêtre (?mode=window) sans side panel.
document.documentElement.dataset.mode =
  new URLSearchParams(location.search).get("mode") ?? "sidepanel";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
