"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  Database,
  ExternalLink,
  Layers3,
  MapPin,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type { AtlasPoint } from "@/components/atlas-map";
import type { SourceDashboardItem } from "@/components/source-dashboard";
import type { AtlasLocation, Deal } from "@/lib/types";
import { cn } from "@/lib/utils";

// Browser-only renderer: maplibre-gl.
const AtlasMap = dynamic(() => import("@/components/atlas-map").then((module) => module.AtlasMap), {
  ssr: false,
  loading: () => <div className="h-full min-h-[460px] animate-pulse bg-[#08110f]" aria-label="Loading globe" />,
});

const lifecycle = [
  "Projects",
  "Fuel Supply",
  "Build & License",
  "Operations",
  "Spent Fuel",
  "Waste & Disposal",
  "Decommissioning",
] as const;

type LifecycleStage = (typeof lifecycle)[number];
type Persona = keyof typeof personaConfig;

const personaConfig = {
  "All evidence": {
    stage: "Projects",
    questions: ["Where is activity concentrated?", "Which commitments are binding?", "What changed recently?"],
  },
  Developer: {
    stage: "Build & License",
    questions: ["Where can a project get licensed?", "Which sites have grid access?", "Where are schedules slipping?"],
  },
  "Energy buyer": {
    stage: "Projects",
    questions: ["Which projects can deliver power?", "How binding is each commitment?", "When could power arrive?"],
  },
  "Fuel procurement": {
    stage: "Fuel Supply",
    questions: ["Where can fuel come from?", "Which reactors need which fuel?", "Where can spent fuel go?"],
  },
  "Grid planner": {
    stage: "Operations",
    questions: ["Where is firm capacity available?", "Which queues constrain delivery?", "What outages affect supply?"],
  },
  Supplier: {
    stage: "Build & License",
    questions: ["Where is demand emerging?", "Which technologies need capacity?", "When will procurement start?"],
  },
  Regulator: {
    stage: "Build & License",
    questions: ["Which applications need action?", "Where are safety events occurring?", "Which records conflict?"],
  },
  "Capital provider": {
    stage: "Projects",
    questions: ["Which projects have real counterparties?", "What funding is committed?", "Which milestones reduce risk?"],
  },
  Community: {
    stage: "Spent Fuel",
    questions: ["What facilities are near me?", "What waste remains onsite?", "Which decisions are open for comment?"],
  },
} as const satisfies Record<string, { stage: LifecycleStage; questions: readonly [string, string, string] }>;

const technologyLabels: Record<Deal["technology"], string> = {
  smr: "Small modular reactor",
  large_lwr: "Large light-water reactor",
  restart: "Restart",
  uprate: "Uprate",
  existing_plant_ppa: "Existing plant power agreement",
  multiple: "Multiple technologies",
  other: "Other",
};

const bindingDescriptions: Record<string, string> = {
  B0: "Exploratory statement",
  B1: "Non-binding collaboration",
  B2: "Development commitment",
  B3: "Commercial agreement",
  B4: "Binding project contract",
  B5: "Operating delivery",
  BX: "Insufficient public evidence",
};

type Props = {
  deals: Deal[];
  locations: AtlasLocation[];
  sources: SourceDashboardItem[];
};

function formatCapacity(value: number | null) {
  return value == null ? "Not disclosed" : `${value.toLocaleString()} MW`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
}

