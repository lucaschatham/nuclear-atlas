"use client";

import Link from "next/link";
import { ArrowUpRight, Database, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { EvidenceBadge, FreshnessLabel, LocationPrecisionBadge, SourceHealth } from "@/components/atlas-ui/evidence";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { AtlasRecord, LifecycleStage, PersonaLens } from "@/lib/atlas-workspace";
import type { SourceDashboardItem } from "@/lib/types";
import { formatMw } from "@/lib/format";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
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
            <EvidenceBadge strength={record.evidenceStrength} />
          </div>
          <h2 className="mt-4 text-xl font-semibold leading-tight tracking-tight">{record.name}</h2>
          <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" />{record.locationLabel}</p>
          <p className="mt-3 border-l-2 border-evidence-approximate/60 pl-3 text-xs leading-5 text-muted-foreground">{record.coordinateNote}</p>
        </div>

        <dl className="divide-y divide-border border-y">
          <DetailField label="Firm capacity">{formatMw(record.firmMw)}</DetailField>
          <DetailField label="Optioned capacity">{formatMw(record.optionedMw)}</DetailField>
          <DetailField label="Target operation">{record.targetOperation ?? "Not disclosed"}</DetailField>
          <DetailField label="Last verified">{formatDate(record.lastVerified)}</DetailField>
        </dl>

        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"><ShieldCheck className="size-4 text-evidence-exact" />Evidence</div>
          <p className="mt-3 text-sm leading-6 text-foreground/85">{record.deal.bindingness.evidence}</p>
          <div className="mt-4 space-y-2">
            {record.deal.sources.slice(0, 3).map((source) => (
              <Button
                key={source.url}
                render={<a href={source.url} target="_blank" rel="noreferrer" />}
                nativeButton={false}
                variant="outline"
                className="h-auto w-full justify-between py-2 text-left"
              >
                <span className="min-w-0"><span className="block truncate">{source.publisher}</span><span className="block truncate text-xs font-normal text-muted-foreground">{source.date}</span></span>
                <ExternalLink />
              </Button>
            ))}
          </div>
        </div>

        <Button render={<Link href={`/deal/${record.id}`} />} nativeButton={false} className="w-full justify-between">
          Open full evidence record
          <ArrowUpRight />
        </Button>
      </article>
    </ScrollArea>
  );
}

function sourceScore(source: SourceDashboardItem, stage: LifecycleStage) {
  const terms = stage === "projects" ? ["project", "contract", "fund", "award", "offtake"] : stage.split("-");
  const haystack = `${source.category} ${source.plainEnglish} ${source.claimTypes.join(" ")}`.toLowerCase();
  return terms.some((term) => haystack.includes(term)) ? 1 : 0;
}

export function SourceInspector({ sources, stage }: { sources: SourceDashboardItem[]; stage: LifecycleStage }) {
  const ranked = [...sources].sort((a, b) => sourceScore(b, stage) - sourceScore(a, stage));
  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Source registry</div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">What feeds this atlas</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">A daily check means we looked for a change. It does not mean the publisher updates daily.</p>
        </div>
        <Separator className="my-5" />
        <div className="space-y-3">
          {ranked.map((source) => (
            <Card key={source.id} size="sm">
              <CardHeader>
                <CardDescription>{source.publisher}</CardDescription>
                <CardTitle>{source.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-5 text-muted-foreground">{source.plainEnglish}</p>
                <div className="flex items-center justify-between gap-3">
                  <SourceHealth source={source} />
                  <FreshnessLabel value={source.lastCheckedAt} />
                </div>
                <Button render={<a href={source.endpoint} target="_blank" rel="noreferrer" />} nativeButton={false} variant="outline" size="sm" className="w-full justify-between">
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
