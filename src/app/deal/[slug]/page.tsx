import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, MapPin } from "lucide-react";
import { EvidenceAlert, FreshnessLabel } from "@/components/atlas-ui/evidence";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { deals, getDeal } from "@/lib/data";
import { buyerTypeLabels, formatDate, formatMw, structureLabels, technologyLabels } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return deals.map((deal) => ({ slug: deal.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const deal = getDeal((await params).slug);
  return deal ? { title: deal.name, description: deal.analyst_note } : {};
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1 py-3"><dt className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="text-sm leading-6">{children ?? "Unknown"}</dd></div>;
}

export default async function DealPage({ params }: { params: Promise<{ slug: string }> }) {
  const deal = getDeal((await params).slug);
  if (!deal) notFound();

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <Button variant="ghost" nativeButton={false} render={<Link href="/" />}><ArrowLeft data-icon="inline-start" />Back to atlas</Button>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-center gap-2"><Badge>{deal.bindingness.tier}</Badge><Badge variant="outline">{structureLabels[deal.structure_type]}</Badge>{deal.needs_verification ? <Badge variant="destructive">Needs verification</Badge> : null}</div>
              <CardTitle className="mt-3 max-w-4xl text-2xl sm:text-3xl">{deal.name}</CardTitle>
              <CardDescription className="flex flex-wrap gap-x-5 gap-y-2"><span>Announced {formatDate(deal.dates.announced)}</span><span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{deal.location.site ?? "Location not disclosed"}</span><FreshnessLabel value={deal.last_verified} /></CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-1 md:grid-cols-2">
              <div className="rounded-lg bg-muted/45 p-4"><p className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">Firm capacity</p><p className="mt-2 text-3xl font-semibold">{formatMw(deal.mw_firm)}</p></div>
              <div className="rounded-lg bg-muted/45 p-4"><p className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">Optioned capacity</p><p className="mt-2 text-3xl font-semibold">{formatMw(deal.mw_optioned)}</p></div>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Evidence assessment</CardTitle><CardDescription>What the public record supports, without upgrading incomplete claims.</CardDescription></CardHeader><CardContent className="space-y-4"><EvidenceAlert title={`${deal.bindingness.tier} contractual evidence`}>{deal.bindingness.evidence}</EvidenceAlert><p className="text-sm leading-7 text-muted-foreground">{deal.analyst_note}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Record history</CardTitle><CardDescription>Milestones remain visible when later evidence supersedes them.</CardDescription></CardHeader><CardContent><ol className="space-y-4"><li className="rounded-lg border p-4"><Badge variant="secondary">Announced</Badge><p className="mt-2 text-sm">{formatDate(deal.dates.announced)}</p></li>{deal.dates.status_changes.map((status) => <li key={`${status.date}-${status.change}`} className="rounded-lg border p-4"><Badge variant="outline">Updated</Badge><p className="mt-2 font-mono text-xs text-muted-foreground">{formatDate(status.date)}</p><p className="mt-2 text-sm leading-6">{status.change}</p></li>)}{deal.dates.status_changes.length === 0 ? <li className="text-sm text-muted-foreground">No later public status change is recorded.</li> : null}</ol></CardContent></Card>
          <Card>
            <CardHeader><CardTitle>Primary evidence</CardTitle><CardDescription>Open the cited record and verify the claim at its source.</CardDescription></CardHeader>
            <CardContent className="space-y-4">{deal.sources.map((source, index) => <article key={source.url} className="space-y-3"><div className="flex gap-3"><FileText className="mt-1 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="font-medium">{source.title}</p><p className="mt-1 text-xs text-muted-foreground">{source.publisher} · {formatDate(source.date)}</p><p className="mt-3 text-sm leading-6 text-muted-foreground"><span className="text-foreground">Supports:</span> {source.supports}</p><Button className="mt-3" size="sm" variant="outline" nativeButton={false} render={<a href={source.url} target="_blank" rel="noreferrer" />}>Open source<ExternalLink data-icon="inline-end" /></Button></div></div>{index < deal.sources.length - 1 ? <Separator /> : null}</article>)}</CardContent>
          </Card>
        </div>
        <aside><Card className="xl:sticky xl:top-20"><CardHeader><CardTitle>Record fields</CardTitle><CardDescription>Unknown means the public record does not support a value.</CardDescription></CardHeader><CardContent><dl className="divide-y divide-border"><Field label="Offtaker">{deal.parties.offtaker}</Field><Field label="Offtaker type">{buyerTypeLabels[deal.parties.offtaker_type]}</Field><Field label="Developer">{deal.parties.developer}</Field><Field label="Technology vendor">{deal.parties.technology_vendor}</Field><Field label="Utility">{deal.parties.utility}</Field><Field label="EPC">{deal.parties.epc}</Field><Field label="Technology">{technologyLabels[deal.technology]}</Field><Field label="Target operation">{deal.dates.target_cod}</Field><Field label="State">{deal.location.state}</Field><Field label="Country">{deal.location.country}</Field><Field label="Grid region">{deal.location.grid_region}</Field></dl></CardContent></Card></aside>
      </div>
    </main>
  );
}
