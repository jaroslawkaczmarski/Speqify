import React from "react";
import { hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// The HTML is prerendered at build time (see prerender.mjs / entry-server.tsx),
// so hydrate the existing markup instead of rendering from an empty root.
hydrateRoot(
  document.getElementById("root")!,
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
