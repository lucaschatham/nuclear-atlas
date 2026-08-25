import { Suspense } from "react";
import { DealExplorer, DealExplorerFallback } from "@/components/deal-explorer";
import { DownloadButtons } from "@/components/download-buttons";
import { SourceDashboard } from "@/components/source-dashboard";
import { dashboardSources, deals, totals } from "@/lib/data";
import { formatGw } from "@/lib/format";

export default function Home() {
  return (
    <main>
      <SourceDashboard sources={dashboardSources} />

      <section aria-labelledby="deal-summary-title" className="border-b border-border bg-card/35">
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">One current dataset</p>
              <h2 id="deal-summary-title" className="mt-2 font-heading text-3xl font-semibold">Nuclear power deals for data centers</h2>
            </div>
            <DownloadButtons />
          </div>
          <dl className="mt-6 grid border-y border-border bg-background/45 sm:grid-cols-3">
            <div className="px-4 py-5 sm:border-r sm:border-border lg:px-6">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Known deals</dt>
              <dd className="mt-2 font-heading text-4xl font-semibold tabular-nums">{deals.length}</dd>
            </div>
            <div className="border-t border-border px-4 py-5 sm:border-r sm:border-t-0 lg:px-6">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Firm capacity</dt>
              <dd className="mt-2 font-heading text-4xl font-semibold tabular-nums">{formatGw(totals.firmMw)}</dd>
              <p className="mt-1 text-xs text-muted-foreground">Contracted or base project capacity</p>
            </div>
            <div className="border-t border-border px-4 py-5 sm:border-t-0 lg:px-6">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Optioned capacity</dt>
              <dd className="mt-2 font-heading text-4xl font-semibold tabular-nums">{formatGw(totals.optionedMw)}</dd>
              <p className="mt-1 text-xs text-muted-foreground">Rights, ceilings, and non-binding plans</p>
            </div>
          </dl>
        </div>
      </section>

      <Suspense fallback={<DealExplorerFallback />}>
        <DealExplorer deals={deals} />
      </Suspense>
    </main>
  );
}