export function NuclearAtlas({ deals, locations, sources }: Props) {
  const points = React.useMemo<AtlasPoint[]>(() => locations.map((location) => ({
    ...location,
    deal: deals.find((deal) => deal.id === location.deal_id)!,
  })).filter((point) => Boolean(point.deal)), [deals, locations]);

  const [stage, setStage] = React.useState<LifecycleStage>("Projects");
  const [persona, setPersona] = React.useState<Persona>("All evidence");
  const [query, setQuery] = React.useState("");
  const [technology, setTechnology] = React.useState("all");
  const [binding, setBinding] = React.useState("all");
  const [precision, setPrecision] = React.useState<"all" | "site" | "approximate">("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [viewRevision, setViewRevision] = React.useState(0);
  const [resetWorldRevision, setResetWorldRevision] = React.useState(0);
  const [layersOpen, setLayersOpen] = React.useState(true);
  const [inspectorOpen, setInspectorOpen] = React.useState(true);
  const [sourceView, setSourceView] = React.useState(false);

  const availableTechnologies = React.useMemo(() => Array.from(new Set(deals.map((deal) => deal.technology))), [deals]);
  const filteredPoints = React.useMemo(() => {
    if (stage !== "Projects") return [];
    const term = query.trim().toLowerCase();
    return points.filter((point) => {
      const searchable = `${point.deal.name} ${point.display_label} ${point.deal.parties.offtaker} ${point.deal.parties.developer ?? ""}`.toLowerCase();
      return (!term || searchable.includes(term))
        && (technology === "all" || point.deal.technology === technology)
        && (binding === "all" || point.deal.bindingness.tier === binding)
        && (precision === "all" || (precision === "site" ? point.precision === "site" : point.precision !== "site"));
    });
  }, [binding, points, precision, query, stage, technology]);

  const selected = points.find((point) => point.deal_id === selectedId) ?? null;
  const automatedSources = sources.filter((source) => source.operationalState === "approved_automated");
  const healthySources = automatedSources.filter((source) => source.healthy).length;
  const activeFilters = [query, technology !== "all", binding !== "all", precision !== "all"].filter(Boolean).length;

  function changeView(action: () => void) {
    action();
    setSelectedId(null);
    setSourceView(false);
    setViewRevision((value) => value + 1);
  }

  function selectPersona(value: Persona) {
    setPersona(value);
    changeView(() => setStage(personaConfig[value].stage));
  }

  function clearFilters() {
    changeView(() => {
      setQuery("");
      setTechnology("all");
      setBinding("all");
      setPrecision("all");
    });
  }

  return (
    <section aria-labelledby="atlas-title" className="bg-[#0c110e] text-[#edf1e8]">
      <header className="border-b border-white/10 px-4 py-5 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d9ff68]">Global public evidence atlas</p>
            <h1 id="atlas-title" className="mt-1 font-heading text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Follow nuclear projects from fuel to decommissioning.</h1>
            <p className="mt-1 text-sm text-white/60">Every marker states its source and location precision. Missing coverage stays visible.</p>
          </div>
          <button
            type="button"
            onClick={() => { setSourceView(true); setInspectorOpen(true); setSelectedId(null); }}
            className="flex min-h-11 items-center gap-3 self-start border border-white/15 bg-white/[0.04] px-3 text-left hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9ff68] xl:self-auto"
          >
            <Database className="size-4 text-[#d9ff68]" />
            <span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">Data sources</span>
              <span className="block text-xs font-semibold">{sources.length} registered · {healthySources}/{automatedSources.length} daily checks healthy</span>
            </span>
            <ChevronRight className="ml-2 size-4 text-white/40" />
          </button>
        </div>
      </header>

      <nav aria-label="Nuclear lifecycle" className="overflow-x-auto border-b border-white/10 bg-[#101713] px-2 sm:px-6 lg:px-10">
        <div className="mx-auto flex min-w-max max-w-[1800px]">
          {lifecycle.map((item, index) => (
            <button
              key={item}
              type="button"
              onClick={() => changeView(() => setStage(item))}
              aria-current={stage === item ? "page" : undefined}
              className={cn(
                "group relative min-h-12 border-r border-white/10 px-3 text-left text-xs font-semibold transition-colors sm:px-5",
                index === 0 && "border-l",
                stage === item ? "bg-[#d9ff68] text-[#11150f]" : "text-white/62 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              <span className={cn("mr-2 font-mono text-[9px]", stage === item ? "text-black/45" : "text-white/25")}>{String(index + 1).padStart(2, "0")}</span>
              {item}
            </button>
          ))}
        </div>
      </nav>

      <div className="border-b border-white/10 bg-[#0e1511] px-4 py-3 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1 xl:max-w-sm">
            <span className="sr-only">Search projects, places, or organizations</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(event) => changeView(() => setQuery(event.target.value))}
              placeholder="Search projects, places, organizations"
              className="min-h-11 w-full border border-white/15 bg-black/20 pl-10 pr-9 text-sm placeholder:text-white/32 focus:border-[#d9ff68] focus:outline-none"
            />
            {query && <button type="button" aria-label="Clear search" onClick={() => changeView(() => setQuery(""))} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-white/50 hover:text-white"><X className="size-4" /></button>}
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <span className="sr-only">View as persona</span>
              <select value={persona} onChange={(event) => selectPersona(event.target.value as Persona)} className="min-h-11 appearance-none border border-white/15 bg-[#151d18] pl-3 pr-9 text-xs font-semibold focus:border-[#d9ff68] focus:outline-none">
                {Object.keys(personaConfig).map((value) => <option key={value} value={value}>View as: {value}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-white/50" />
            </label>
            <label className="relative">
              <span className="sr-only">Technology</span>
              <select value={technology} onChange={(event) => changeView(() => setTechnology(event.target.value))} className="min-h-11 appearance-none border border-white/15 bg-[#151d18] pl-3 pr-9 text-xs focus:border-[#d9ff68] focus:outline-none">
                <option value="all">All technologies</option>
                {availableTechnologies.map((value) => <option key={value} value={value}>{technologyLabels[value]}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-white/50" />
            </label>
            <label className="relative">
              <span className="sr-only">Evidence strength</span>
              <select value={binding} onChange={(event) => changeView(() => setBinding(event.target.value))} className="min-h-11 appearance-none border border-white/15 bg-[#151d18] pl-3 pr-9 text-xs focus:border-[#d9ff68] focus:outline-none">
                <option value="all">All evidence strengths</option>
                {["B0", "B1", "B2", "B3", "B4", "B5", "BX"].map((value) => <option key={value} value={value}>{value} · {bindingDescriptions[value]}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-white/50" />
            </label>
            <button type="button" onClick={() => setResetWorldRevision((value) => value + 1)} className="min-h-11 border border-white/15 px-3 text-xs text-white/65 hover:text-white">Reset world</button>
            {activeFilters > 0 && <button type="button" onClick={clearFilters} className="min-h-11 border border-white/15 px-3 text-xs text-white/65 hover:text-white">Clear {activeFilters}</button>}
          </div>
        </div>
      </div>

      <div className="border-b border-white/10 bg-[#0b100d] px-4 py-2 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1800px] gap-2 overflow-x-auto pb-1">
          {personaConfig[persona].questions.map((question) => (
            <button key={question} type="button" onClick={() => setInspectorOpen(true)} className="min-h-10 shrink-0 border border-white/10 px-3 text-[11px] text-white/55 hover:border-white/25 hover:text-white">{question}</button>
          ))}
        </div>
      </div>

      <div className={cn("mx-auto grid min-h-[660px] max-w-[1800px]", inspectorOpen ? "lg:grid-cols-[220px_minmax(0,1fr)_360px]" : "lg:grid-cols-[220px_minmax(0,1fr)]")}>
        <aside className="order-2 border-b border-white/10 bg-[#101713] lg:order-none lg:border-b-0 lg:border-r" aria-label="Map layers">
          <button type="button" onClick={() => setLayersOpen((value) => !value)} className="flex min-h-12 w-full items-center justify-between px-4 text-left lg:pointer-events-none">
            <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"><Layers3 className="size-4 text-[#d9ff68]" /> Map layers</span>
            <ChevronDown className={cn("size-4 transition-transform lg:hidden", !layersOpen && "-rotate-90")} />
          </button>
          {layersOpen && (
            <div className="grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3 lg:block">
              <button type="button" className="flex min-h-12 w-full items-center justify-between bg-[#151d18] px-4 text-left text-xs">
                <span className="flex items-center gap-2"><CircleDot className="size-3.5 text-[#d9ff68]" /> Project evidence</span><span className="font-mono text-[10px] text-white/40">{filteredPoints.length}</span>
              </button>
              <button type="button" onClick={() => setPrecision(precision === "site" ? "all" : "site")} aria-pressed={precision === "site"} className={cn("flex min-h-12 w-full items-center justify-between bg-[#151d18] px-4 text-left text-xs hover:bg-[#1c271f]", precision === "site" && "text-[#d9ff68]") }>
                <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#d9ff68]" /> Exact sites</span><span className="font-mono text-[10px] text-white/40">{points.filter((point) => point.precision === "site").length}</span>
              </button>
              <button type="button" onClick={() => setPrecision(precision === "approximate" ? "all" : "approximate")} aria-pressed={precision === "approximate"} className={cn("flex min-h-12 w-full items-center justify-between bg-[#151d18] px-4 text-left text-xs hover:bg-[#1c271f]", precision === "approximate" && "text-[#ffb15a]") }>
                <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#ffb15a] opacity-80" /> Approximate</span><span className="font-mono text-[10px] text-white/40">{points.filter((point) => point.precision !== "site").length}</span>
              </button>
            </div>
          )}
          <div className="hidden border-t border-white/10 p-4 lg:block">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">Location rule</p>
            <p className="mt-2 text-xs leading-5 text-white/50">Orange markers show an area, never an invented site. Open any record to see its precision.</p>
          </div>
        </aside>

        <div className="relative order-1 min-w-0 lg:order-none">
          <AtlasMap points={filteredPoints} selectedId={selectedId} viewRevision={viewRevision} resetWorldRevision={resetWorldRevision} onSelect={(id) => { setSelectedId(id); setSourceView(false); setInspectorOpen(true); }} />
          {stage !== "Projects" && (
            <div className="absolute inset-x-4 bottom-4 border border-[#ffb15a]/40 bg-[#151713]/95 p-4 shadow-2xl backdrop-blur sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb15a]">Coverage gap, not a known zero</p>
              <p className="mt-2 text-sm text-white/75">{stage} sources are registered, but this release does not yet publish verified site-level records for this layer.</p>
              <button type="button" onClick={() => { setSourceView(true); setInspectorOpen(true); }} className="mt-3 min-h-10 border border-white/15 px-3 text-xs font-semibold hover:bg-white/[0.06]">Inspect relevant sources</button>
            </div>
          )}
          {stage === "Projects" && filteredPoints.length === 0 && (
            <div className="absolute inset-x-4 bottom-4 border border-[#ffb15a]/40 bg-[#151713]/95 p-4 shadow-2xl backdrop-blur sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb15a]">Coverage gap, not a known zero</p>
              <p className="mt-2 text-sm text-white/75">No published record matches these filters. The atlas has not concluded that no project exists.</p>
              <button type="button" onClick={clearFilters} className="mt-3 min-h-10 border border-white/15 px-3 text-xs font-semibold hover:bg-white/[0.06]">Clear filters</button>
            </div>
          )}
          {!inspectorOpen && <button type="button" onClick={() => setInspectorOpen(true)} className="absolute right-3 top-16 z-10 min-h-11 border border-white/20 bg-[#101713]/95 px-3 text-xs font-semibold shadow-lg">Open details</button>}
        </div>

        {inspectorOpen && (
          <aside className="order-3 border-t border-white/10 bg-[#121915] lg:order-none lg:border-l lg:border-t-0" aria-label="Evidence details">
            <div className="flex min-h-12 items-center justify-between border-b border-white/10 px-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">{sourceView ? "Source registry" : selected ? "Evidence record" : "Atlas guide"}</p>
              <button type="button" onClick={() => setInspectorOpen(false)} aria-label="Close details" className="grid size-10 place-items-center text-white/45 hover:text-white"><X className="size-4" /></button>
            </div>
            <div className="max-h-[660px] overflow-y-auto p-4 lg:h-[660px]">
              {sourceView ? (
                <SourceInspector sources={sources} stage={stage} />
              ) : selected ? (
                <DealInspector point={selected} />
              ) : (
                <GuideInspector stage={stage} count={filteredPoints.length} persona={persona} onSources={() => setSourceView(true)} />
              )}
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}

function GuideInspector({ stage, count, persona, onSources }: { stage: LifecycleStage; count: number; persona: Persona; onSources: () => void }) {
  return (
    <div>
      <p className="font-heading text-2xl font-semibold">{stage}</p>
      <p className="mt-2 text-sm leading-6 text-white/58">Showing the public evidence currently supported by this release. Select a marker to audit the underlying claim.</p>
      <dl className="mt-6 grid grid-cols-2 border-y border-white/10">
        <div className="border-r border-white/10 py-4"><dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">Visible records</dt><dd className="mt-1 font-heading text-3xl">{count}</dd></div>
        <div className="py-4 pl-4"><dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">View as</dt><dd className="mt-2 text-sm font-semibold">{persona}</dd></div>
      </dl>
      <div className="mt-6 space-y-4 text-sm text-white/65">
        <p className="flex gap-3"><span className="mt-1 size-2.5 shrink-0 rounded-full bg-[#d9ff68]" /><span><strong className="block text-white">Exact site</strong>The public record names a facility or project site.</span></p>
        <p className="flex gap-3"><span className="mt-1 size-2.5 shrink-0 rounded-full bg-[#ffb15a]" /><span><strong className="block text-white">Approximate area</strong>The marker identifies only a county, state, region, or country.</span></p>
      </div>
      <button type="button" onClick={onSources} className="mt-6 flex min-h-11 w-full items-center justify-between border border-white/15 px-3 text-xs font-semibold hover:bg-white/[0.05]"><span className="flex items-center gap-2"><Database className="size-4 text-[#d9ff68]" /> Browse data sources</span><ChevronRight className="size-4" /></button>
    </div>
  );
}

function DealInspector({ point }: { point: AtlasPoint }) {
  const { deal } = point;
  return (
    <article>
      <span className={cn("inline-flex items-center gap-2 border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em]", point.precision === "site" ? "border-[#d9ff68]/35 text-[#d9ff68]" : "border-[#ffb15a]/40 text-[#ffb15a]")}><MapPin className="size-3" /> {point.precision} precision</span>
      <h2 className="mt-4 font-heading text-2xl font-semibold leading-tight">{deal.name}</h2>
      <p className="mt-2 text-sm text-white/62">{point.display_label}</p>
      <p className="mt-3 border-l-2 border-[#ffb15a]/55 pl-3 text-xs leading-5 text-white/48">{point.coordinate_note}</p>
      <dl className="mt-6 divide-y divide-white/10 border-y border-white/10 text-sm">
        <div className="grid grid-cols-2 py-3"><dt className="text-white/42">Evidence strength</dt><dd className="text-right font-semibold">{deal.bindingness.tier} · {bindingDescriptions[deal.bindingness.tier]}</dd></div>
        <div className="grid grid-cols-2 py-3"><dt className="text-white/42">Firm capacity</dt><dd className="text-right font-semibold">{formatCapacity(deal.mw_firm)}</dd></div>
        <div className="grid grid-cols-2 py-3"><dt className="text-white/42">Optioned capacity</dt><dd className="text-right font-semibold">{formatCapacity(deal.mw_optioned)}</dd></div>
        <div className="grid grid-cols-2 py-3"><dt className="text-white/42">Technology</dt><dd className="text-right font-semibold">{technologyLabels[deal.technology]}</dd></div>
        <div className="grid grid-cols-2 py-3"><dt className="text-white/42">Target operation</dt><dd className="text-right font-semibold">{deal.dates.target_cod ?? "Not disclosed"}</dd></div>
        <div className="grid grid-cols-2 py-3"><dt className="text-white/42">Last verified</dt><dd className="text-right font-semibold">{formatDate(deal.last_verified)}</dd></div>
      </dl>
      <div className="mt-6">
        <p className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/38"><ShieldCheck className="size-3.5 text-[#d9ff68]" /> Evidence</p>
        <p className="mt-2 text-sm leading-6 text-white/67">{deal.bindingness.evidence}</p>
        <div className="mt-4 space-y-2">
          {deal.sources.slice(0, 3).map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between border border-white/12 px-3 text-xs hover:border-white/30 hover:bg-white/[0.04]">
              <span className="min-w-0"><span className="block truncate font-semibold">{source.publisher}</span><span className="block truncate text-white/40">{source.date}</span></span><ExternalLink className="ml-3 size-3.5 shrink-0" />
            </a>
          ))}
        </div>
      </div>
      <Link href={`/deal/${deal.id}`} className="mt-5 flex min-h-11 items-center justify-between bg-[#d9ff68] px-3 text-xs font-semibold text-[#11150f] hover:bg-[#e4ff91]">Open full evidence record <ChevronRight className="size-4" /></Link>
    </article>
  );
}

function SourceInspector({ sources, stage }: { sources: SourceDashboardItem[]; stage: LifecycleStage }) {
  const terms = stage === "Projects" ? ["project", "contract", "fund", "award", "offtake"] : stage.toLowerCase().split(/\s+/);
  const ranked = [...sources].sort((a, b) => {
    const score = (source: SourceDashboardItem) => terms.some((term) => `${source.category} ${source.plainEnglish} ${source.claimTypes.join(" ")}`.toLowerCase().includes(term)) ? 1 : 0;
    return score(b) - score(a);
  });
  return (
    <div>
      <p className="font-heading text-2xl font-semibold">What feeds this atlas</p>
      <p className="mt-2 text-sm leading-6 text-white/58">Plain-language source guides. A daily check means we looked for a change. It does not mean the publisher updates daily.</p>
      <div className="mt-5 space-y-3">
        {ranked.map((source) => (
          <a key={source.id} href={source.endpoint} target="_blank" rel="noreferrer" className="block border border-white/12 p-3 hover:border-white/30 hover:bg-white/[0.04]">
            <span className="flex items-start justify-between gap-3"><span className="text-xs font-semibold">{source.name}</span><ExternalLink className="mt-0.5 size-3.5 shrink-0 text-white/40" /></span>
            <span className="mt-2 block text-xs leading-5 text-white/55">{source.plainEnglish}</span>
            <span className="mt-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-white/35"><span className={cn("size-1.5 rounded-full", source.healthy === true ? "bg-emerald-400" : source.healthy === false ? "bg-red-400" : "bg-amber-400")} /> {source.operationalState.replaceAll("_", " ")} · {source.publisher}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
