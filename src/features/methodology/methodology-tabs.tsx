"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const sections = [
  ["how-it-works", "How It Works"],
  ["who-its-for", "Who It’s For"],
  ["data-sources", "Sources"],
  ["fact-checks", "Fact Checks"],
  ["coverage", "Coverage"],
] as const;

type Section = (typeof sections)[number][0];
const aliases: Record<string, Section> = {
  workflow: "how-it-works",
  storage: "how-it-works",
  "source-inventory": "data-sources",
  "product-contract": "who-its-for",
  "evidence-rules": "fact-checks",
};

export function MethodologyTabs({ panels }: { panels: Record<Section, ReactNode> }) {
  const [active, setActive] = useState<Section>("how-it-works");
  const [fragment, setFragment] = useState("");
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1);
      const section = sections.find(([id]) => id === hash)?.[0] ?? aliases[hash] ?? "how-it-works";
      setActive(section);
      setFragment(hash);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (!aliases[fragment]) return;
    // The panel must mount before restoring native anchor behavior.
    const target = document.getElementById(fragment);
    if (target instanceof HTMLDetailsElement) target.open = true;
    target?.scrollIntoView({ block: "start" });
  }, [active, fragment]);

  return (
    <Tabs value={active} onValueChange={(value) => {
      const section = sections.find(([id]) => id === value)?.[0];
      if (!section) return;
      setFragment("");
      setActive(section);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${section}`);
    }} className="gap-6">
      <div className="sticky top-14 z-40 -mx-4 border-b bg-background px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <TabsList aria-label="About Nuclear Atlas" variant="line" className="w-full flex-wrap justify-start gap-x-1 gap-y-2 group-data-horizontal/tabs:h-auto">
          {sections.map(([id, label]) => (
            <TabsTrigger key={id} value={id} className="h-11 min-h-11 flex-none px-3 data-active:text-evidence-exact sm:px-4">{label}</TabsTrigger>
          ))}
        </TabsList>
      </div>
      {sections.map(([id]) => (
        <TabsContent key={id} value={id} className="min-w-0 space-y-6">{panels[id]}</TabsContent>
      ))}
    </Tabs>
  );
}
