"use client";

import * as React from "react";
import { CheckCircle2, ExternalLink, Radio, SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SourceDashboardItem = {
  id: string;
  name: string;
  publisher: string;
  endpoint: string;
  category: string;
  plainEnglish: string;
  operationalState: "candidate" | "probed" | "manual_only" | "approved_automated" | "paused" | "retired";
  claimTypes: string[];
  lastCheckedAt: string | null;
  healthy: boolean | null;
};

type CoverageFilter = "all" | "live" | "reviewed" | "planned";

const statusConfig = {
  approved_automated: { label: "Checked daily", tone: "live" },
  probed: { label: "Connection tested", tone: "reviewed" },
  manual_only: { label: "Human checked", tone: "reviewed" },
  candidate: { label: "Planned source", tone: "planned" },
  paused: { label: "Paused", tone: "planned" },
  retired: { label: "Retired", tone: "planned" },
} as const;

const claimLabels: Record<string, string> = {
  federal_support: "federal support",
  supply_chain: "supply chain",
  offtake: "power contracts",
};

function statusTone(source: SourceDashboardItem) {
  return statusConfig[source.operationalState].tone;
}

function formatChecked(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function SourceDashboard({ sources }: { sources: SourceDashboardItem[] }) {
  const [filter, setFilter] = React.useState<CoverageFilter>("all");
  const automated = sources.filter((source) => source.operationalState === "approved_automated");
  const healthy = automated.filter((source) => source.healthy).length;
  const latestCheck = automated
    .map((source) => source.lastCheckedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  const visible = sources.filter((source) => filter === "all" || statusTone(source) === filter);
  const categories = Array.from(new Set(visible.map((source) => source.category)));

  return (
    <section aria-labelledby="source-dashboard-title" className="border-b border-border bg-background/88">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <header className="ledger-in max-w-4xl">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Public evidence · U.S. first · Daily checks
          </p>
          <h1 id="source-dashboard-title" className="mt-3 font-heading text-4xl font-semibold tracking-[-0.025em] sm:text-5xl">
            Nuclear data, checked and explained.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            See what public records tell us, how fresh they are, and what remains unknown.
          </p>
        </header>

        <dl className="ledger-in mt-7 grid border-y border-border bg-card/35 sm:grid-cols-2 xl:grid-cols-4" style={{ animationDelay: "80ms" }}>
          <div className="px-4 py-4 sm:border-r sm:border-border">
            <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Sources mapped</dt>
            <dd className="mt-1 font-heading text-3xl font-semibold tabular-nums">{sources.length}</dd>
            <p className="mt-1 text-xs text-muted-foreground">Every source is labeled by readiness.</p>
          </div>
          <div className="border-t border-border px-4 py-4 sm:border-t-0 xl:border-r">
            <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Daily checks</dt>
            <dd className="mt-1 font-heading text-3xl font-semibold tabular-nums">{automated.length}</dd>
            <p className="mt-1 text-xs text-muted-foreground">Automation approved and running.</p>
          </div>
          <div className="border-t border-border px-4 py-4 sm:border-r sm:border-border xl:border-t-0">
            <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Healthy now</dt>
            <dd className="mt-1 flex items-center gap-2 font-heading text-3xl font-semibold tabular-nums">
              {healthy}/{automated.length}
              {healthy === automated.length && <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-label="All daily checks healthy" />}
            </dd>
            <p className="mt-1 text-xs text-muted-foreground">No silent source failures.</p>
          </div>
          <div className="border-t border-border px-4 py-4 xl:border-t-0">
            <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Last checked</dt>
            <dd className="mt-2 text-sm font-medium tabular-nums">{formatChecked(latestCheck) ?? "Not yet checked"}</dd>
            <p className="mt-2 text-xs text-muted-foreground">A check is not the same as a source update.</p>
          </div>
        </dl>

        <div className="mt-8 flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Source map</p>
            <h2 className="mt-2 font-heading text-3xl font-semibold">What each source tells us</h2>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Filter sources by readiness">
            {([
              ["all", "All sources"],
              ["live", "Checked daily"],
              ["reviewed", "Manual or tested"],
              ["planned", "Planned"],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                variant={filter === value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-2">
          {categories.map((category) => {
            const categorySources = visible.filter((source) => source.category === category);
            return (
              <section key={category} aria-labelledby={`source-category-${category.replaceAll(" ", "-").toLowerCase()}`} className="border-b border-border py-6">
                <div className="mb-4 flex items-baseline justify-between gap-4">
                  <h3 id={`source-category-${category.replaceAll(" ", "-").toLowerCase()}`} className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
                    {category}
                  </h3>
                  <span className="font-mono text-[10px] text-muted-foreground">{categorySources.length} sources</span>
                </div>
                <div className="grid gap-x-8 gap-y-1 md:grid-cols-2 xl:grid-cols-3">
                  {categorySources.map((source) => {
                    const config = statusConfig[source.operationalState];
                    const checked = formatChecked(source.lastCheckedAt);
                    return (
                      <article key={source.id} className="group relative border-t border-border/75 py-4 transition-colors hover:border-foreground/55">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] text-muted-foreground">{source.publisher}</p>
                            <h4 className="mt-1 pr-6 text-sm font-semibold leading-5">
                              <a href={source.endpoint} target="_blank" rel="noreferrer" className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-4">
                                {source.name}
                              </a>
                            </h4>
                          </div>
                          <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                        </div>
                        <p className="mt-3 text-sm leading-5 text-foreground/85">{source.plainEnglish}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em]",
                            config.tone === "live" && "border-emerald-700/45 bg-emerald-700/10 text-emerald-700 dark:text-emerald-300",
                            config.tone === "reviewed" && "border-amber-700/40 bg-amber-700/10 text-amber-800 dark:text-amber-300",
                            config.tone === "planned" && "border-border text-muted-foreground",
                          )}>
                            {config.tone === "live" ? <Radio className="size-2.5" /> : <SearchCheck className="size-2.5" />}
                            {source.healthy === false ? "Check failed" : config.label}
                          </span>
                          {checked && <span className="font-mono text-[9px] text-muted-foreground">{checked}</span>}
                        </div>
                        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                          Covers {source.claimTypes.slice(0, 3).map((claim) => claimLabels[claim] ?? claim).join(" · ")}
                          {source.claimTypes.length > 3 ? ` · +${source.claimTypes.length - 3}` : ""}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
