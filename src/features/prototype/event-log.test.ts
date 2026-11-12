import { describe, expect, it } from "vitest";
import { appendEvents, clearEvents, EVENTS_KEY, readEvents } from "./event-log";
import { MAX_EXPERIMENT_EVENTS, type ExperimentEvent } from "./experiment";
import type { StoragePort } from "./storage";

function memory(initial?: string): StoragePort & { data: Map<string, string> } {
  const data = new Map<string, string>(initial === undefined ? [] : [[EVENTS_KEY, initial]]);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
const event = (i: number): ExperimentEvent => ({
  event: "employer_tab_opened",
  ts: "2026-11-12T10:00:00.000Z",
  publicationId: "job-1",
  variant: "scope_card",
  applicationId: `app-${i}`,
  attrs: { tab: "cv" },
});

describe("E1 event log", () => {
  it("stores events under its own key as compact JSON and caps the log", () => {
    const storage = memory();
    let log = readEvents(storage);
    log = appendEvents(storage, log, [event(1)]);
    expect(JSON.parse(storage.data.get(EVENTS_KEY)!)).toEqual([event(1)]);
    expect(storage.data.get(EVENTS_KEY)).not.toContain("\n");
    log = appendEvents(
      storage,
      log,
      Array.from({ length: MAX_EXPERIMENT_EVENTS }, (_, i) => event(i + 2)),
    );
    expect(log.events).toHaveLength(MAX_EXPERIMENT_EVENTS);
    expect(log.events[0].applicationId).toBe("app-2");
    expect(readEvents(storage).events).toHaveLength(MAX_EXPERIMENT_EVENTS);
  });
  it("never overwrites an unreadable log and keeps new events in memory", () => {
    const storage = memory("{not json");
    const log = appendEvents(storage, readEvents(storage), [event(1)]);
    expect(log).toMatchObject({ writable: false, events: [event(1)] });
    expect(storage.data.get(EVENTS_KEY)).toBe("{not json");
  });
  it("survives storage write failures and clears on reset", () => {
    const failing: StoragePort = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(appendEvents(failing, readEvents(failing), [event(1)]).writable).toBe(false);
    const storage = memory(JSON.stringify([event(1)]));
    expect(clearEvents(storage).events).toEqual([]);
    expect(readEvents(storage).events).toEqual([]);
  });
});
