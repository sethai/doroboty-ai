import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { initialState, transition, type Action, type State } from "./model";
import { parseState, readState, saveState, type StoragePort } from "./storage";
import { appendEvents, clearEvents, readEvents } from "./event-log";
import {
  buildExperimentEvent,
  type ExperimentEvent,
  type ExperimentEventInput,
} from "./experiment";
function browserStorage(): StoragePort | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function useStore() {
  const [loaded] = useState(() => readState(browserStorage()));
  const [state, setState] = useState(loaded.state);
  const [issue, setIssue] = useState(loaded.issue);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(loaded.blocked);
  const latest = useRef(state);
  const [eventLog, setEventLog] = useState(() => readEvents(browserStorage()));
  const latestLog = useRef(eventLog);
  function record(added: readonly ExperimentEvent[]) {
    const next = appendEvents(browserStorage(), latestLog.current, added);
    latestLog.current = next;
    setEventLog(next);
  }
  /** Telemetry only: never changes the scenario, its errors or its save. */
  function logEvent(input: ExperimentEventInput) {
    try {
      record([buildExperimentEvent(latest.current, input, new Date().toISOString())]);
    } catch {
      // An event for a record that no longer exists is dropped.
    }
  }
  function commit(next: State, replace = false) {
    latest.current = next;
    setState(next);
    setError("");
    if (blocked && !replace) return;
    try {
      saveState(browserStorage(), next);
      setIssue("");
      if (replace) setBlocked(false);
    } catch (e) {
      setIssue((e as Error).message);
    }
  }
  function run(action: Action) {
    try {
      const emitted: ExperimentEvent[] = [];
      commit(
        transition(latest.current, action, new Date().toISOString(), crypto.randomUUID(), emitted),
      );
      record(emitted);
      return true;
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "Sprawdź poprawność i długość wprowadzonych danych.",
      );
      return false;
    }
  }
  function importState(raw: string) {
    try {
      const next = parseState(raw);
      commit(next, true);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);
  return {
    state,
    issue,
    error,
    blocked,
    original: loaded.original,
    run,
    importState,
    events: eventLog.events,
    logEvent,
    clearError: () => setError(""),
    reset: () => {
      commit(initialState(), true);
      const cleared = clearEvents(browserStorage());
      latestLog.current = cleared;
      setEventLog(cleared);
    },
  };
}
type Store = ReturnType<typeof useStore>;
const Context = createContext<Store | null>(null);
export function PrototypeProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function usePrototype() {
  const store = useContext(Context);
  if (!store) throw new Error("PrototypeProvider is required");
  return store;
}
