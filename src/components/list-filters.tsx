"use client";

import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Chip = { value: string; label: string; count: number };

// A search box and optional filter chips that live in the URL, so the server does the
// filtering and any filtered view can be bookmarked or shared.
export function ListFilters({
  placeholder,
  chips,
  chipParam = "risk",
  label = "Search",
}: {
  placeholder: string;
  chips?: Chip[];
  chipParam?: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paramQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(paramQuery);
  const [searching, startSearch] = useTransition();
  const active = params.get(chipParam) ?? "all";

  // The box owns its text while someone types; results for older text can arrive late and must
  // never overwrite it. The one outside change it follows is the search being cleared (the
  // "Clear filters" link).
  const [lastParamQuery, setLastParamQuery] = useState(paramQuery);
  if (paramQuery !== lastParamQuery) {
    setLastParamQuery(paramQuery);
    if (paramQuery === "" && !searching) setQuery("");
  }

  // Filter as you type, without adding a history entry per keystroke.
  useEffect(() => {
    if (query === (params.get("q") ?? "")) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      startSearch(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, params, pathname, router]);

  const chipHref = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(chipParam);
    else next.set(chipParam, value);
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-72">
        {searching ? (
          <LoaderCircleIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          type="search"
          aria-label={label}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-background pr-8 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
      {chips && (
        <div role="group" aria-label="Filter by risk" className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Link
              key={chip.value}
              href={chipHref(chip.value)}
              scroll={false}
              aria-current={active === chip.value ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                active === chip.value ? "border-primary bg-primary/5 font-medium text-foreground" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {chip.label} <span className="text-muted-foreground">({chip.count})</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// "Showing 2 of 6 · Clear" under a filtered list.
export function FilterSummary({ shown, total, clearHref }: { shown: number; total: number; clearHref: string }) {
  if (shown === total) return null;
  return (
    <p className="text-sm text-muted-foreground">
      Showing {shown} of {total} ·{" "}
      <Link href={clearHref} className="underline underline-offset-2 hover:text-foreground">
        Clear filters
      </Link>
    </p>
  );
}
