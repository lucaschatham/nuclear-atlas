import { Suspense } from "react";
import { ArrowDown } from "lucide-react";
import { DealExplorer, DealExplorerFallback } from "@/components/deal-explorer";
import { DownloadButtons } from "@/components/download-buttons";
import { deals, totals } from "@/lib/data";
import { formatGw } from "@/lib/format";

export default function Home() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-border bg-card/35">
        <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-16 sm:px-6 sm:pt-24 lg:px-10 lg:pb-14 lg:pt-28">
          <div className="ledger-in max-w-5xl">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Open data · Fission only · Snapshot 2026-08-03</p>
            <h1 className="mt-6 max-w-4xl font-heading text-5xl font-semibold leading-[0.98] tracking-[-0.035em] sm:text-7xl lg:text-[6.7rem]">
              Everyone announces gigawatts. Which ones will actually sign?
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Every nuclear × data center deal — structure, megawatts, and how binding it really is. Sourced line-by-line. Free, open data.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <DownloadButtons />
              <a href="#deal-ledger" className="inline-flex items-center gap-2 text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-foreground">
                Explore the ledger <ArrowDown className="size-3.5" />
              </a>
            </div>
          </div>

          <dl className="ledger-in mt-16 grid border-y border-border bg-background/45 sm:grid-cols-3" style={{ animationDelay: "120ms" }}>
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
