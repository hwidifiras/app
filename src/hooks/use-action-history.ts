"use client";

import { useCallback, useEffect, useState } from "react";

export type ActionHistoryEntry<TScope = string> = {
  scope?: TScope;
  label?: string;
  undo: () => Promise<boolean>;
};

export function findLastEntryIndex<TScope>(
  entries: ActionHistoryEntry<TScope>[],
  scope?: TScope,
): number {
  if (entries.length === 0) return -1;
  if (scope === undefined) return entries.length - 1;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.scope === scope) {
      return index;
    }
  }

  return -1;
}

type UseActionHistoryOptions = {
  maxDepth?: number;
  enableKeyboard?: boolean;
};

export function useActionHistory<TScope = string>(options: UseActionHistoryOptions = {}) {
  const maxDepth = options.maxDepth ?? 20;
  const [entries, setEntries] = useState<ActionHistoryEntry<TScope>[]>([]);
  const [loading, setLoading] = useState(false);

  const push = useCallback(
    (entry: ActionHistoryEntry<TScope>) => {
      setEntries((current) => [...current, entry].slice(-maxDepth));
    },
    [maxDepth],
  );

  const undoLast = useCallback(
    async (scope?: TScope): Promise<boolean> => {
      if (loading) return false;

      const targetIndex = findLastEntryIndex(entries, scope);
      if (targetIndex < 0) return false;

      const entry = entries[targetIndex];
      if (!entry) return false;

      setLoading(true);
      try {
        const ok = await entry.undo();
        if (ok) {
          setEntries((current) => current.filter((_, index) => index !== targetIndex));
        }
        return ok;
      } finally {
        setLoading(false);
      }
    },
    [entries, loading],
  );

  const countInScope = useCallback(
    (scope: TScope) => entries.filter((entry) => entry.scope === scope).length,
    [entries],
  );

  const canUndoInScope = useCallback((scope: TScope) => countInScope(scope) > 0, [countInScope]);

  useEffect(() => {
    if (!options.enableKeyboard) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        void undoLast();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [options.enableKeyboard, undoLast]);

  return {
    push,
    undoLast,
    loading,
    entries,
    count: entries.length,
    countInScope,
    canUndo: entries.length > 0,
    canUndoInScope,
  };
}
