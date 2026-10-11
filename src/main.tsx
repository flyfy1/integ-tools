import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "@integ-life/ui/styles.css";
import "./shared-layout.css";
import { startAnalytics } from "./analytics";

startAnalytics();

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
