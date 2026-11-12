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

export function captureEvent(event: string, properties?: EventProperties) {
  if (isPostHogConfigured()) {
    posthog.capture(event, properties);
    logPostHogAction(event);
  }
}
