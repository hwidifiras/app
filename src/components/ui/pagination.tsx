"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export const DEFAULT_PAGE_SIZE = 20;

export function usePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE, resetKey = "") {
  const [paginationState, setPaginationState] = useState({ page: 1, resetKey });
  const page = paginationState.resetKey === resetKey ? paginationState.page : 1;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * pageSize;

  return {
    currentPage,
    pageCount,
    pageItems: items.slice(startIndex, startIndex + pageSize),
    setPage: (nextPage: number) => setPaginationState({ page: nextPage, resetKey }),
    startIndex,
  };
}

function visiblePages(currentPage: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous && page - previous > 1) result.push("ellipsis");
    result.push(page);
  });

  return result;
}

export function Pagination({
  currentPage,
  pageCount,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  className,
}: {
  currentPage: number;
  pageCount: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const pages = useMemo(() => visiblePages(currentPage, pageCount), [currentPage, pageCount]);
  if (pageCount <= 1) return null;

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-center text-xs tabular-nums text-[var(--muted-foreground)] sm:text-left">
        Éléments {firstItem}–{lastItem} sur {totalItems}
      </p>

      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="btn btn-ghost min-h-10 min-w-10 px-2 disabled:opacity-40"
          aria-label="Page précédente"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Précédent</span>
        </button>

        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((page, index) =>
            page === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="flex size-9 items-center justify-center text-xs text-[var(--muted-foreground)]">
                …
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                aria-current={page === currentPage ? "page" : undefined}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg text-xs font-semibold transition",
                  page === currentPage
                    ? "bg-[var(--primary)] text-white shadow-[var(--shadow-panel)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
                )}
              >
                {page}
              </button>
            ),
          )}
        </div>

        <span className="min-w-16 text-center text-xs font-semibold tabular-nums sm:hidden">
          {currentPage} / {pageCount}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
          disabled={currentPage === pageCount}
          className="btn btn-ghost min-h-10 min-w-10 px-2 disabled:opacity-40"
          aria-label="Page suivante"
        >
          <span className="hidden sm:inline">Suivant</span>
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}
