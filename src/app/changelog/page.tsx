import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { changelog, getDeal } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Changelog", description: "Every published change to the open nuclear data center deal dataset." };

export default function ChangelogPage() {
  const entries = [...changelog].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-10 lg:py-20">
      <header className="border-b border-border pb-10">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Dataset history</p>
        <h1 className="mt-4 font-heading text-6xl font-semibold tracking-[-0.03em] sm:text-7xl">Changelog</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">Every addition and correction stays visible. The graveyard and the edit history are both data.</p>
      </header>
      <ol className="divide-y divide-border">
        {entries.map((entry, index) => {
          const deal = getDeal(entry.deal);
          return <li key={`${entry.deal}-${index}`} className="grid gap-3 py-6 sm:grid-cols-[130px_1fr]"><time className="font-mono text-xs text-muted-foreground">{formatDate(entry.date)}</time><div><Link href={`/deal/${entry.deal}`} className="font-medium underline-offset-4 hover:underline">{deal?.name ?? entry.deal}</Link><p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.what_changed}</p><a className="mt-3 inline-flex items-center gap-1.5 text-xs underline decoration-border underline-offset-4 hover:decoration-foreground" href={entry.source} target="_blank" rel="noreferrer">Source <ExternalLink className="size-3" /></a></div></li>;
        })}
      </ol>
    </main>
  );
}
