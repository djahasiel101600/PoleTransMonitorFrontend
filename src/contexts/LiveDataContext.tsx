/**
 * LiveDataContext
 *
 * Holds a single WebSocket connection per selected transformer and exposes
 * the latest reading + connection state to any descendant component through
 * context.  This prevents every <SingleMetricChart> instance from opening its
 * own independent WebSocket connection (which was causing 7× duplicate
 * connections and 7× simultaneous state updates per reading).
 *
 * Usage
 * -----
 * 1. Wrap the subtree that needs live data with <LiveDataContext.Provider value={...}>
 *    (Dashboard.tsx already calls useMonitorWebSocket once – we just publish
 *    those values through context instead of re-running the hook per chart).
 *
 * 2. In any descendant: `const { wsReading, connected } = useLiveData();`
 */

import { createContext, useContext } from "react";
import type { Reading } from "../types";

export interface LiveDataContextValue {
  /** The most recent reading pushed from the WebSocket, or null. */
  wsReading: Reading | null;
  /** True when the WebSocket is open AND the device has sent a reading recently. */
  connected: boolean;
}

export const LiveDataContext = createContext<LiveDataContextValue>({
  wsReading: null,
  connected: false,
});

/** Consume the shared live-data context inside any descendant of Dashboard. */
export function useLiveData(): LiveDataContextValue {
  return useContext(LiveDataContext);
}
