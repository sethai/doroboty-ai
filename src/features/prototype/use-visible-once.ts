import { useEffect, useRef } from "react";

/**
 * Calls `onVisible` once, after the element has stayed at least partly in view for `minMs`.
 * Used only for local experiment events; does nothing without IntersectionObserver.
 */
export function useVisibleOnce<T extends Element>(
  onVisible: () => void,
  { enabled = true, minMs = 0 }: { enabled?: boolean; minMs?: number } = {},
) {
  const ref = useRef<T>(null);
  const done = useRef(false);
  const callback = useRef(onVisible);
  useEffect(() => {
    callback.current = onVisible;
  });
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || done.current || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (!entry?.isIntersecting) return;
        timer = window.setTimeout(() => {
          done.current = true;
          observer.disconnect();
          callback.current();
        }, minMs);
      },
      { threshold: 0.25 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [enabled, minMs]);
  return ref;
}
