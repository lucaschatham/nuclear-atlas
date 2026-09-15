import releaseChangelog from "../../../data/release-changelog.json";
import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { changelog, getDeal } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Changelog", description: "Every published change to the Nuclear Atlas dataset." };

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function ChangelogPage() {
  const entries = [...releaseChangelog, ...changelog.map(entry => ({ ...entry, id: entry.deal, title: getDeal(entry.deal)?.name ?? entry.deal, href: `/deal/${entry.deal}` }))].sort((a, b) => b.date.localeCompare(a.date));
  return <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12"><header className="space-y-4"><Badge variant="outline">Dataset history</Badge><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Changelog</h1><p className="max-w-2xl text-base leading-7 text-muted-foreground">Additions, corrections, and superseded claims stay visible.</p></header><Card className="mt-8"><CardHeader><CardTitle>Published changes</CardTitle><CardDescription>{entries.length} published change records.</CardDescription></CardHeader><CardContent><ol className="divide-y divide-border">{entries.map((entry, index) => { return <li key={`${entry.id}-${index}`} className="grid gap-3 py-5 sm:grid-cols-[8rem_1fr]"><time className="font-mono text-xs text-muted-foreground">{formatDate(entry.date)}</time><div><Button role="link" className="h-auto justify-start p-0 text-left" variant="link" nativeButton={false} render={entry.href.startsWith("/?") ? <a href={`${basePath}${entry.href}`} /> : <Link href={entry.href} />}>{entry.title}</Button><p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.what_changed}</p><Button role="link" className="mt-2 px-0" size="sm" variant="link" nativeButton={false} render={<a href={entry.source} target="_blank" rel="noreferrer" />}>Source<ExternalLink data-icon="inline-end" /></Button></div></li>; })}</ol></CardContent></Card></main>;
}
