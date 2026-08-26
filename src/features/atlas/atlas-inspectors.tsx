"use client";

import Link from "next/link";
import { ArrowUpRight, Database, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { EvidenceBadge, LocationPrecisionBadge, SourceAuthorityBadge } from "@/components/atlas-ui/evidence";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { AtlasRecord, LifecycleStage, PersonaLens } from "@/lib/atlas-workspace";
import type { AtlasRelease } from "@/lib/types";

function formatValue(value: string | number, unit: string | null) {
  const formatted = typeof value === "number" ? value.toLocaleString("en-US") : value;
  return `${formatted}${unit ? ` ${unit}` : ""}`;
}

function humanize(value: string | null) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-48 text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function AtlasGuide({
  stageLabel,
  count,
  persona,
  onOpenSources,
}: {
  stageLabel: string;
  count: number;
  persona: PersonaLens;
  onOpenSources: () => void;
}) {
  return (
    <div className="space-y-6 p-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Atlas guide</div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">{stageLabel}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Select a marker or table row to audit the public evidence behind it.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card size="sm">
          <CardHeader><CardDescription>Visible records</CardDescription><CardTitle className="text-2xl tabular-nums">{count}</CardTitle></CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader><CardDescription>View as</CardDescription><CardTitle>{persona}</CardTitle></CardHeader>
        </Card>
      </div>
      <div className="space-y-4 text-sm">
        <div className="flex gap-3">
          <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-evidence-exact" />
          <div><strong className="block">Exact site</strong><span className="text-muted-foreground">The public record names a facility or project site.</span></div>
        </div>
        <div className="flex gap-3">
          <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-evidence-approximate" />
          <div><strong className="block">Approximate area</strong><span className="text-muted-foreground">The evidence names only a county, state, region, or country.</span></div>
        </div>
      </div>
      <Button type="button" variant="outline" className="w-full justify-between" onClick={onOpenSources}>
        <span className="inline-flex items-center gap-2"><Database /> Browse data sources</span>
        <ArrowUpRight />
      </Button>
    </div>
  );
}

export function EvidenceInspector({ record }: { record: AtlasRecord }) {
  return (
    <ScrollArea className="h-full">
      <article className="space-y-6 p-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <LocationPrecisionBadge precision={record.locationPrecision} />
            {record.evidenceStrength ? <EvidenceBadge strength={record.evidenceStrength} /> : <Badge variant="secondary">{humanize(record.status)}</Badge>}
            {record.reviewStatus !== "approved" && <Badge variant="outline">{humanize(record.reviewStatus)}</Badge>}
          </div>
          <h2 className="mt-4 text-xl font-semibold leading-tight tracking-tight">{record.name}</h2>
          <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" />{record.locationLabel}</p>
          <p className="mt-3 border-l-2 border-evidence-approximate/60 pl-3 text-xs leading-5 text-muted-foreground">{record.coordinateNote}</p>
        </div>

        <dl className="divide-y divide-border border-y">
          {record.metrics.map((metric) => <DetailField key={metric.label} label={metric.label}>{formatValue(metric.value, metric.unit)}</DetailField>)}
          {record.details.map((item) => <DetailField key={item.label} label={item.label}>{item.value}</DetailField>)}
          <DetailField label="Snapshot as of">{record.asOf ?? "Unknown"}</DetailField>
        </dl>

        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"><ShieldCheck className="size-4 text-evidence-exact" />Evidence</div>
          <p className="mt-3 text-sm leading-6 text-foreground/85">{record.summary ?? "This record reproduces the cited public source without inferring missing values."}</p>
          <div className="mt-4 space-y-2">
            {record.citations.map((citation) => (
              <Button
                key={citation.id}
                render={<a href={citation.url} target="_blank" rel="noreferrer" />}
                nativeButton={false}
                variant="outline"
                className="h-auto w-full justify-between py-2 text-left"
              >
                <span className="min-w-0"><span className="block truncate">{citation.publisher}</span><span className="block truncate text-xs font-normal text-muted-foreground">{citation.sourceDateOriginal ?? citation.locator ?? "Source date not stated"}</span></span>
                <ExternalLink />
              </Button>
            ))}
          </div>
        </div>

        {record.href && (
          <Button render={<Link href={record.href} />} nativeButton={false} className="w-full justify-between">
            Open full evidence record
            <ArrowUpRight />
          </Button>
        )}
      </article>
    </ScrollArea>
  );
}

export function SourceInspector({ release, stage }: { release: AtlasRelease; stage: LifecycleStage }) {
  const stageSourceIds = new Set(release.stages[stage]?.sourceIds ?? []);
  const ranked = [...release.sources].sort((a, b) => Number(stageSourceIds.has(b.id)) - Number(stageSourceIds.has(a.id)) || a.publisher.localeCompare(b.publisher));
  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Source registry</div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">What feeds this atlas</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">This is a dated snapshot, not a live feed. Sources shown first support the selected lifecycle stage.</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">Release {release.releaseId} · cutoff {release.sourceCutoffUtc ?? "unknown"}</p>
        </div>
        <Separator className="my-5" />
        <div className="space-y-3">
          {ranked.map((source) => (
            <Card key={source.id} size="sm" className={stageSourceIds.has(source.id) ? "border-primary/50" : undefined}>
              <CardHeader>
                <CardDescription>{source.publisher}</CardDescription>
                <CardTitle>{source.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-5 text-muted-foreground">{source.plainEnglish ?? "Public source metadata retained for this snapshot."}</p>
                <div className="flex items-center justify-between gap-3">
                  <SourceAuthorityBadge authority={source.authorityClass} />
                  <span className="font-mono text-xs text-muted-foreground">As of {source.sourceAsOf ?? "not stated"}</span>
                </div>
                <Button render={<a href={source.url} target="_blank" rel="noreferrer" />} nativeButton={false} variant="outline" size="sm" className="w-full justify-between">
                  Open source
                  <ExternalLink />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
