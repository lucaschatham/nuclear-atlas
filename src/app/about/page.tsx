import type { Metadata } from "next";
import { DownloadButtons } from "@/components/download-buttons";

export const metadata: Metadata = { title: "Methodology", description: "Bindingness rubric, inclusion rules, sourcing standards, and corrections policy." };

const rubric = [
  ["B0", "Rumored / reported, no party confirmation"],
  ["B1", "Announced intent, MOU, LOI — non-binding"],
  ["B2", "Development agreement / feasibility funding — money moving, no binding offtake"],
  ["B3", "Binding offtake or definitive agreement (signed PPA, energy purchase, funded order)"],
  ["B4", "Binding + physical/regulatory progress (construction, licensing milestone secured)"],
  ["B5", "Operating — electrons flowing under the deal"],
  ["BX", "Dead, lapsed, or superseded (keep the row; the graveyard is data)"],
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-10 lg:py-20">
      <header className="border-b border-border pb-12">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Methods, scope, corrections</p>
        <h1 className="mt-4 max-w-4xl font-heading text-6xl font-semibold leading-none tracking-[-0.03em] sm:text-7xl">Separate announced from binding.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">Every nuclear × large-load deal, its structure, its contractual weight, and what changed, in one free place.</p>
        <div className="mt-8"><DownloadButtons /></div>
      </header>

      <div className="grid gap-14 py-12 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-10">
          <section><h2 className="font-heading text-3xl font-semibold">Inclusion rule</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">We include publicly announced fission deals between a nuclear power provider and a named large-load buyer or developer. Announcements without a named counterparty are excluded. Fusion agreements are excluded from v1 so the technology field stays comparable.</p></section>
          <section><h2 className="font-heading text-3xl font-semibold">Methodology</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">Each material figure points to a source entry that states what it supports. Primary sources take priority: company releases, SEC filings, and regulator dockets. Trade press can identify a lead, but never stands alone behind a number. Firm and optioned capacity remain separate in the data and interface.</p></section>
          <section><h2 className="font-heading text-3xl font-semibold">Corrections</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">Open a GitHub issue with the deal id, the proposed correction, and a primary source. Issues serve as the tip line. Accepted changes enter the public changelog.</p><a className="mt-4 inline-block text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-foreground" href="https://github.com/lucaschatham/nuclear-datacenter-deal-tracker/issues">Open an issue</a></section>
        </div>

        <section aria-labelledby="rubric-heading">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Published verbatim</p>
          <h2 id="rubric-heading" className="mt-3 font-heading text-4xl font-semibold">Bindingness rubric</h2>
          <dl className="mt-6 divide-y divide-border border-y border-border">
            {rubric.map(([tier, definition]) => <div key={tier} className="grid grid-cols-[55px_1fr] gap-4 py-5"><dt className="font-mono text-sm font-semibold">{tier}</dt><dd className="text-sm leading-6">{definition}</dd></div>)}
          </dl>
        </section>
      </div>

      <footer className="grid gap-6 border-t border-border pt-8 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
        <p><span className="text-foreground">Open data:</span> Dataset and code are released under the MIT License. Maintained by Lucas Chatham. Contact through GitHub issues.</p>
        <p><span className="text-foreground">Disclaimer:</span> Informational only, not investment advice. Figures are reported as disclosed by the parties and may change.</p>
      </footer>
    </main>
  );
}
