import posthog from "posthog-js";

type EventProperties = Record<string, string | number | boolean>;

function isPostHogConfigured() {
  return Boolean(
    import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN && import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  );
}

function logPostHogAction(event: string) {
  posthog.logger.info("product action completed", { event_name: event });
}

// Hash routing keeps location.pathname at "/", so PostHog's history-based
// pageview capture never fires on route changes. The router calls this instead.
export function capturePageview() {
  if (isPostHogConfigured()) posthog.capture("$pageview");
}

export function captureEvent(event: string, properties?: EventProperties) {
  if (isPostHogConfigured()) {
    posthog.capture(event, properties);
    logPostHogAction(event);
  }
}
