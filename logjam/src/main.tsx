import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { BrowserRouter } from "./router";
import { DecisionProvider } from "./state/Decisions";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element is missing");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <DecisionProvider>
        <App />
      </DecisionProvider>
    </BrowserRouter>
  </StrictMode>
);
