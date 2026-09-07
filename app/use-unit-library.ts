"use client";

import { useEffect, useState } from "react";
import { fetchUnitLibraryIndexWithSource, type UnitLibraryIndex, type UnitLibraryIndexSource } from "@/lib/unit-library";

export type UnitLibraryState = {
  status: "loading" | "ready" | "unavailable";
  index: UnitLibraryIndex | null;
  source: UnitLibraryIndexSource | null;
  syncedAt: string | null;
};

export function useUnitLibrary(enabled = true): UnitLibraryState {
  const [state, setState] = useState<UnitLibraryState>(enabled ? { status: "loading", index: null, source: null, syncedAt: null } : { status: "unavailable", index: null, source: null, syncedAt: null });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let syncing = false;
    const sync = async () => {
      if (syncing || controller.signal.aborted) return;
      syncing = true;
      try {
        const result = await fetchUnitLibraryIndexWithSource(controller.signal);
        setState({ status: "ready", index: result.index, source: result.source, syncedAt: new Date().toISOString() });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState((current) => current.index ? current : { status: "unavailable", index: null, source: null, syncedAt: null });
      } finally {
        syncing = false;
      }
    };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void sync(); };
    void sync();
    const interval = window.setInterval(() => void sync(), 30_000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [enabled]);
  return enabled ? state : { status: "unavailable", index: null, source: null, syncedAt: null };
}
