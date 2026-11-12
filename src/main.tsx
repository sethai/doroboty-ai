import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import { PostHogErrorBoundary } from "@posthog/react";
import { App } from "./features/prototype/app";
import "./app/globals.css";

const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

if (posthogToken && posthogHost) {
  posthog.init(posthogToken, {
    api_host: posthogHost,
    defaults: "2026-08-30",
    // Free text (notes, scope cards, answers) must never leave the browser.
    session_recording: { maskAllInputs: true, maskTextSelector: "*" },
    logs: {
      serviceName: "doroboty-ai-case-web",
      environment: import.meta.env.MODE,
      serviceVersion: "0.1.0",
    },
  });
  posthog.logger.info("posthog logging initialized", {
    service: "doroboty-ai-case-web",
  });
}
// Without both variables PostHog stays off: participants run `npm run dev`
// with no .env and the prototype makes no external requests.

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogErrorBoundary>
      <App />
    </PostHogErrorBoundary>
  </StrictMode>,
);
