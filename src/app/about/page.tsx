import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MethodologyTabs } from "@/features/methodology/methodology-tabs";
import { SourceInventory } from "@/features/methodology/source-inventory";
import { WorkflowDiagram } from "@/features/methodology/workflow-diagram";
import { methodology, methodologySources, methodologyStages } from "@/lib/methodology";
import { atlasRelease } from "@/lib/data";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const disclosureClass = "group scroll-mt-36 border-t py-4 sm:py-5";
const summaryClass = "cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4";

export const metadata: Metadata = {
  title: "About Nuclear Atlas",
  description: "How Nuclear Atlas works, who it helps, where its data comes from, and how public evidence is checked.",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  const recordCount = Object.values(atlasRelease.stages).reduce((count, stage) => count + stage.records.length, 0);
  const sourceCutoff = atlasRelease.sourceCutoffUtc
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(atlasRelease.sourceCutoffUtc))
    : "Unknown";
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 py-5 sm:px-6 lg:px-10">
      <header className="mb-3 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">About Nuclear Atlas</h1>
        <p className="text-sm leading-6 text-muted-foreground">The people, sources, and checks behind the atlas.</p>
      </header>
      <MethodologyTabs panels={{
        "how-it-works": <>
          <section id="workflow" aria-labelledby="workflow-title" className="scroll-mt-36 space-y-5">
            <div className="max-w-2xl space-y-2">
              <h2 id="workflow-title" className="text-xl font-semibold">Public sources. Traceable evidence.</h2>
              <p className="text-sm leading-6 text-muted-foreground">Nuclear Atlas turns public nuclear records into a reviewed, dated snapshot of the industry. Follow published records back to their evidence. A separate local archive preserves imported data so the original files can be reproduced.</p>
            </div>
            <WorkflowDiagram />
            <div className="space-y-1 text-sm leading-6">
              <p className="font-medium">Source cutoff: {sourceCutoff} <span className="font-normal text-muted-foreground">· Published snapshot</span></p>
              <p className="text-muted-foreground">Sources update at different speeds. This release does not reflect live changes.</p>
            </div>
            <Button role="link" nativeButton={false} render={<Link href="/" />}>Explore the Atlas<ArrowRight /></Button>
          </section>
          <details id="storage" className={disclosureClass}>
            <summary className={summaryClass}>Storage and downloads</summary>
            <div className="mt-5 space-y-4">
              <h2 className="text-lg font-semibold">Simple storage, reviewed releases</h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Local SQLite keeps imported records and collection history. Original JSON snapshots sit beside it. Google Sheets and the reviewed workbook remain the authoring layer; the website serves static files.</p>
              <p className="text-sm leading-6 text-muted-foreground">Source collection is not yet automatically connected to the local archive. Off-device backups and long-term retention still need decisions.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" role="link" nativeButton={false} render={<a href={`${basePath}/methodology/nuclear-atlas-prd.md`} download />}><Download />Download PRD</Button>
                <Button variant="outline" role="link" nativeButton={false} render={<a href="https://github.com/lucaschatham/nuclear-atlas/blob/main/docs/database-schema.md" target="_blank" rel="noreferrer" />}>Database schema<ExternalLink /></Button>
              </div>
            </div>
          </details>
        </>,
        "who-its-for": <section id="product-contract" aria-labelledby="audience-title" className="scroll-mt-36 space-y-5">
          <div className="max-w-2xl space-y-2">
            <h2 id="audience-title" className="text-xl font-semibold">For people making sense of nuclear developments</h2>
            <p className="text-sm leading-6 text-muted-foreground">Start with a question, find a facility or project, and follow the evidence. These are the needs we aim to support; coverage varies.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {methodology.audiences.map((audience) => (
              <Card key={audience.title}><CardHeader><CardTitle><h3>{audience.title}</h3></CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">{audience.detail}</CardContent></Card>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold">Follow the whole lifecycle</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Explore projects, fuel supply, licensing and construction, operations, spent fuel, waste disposal, and decommissioning. Map and Table use the same filters and open the same evidence record.</p>
            <Button className="mt-4" role="link" nativeButton={false} render={<Link href="/" />}>Explore the Atlas<ArrowRight /></Button>
          </div>
        </section>,
        "data-sources": <section aria-labelledby="sources-title" className="space-y-4">
          <div className="max-w-3xl space-y-2">
            <h2 id="sources-title" className="text-xl font-semibold">Where the data comes from</h2>
            <p className="text-sm leading-6 text-muted-foreground">Browse {methodologySources.length} registered source families, including regulators, government datasets, and company filings. Registered does not mean connected. Collection states describe configured access, not a guarantee of current data.</p>
          </div>
          <SourceInventory sources={methodologySources} standalone />
          <Button variant="outline" role="link" nativeButton={false} render={<a href={`${basePath}/data/source-registry.json`} download />}><Download />Download source registry</Button>
        </section>,
        "fact-checks": <section id="evidence-rules" aria-labelledby="rules-title" className="scroll-mt-36 space-y-5">
          <div className="max-w-2xl space-y-2">
            <h2 id="rules-title" className="text-xl font-semibold">How we check facts</h2>
            <p className="text-sm leading-6 text-muted-foreground">A citation is a starting point. We check what it supports, when it applies, and which facility it describes.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {methodology.rules.map((rule) => (
              <Card key={rule.title}><CardHeader><CardTitle><h3>{rule.title}</h3></CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">{rule.detail}</CardContent></Card>
            ))}
          </div>
          <details className={disclosureClass}>
            <summary className={summaryClass}>How we label project commitments</summary>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">These labels describe contractual support. They are not safety ratings or predictions of success.</p>
            <dl className="mt-3 divide-y">{methodology.rubric.map(([tier, definition]) => (
              <div key={tier} className="grid grid-cols-[3rem_1fr] gap-3 py-3"><dt><Badge variant="secondary">{tier}</Badge></dt><dd className="text-sm leading-6 text-muted-foreground">{definition}</dd></div>
            ))}</dl>
          </details>
          <Button variant="outline" role="link" nativeButton={false} render={<a href="https://github.com/lucaschatham/nuclear-atlas/issues" target="_blank" rel="noreferrer" />}>Suggest a correction<ExternalLink /></Button>
          <p className="text-xs text-muted-foreground">Include the record, the claim to correct, and an original source.</p>
        </section>,
        coverage: <section aria-labelledby="coverage-title" className="space-y-5">
          <div className="max-w-3xl space-y-2">
            <h2 id="coverage-title" className="text-xl font-semibold">What’s covered and what’s missing</h2>
            <p className="text-sm leading-6 text-muted-foreground">This release contains {recordCount} records across seven lifecycle stages. Coverage is primarily U.S. and uneven. Counts describe this snapshot, not the entire industry.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{methodologyStages.map((stage) => (
            <Card key={stage.id} size="sm"><CardHeader><CardDescription>{atlasRelease.stages[stage.id]?.recordCount ?? 0} published records</CardDescription><CardTitle><h3>{stage.label}</h3></CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">{stage.next}</CardContent></Card>
          ))}</div>
          <Alert><ShieldCheck /><AlertTitle>Missing information is not zero</AlertTitle><AlertDescription>An absent record does not establish that a facility does not exist. Approximate markers show areas, not verified site coordinates. Private prices, spare capacity, and security-sensitive details are not inferred.</AlertDescription></Alert>
          <details className={disclosureClass}><summary className={summaryClass}>What this tool does not claim</summary><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">{methodology.nonGoals.map((goal) => <li key={goal}>{goal}</li>)}</ul></details>
        </section>,
      }} />
      <footer className="mt-8 border-t pt-4 text-xs leading-5 text-muted-foreground">Public evidence, with source-specific reuse terms. Atlas-authored code and data use the MIT License.</footer>
    </main>
  );
}
