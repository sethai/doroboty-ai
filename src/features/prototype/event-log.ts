import { z } from "zod";
import { experimentEventSchema, MAX_EXPERIMENT_EVENTS, type ExperimentEvent } from "./experiment";
import type { StoragePort } from "./storage";

/**
 * Local E1 event log, kept apart from the scenario save so telemetry never grows the
 * scenario past its import limit or interferes with scenario errors. Compact JSON, capped.
 */
export const EVENTS_KEY = "doroboty.prototype.e1-events.v1";
const logSchema = z.array(experimentEventSchema).max(MAX_EXPERIMENT_EVENTS);

export type EventLog = { events: ExperimentEvent[]; writable: boolean };

/** An unreadable log is left untouched; new events then stay in memory only. */
export function readEvents(storage: StoragePort | null): EventLog {
  if (!storage) return { events: [], writable: false };
  try {
    const raw = storage.getItem(EVENTS_KEY);
    if (!raw) return { events: [], writable: true };
    const parsed = logSchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? { events: parsed.data, writable: true }
      : { events: [], writable: false };
  } catch {
    return { events: [], writable: false };
  }
}

export function appendEvents(
  storage: StoragePort | null,
  log: EventLog,
  added: readonly ExperimentEvent[],
): EventLog {
  if (!added.length) return log;
  const events = [...log.events, ...added].slice(-MAX_EXPERIMENT_EVENTS);
  if (!log.writable || !storage) return { events, writable: log.writable };
  try {
    storage.setItem(EVENTS_KEY, JSON.stringify(events));
    return { events, writable: true };
  } catch {
    return { events, writable: false };
  }
}

export function clearEvents(storage: StoragePort | null): EventLog {
  try {
    storage?.setItem(EVENTS_KEY, "[]");
    return { events: [], writable: Boolean(storage) };
  } catch {
    return { events: [], writable: false };
  }
}
