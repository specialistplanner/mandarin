"use client";

import type { ExternalResourceRef } from "@/lib/domain";
import { findLinkedLesson, findLinkedUnit, referenceDeepLink } from "@/lib/unit-library";
import type { UnitLibraryState } from "./use-unit-library";

export function ResourceLinkAction({ reference, library, onRelink, label, className, unavailableLabel }: {
  reference?: ExternalResourceRef;
  library: UnitLibraryState;
  onRelink?: () => void;
  label?: string;
  className?: string;
  unavailableLabel?: string;
}) {
  if (!reference) return null;
  const resolved = reference.resourceType === "lesson" ? findLinkedLesson(library.index, reference) : findLinkedUnit(library.index, reference);
  if (library.status === "ready" && !resolved) {
    if (unavailableLabel) return <span className={className}>{unavailableLabel}</span>;
    return <span className="resource-unavailable"><span>Linked resource unavailable</span>{onRelink && <button type="button" onClick={onRelink}>Relink</button>}</span>;
  }
  const href = referenceDeepLink(reference) ?? reference.url;
  if (!href) {
    if (unavailableLabel) return <span className={className}>{unavailableLabel}</span>;
    return <span className="resource-unavailable"><span>Linked resource unavailable</span>{onRelink && <button type="button" onClick={onRelink}>Relink</button>}</span>;
  }
  return <a className={className ?? "resource-open-link"} href={href} target="_blank" rel="noopener noreferrer">{label ?? (reference.resourceType === "lesson" ? "Open lesson" : "Open in Unit Library")} <span aria-hidden="true">↗</span></a>;
}
