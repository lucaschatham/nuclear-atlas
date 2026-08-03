import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, MapPin } from "lucide-react";
import { BindingBadge, StructureBadge } from "@/components/deal-badges";
import { StatusChange } from "@/components/status-change";
import { deals, getDeal } from "@/lib/data";
import { buyerTypeLabels, formatDate, formatMw, technologyLabels } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return deals.map((deal) => ({ slug: deal.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const deal = getDeal(slug);
  return deal ? { title: deal.name, description: deal.analyst_note } : {};
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="border-t border-border py-4"><dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</dt><dd className="mt-2 text-sm leading-6">{children ?? "Not disclosed"}</dd></div>;
}

export default async function DealPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deal = getDeal(slug);
  if (!deal) notFound();

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        <ArrowLeft className="size-3.5" /> Back to ledger
      </Link>

      <header className="mt-10 border-b border-border pb-10">
        <div className="flex flex-wrap items-center gap-2"><BindingBadge tier={deal.bindingness.tier} /><StructureBadge structure={deal.structure_type} />{deal.needs_verification && <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Needs verification</span>}</div>
        <h1 className="mt-6 max-w-5xl font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-7xl">{deal.name}</h1>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span>Announced {formatDate(deal.dates.announced)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {deal.location.site ?? "Site not disclosed"}</span>
          <span>Last verified {formatDate(deal.last_verified)}</span>
        </div>
      </header>

      <div className="grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-12">
          <section aria-labelledby="contractual-weight">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contractual weight</p>
            <h2 id="contractual-weight" className="mt-3 font-heading text-3xl font-semibold">{deal.bindingness.tier} evidence</h2>
            <p className="mt-5 max-w-3xl border-l-2 border-foreground/60 pl-5 text-lg leading-8">{deal.bindingness.evidence}</p>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-muted-foreground">{deal.analyst_note}</p>
          </section>

          <section aria-labelledby="capacity">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Capacity</p>
            <h2 id="capacity" className="sr-only">Capacity</h2>
            <dl className="mt-4 grid border-y border-border sm:grid-cols-2">
              <div className="p-5 sm:border-r sm:border-border"><dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">MW firm</dt><dd className="mt-2 font-heading text-4xl font-semibold">{formatMw(deal.mw_firm)}</dd></div>
              <div className="border-t border-border p-5 sm:border-t-0"><dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">MW optioned</dt><dd className="mt-2 font-heading text-4xl font-semibold">{formatMw(deal.mw_optioned)}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="timeline">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Record history</p>
            <h2 id="timeline" className="mt-3 font-heading text-3xl font-semibold">Status timeline</h2>
            <ol className="mt-6 border-l border-border pl-6">
              <li className="relative pb-7"><span className="absolute -left-[28.5px] top-1 size-1.5 rounded-full bg-foreground" /><p className="font-mono text-xs text-muted-foreground">{formatDate(deal.dates.announced)}</p><p className="mt-2 text-sm">Deal announced</p></li>
              {deal.dates.status_changes.map((status) => <li key={`${status.date}-${status.change}`} className="relative pb-7"><span className="absolute -left-[28.5px] top-1 size-1.5 rounded-full bg-foreground" /><StatusChange change={status.change} /><p className="mt-2 font-mono text-xs text-muted-foreground">{formatDate(status.date)}</p><p className="mt-2 text-sm leading-6">{status.change}</p></li>)}
              {deal.dates.status_changes.length === 0 && <li className="pb-2 text-sm text-muted-foreground">No later public status change is recorded.</li>}
            </ol>
          </section>

          <section aria-labelledby="sources">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Provenance</p>
            <h2 id="sources" className="mt-3 font-heading text-3xl font-semibold">Sources</h2>
            <div className="mt-6 divide-y divide-border border-y border-border">
              {deal.sources.map((source) => (
                <article key={source.url} className="py-5">
                  <div className="flex items-start gap-3"><FileText className="mt-1 size-4 shrink-0 text-muted-foreground" /><div><a href={source.url} target="_blank" rel="noreferrer" className="font-medium underline decoration-border underline-offset-4 hover:decoration-foreground">{source.title} <ExternalLink className="inline size-3" /></a><p className="mt-1 text-xs text-muted-foreground">{source.publisher} · {formatDate(source.date)}</p><p className="mt-3 text-sm leading-6 text-muted-foreground"><span className="text-foreground">Supports:</span> {source.supports}</p></div></div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside>
          <div className="sticky top-24 border border-border bg-card/70 p-5">
            <h2 className="font-heading text-2xl font-semibold">Record fields</h2>
            <dl className="mt-4">
              <Field label="Offtaker">{deal.parties.offtaker}</Field>
              <Field label="Offtaker type">{buyerTypeLabels[deal.parties.offtaker_type]}</Field>
              <Field label="Developer">{deal.parties.developer}</Field>
              <Field label="Technology vendor">{deal.parties.technology_vendor}</Field>
              <Field label="Utility">{deal.parties.utility}</Field>
              <Field label="EPC">{deal.parties.epc}</Field>
              <Field label="Technology">{technologyLabels[deal.technology]}</Field>
              <Field label="Target COD">{deal.dates.target_cod}</Field>
              <Field label="State">{deal.location.state}</Field>
              <Field label="Country">{deal.location.country}</Field>
              <Field label="Grid region">{deal.location.grid_region}</Field>
            </dl>
          </div>
        </aside>
      </div>
    </main>
  );
}
