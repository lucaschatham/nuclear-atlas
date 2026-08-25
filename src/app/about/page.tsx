import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { DownloadButtons } from "@/components/download-buttons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Methodology", description: "Scope, evidence standards, and corrections policy for Nuclear Atlas." };
const rubric = [["B0", "Reported without party confirmation"], ["B1", "Announced intent, memorandum, or nonbinding letter"], ["B2", "Funded development or feasibility work without binding offtake"], ["B3", "Signed power purchase or definitive agreement"], ["B4", "Binding agreement plus physical or regulatory progress"], ["B5", "Operating under the agreement"], ["BX", "Dead, lapsed, or superseded, retained as history"]];

export default function AboutPage() {
  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
    <header className="space-y-4"><Badge variant="outline">Methodology</Badge><h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Evidence first. Unknown stays unknown.</h1><p className="max-w-3xl text-base leading-7 text-muted-foreground">Nuclear Atlas separates public evidence from inference. Every material claim carries a source, date, and stated level of support.</p><DownloadButtons /></header>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card><CardHeader><CardTitle>Inclusion rule</CardTitle><CardDescription>What appears in the Projects stage.</CardDescription></CardHeader><CardContent className="text-sm leading-7 text-muted-foreground">We include publicly announced fission deals between a nuclear power provider and a named large-load buyer or developer. We exclude anonymous counterparties and fusion agreements from the current comparable dataset.</CardContent></Card>
        <Card><CardHeader><CardTitle>Evidence method</CardTitle><CardDescription>How public claims become Atlas records.</CardDescription></CardHeader><CardContent className="text-sm leading-7 text-muted-foreground">Primary records take priority: regulator dockets, government publications, securities filings, and counterparty releases. Discovery sources identify leads but never silently establish a material fact. Firm and optioned capacity remain separate.</CardContent></Card>
        <Alert><AlertTitle>Coverage gaps are not known zeros</AlertTitle><AlertDescription>Missing data never becomes zero, cancelled, approved, safe, or available capacity.</AlertDescription></Alert>
        <Card><CardHeader><CardTitle>Corrections</CardTitle><CardDescription>Challenge a claim with a record we can reproduce.</CardDescription></CardHeader><CardContent><p className="text-sm leading-7 text-muted-foreground">Open a GitHub issue with the record ID, proposed correction, and primary source. Accepted corrections remain visible in the changelog.</p><Button className="mt-4" variant="outline" nativeButton={false} render={<a href="https://github.com/lucaschatham/nuclear-atlas/issues" target="_blank" rel="noreferrer" />}>Open an issue<ExternalLink data-icon="inline-end" /></Button></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Bindingness rubric</CardTitle><CardDescription>Contractual weight is evidence strength, not project quality.</CardDescription></CardHeader><CardContent><dl className="divide-y divide-border">{rubric.map(([tier, definition]) => <div key={tier} className="grid grid-cols-[3rem_1fr] gap-4 py-4"><dt><Badge>{tier}</Badge></dt><dd className="text-sm leading-6 text-muted-foreground">{definition}</dd></div>)}</dl></CardContent></Card>
    </div>
    <footer className="mt-8 grid gap-4 border-t pt-6 text-sm leading-6 text-muted-foreground sm:grid-cols-2"><p><span className="text-foreground">Open data:</span> Code and data are released under the MIT License.</p><p><span className="text-foreground">Disclaimer:</span> Informational only. Published facts may change upstream.</p></footer>
  </main>;
}
