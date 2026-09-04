"use client";

import { useEffect, useState } from "react";
import { fetchUnitLibraryIndex, type UnitLibraryIndex } from "@/lib/unit-library";

export type UnitLibraryState = {
  status: "loading" | "ready" | "unavailable";
  index: UnitLibraryIndex | null;
};

export function useUnitLibrary(): UnitLibraryState {
  const [state, setState] = useState<UnitLibraryState>({ status: "loading", index: null });
  useEffect(() => {
    const controller = new AbortController();
    fetchUnitLibraryIndex(controller.signal)
      .then((index) => setState({ status: "ready", index }))
      .catch((error) => { if (error?.name !== "AbortError") setState({ status: "unavailable", index: null }); });
    return () => controller.abort();
  }, []);
  return state;
}
