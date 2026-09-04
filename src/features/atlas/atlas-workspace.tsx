"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Filter,
  Layers3,
  List,
  Map as MapIcon,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { EvidenceAlert } from "@/components/atlas-ui/evidence";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DownloadButtons } from "@/components/download-buttons";
import {
  ATLAS_PERSONA_STORAGE_KEY,
  createInitialAtlasState,
  filterAtlasRecordsByCriteria,
  lifecycleStages,
  locationPrecisionsForLayers,
  parseAtlasSearch,
  personaConfig,
  reduceAtlasState,
  serializeAtlasSearch,
  type AtlasRecord,
  type AtlasWorkspaceState,
  type LifecycleStage,
  type LocationPrecision,
  type PersonaLens,
} from "@/lib/atlas-workspace";
import type { AtlasRelease } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AtlasGuide, EvidenceInspector, SourceInspector } from "@/features/atlas/atlas-inspectors";
import { AtlasDataTable } from "@/features/atlas/atlas-table";

const AtlasMap = dynamic(() => import("@/features/atlas/atlas-map").then((module) => module.AtlasMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[32rem] rounded-none" aria-label="Loading globe" />,
});

const projectTechnologyLabels: Record<string, string> = {
  smr: "Small modular reactor",
  large_lwr: "Large light-water reactor",
  restart: "Restart",
  uprate: "Uprate",
  existing_plant_ppa: "Existing plant power agreement",
  multiple: "Multiple technologies",
  other: "Other",
};

const bindingLabels: Record<string, string> = {
  B0: "Exploratory statement",
  B1: "Non-binding collaboration",
  B2: "Development commitment",
  B3: "Commercial agreement",
  B4: "Binding project contract",
  B5: "Operating delivery",
  BX: "Insufficient public evidence",
};

const approximatePrecisions: LocationPrecision[] = ["county", "state", "region", "country"];

type AtlasWorkspaceProps = {
  records: AtlasRecord[];
  release: AtlasRelease;
};

type AtlasDispatch = React.Dispatch<Parameters<typeof reduceAtlasState>[1]>;

function useMediaQuery(query: string) {
  const subscribe = React.useCallback((onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  const getSnapshot = React.useCallback(() => window.matchMedia(query).matches, [query]);
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false);
}

function activeFilterCount(state: AtlasWorkspaceState) {
  return [
    Boolean(state.filters.query),
    state.filters.technologies.length > 0,
    state.filters.evidenceStrengths.length > 0,
    state.filters.statuses.length > 0,
    state.filters.locationPrecisions.length > 0,
  ].filter(Boolean).length;
}

function stageLabel(stage: LifecycleStage) {
  return lifecycleStages.find((item) => item.id === stage)?.label ?? stage;
}

function humanize(value: string) {
  return projectTechnologyLabels[value] ?? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AtlasViewToggle({ state, dispatch, className }: {
  state: AtlasWorkspaceState;
  dispatch: AtlasDispatch;
  className?: string;
}) {
  return (
    <ToggleGroup
      value={[state.view]}
      onValueChange={(value) => value[0] && dispatch({ type: "set-view", view: value[0] as "map" | "table" })}
      variant="outline"
      spacing={0}
      aria-label="Atlas view"
      className={className}
    >
      <ToggleGroupItem value="map" aria-label="Map view"><MapIcon />Map</ToggleGroupItem>
      <ToggleGroupItem value="table" aria-label="Table view"><List />Table</ToggleGroupItem>
    </ToggleGroup>
  );
}

function FilterControls({ state, dispatch, records }: {
  state: AtlasWorkspaceState;
  dispatch: AtlasDispatch;
  records: AtlasRecord[];
}) {
  const projectsStage = state.lifecycleStage === "projects";
  const technologies = React.useMemo(() => Array.from(new Set(records.map((record) => projectsStage ? record.technology : record.typeLabel).filter((value): value is string => Boolean(value)))), [projectsStage, records]);
  const statuses = React.useMemo(() => Array.from(new Set(records.map((record) => record.status).filter((value): value is string => Boolean(value)))), [records]);
  const strengths = React.useMemo(() => Array.from(new Set(records.map((record) => record.evidenceStrength).filter((value): value is string => Boolean(value)))), [records]);
  const selectedTechnology: string = state.filters.technologies.length === 0
    ? "all"
    : state.filters.technologies[0];
  const selectedStrength: string = state.filters.evidenceStrengths.length === 0
    ? "all"
    : state.filters.evidenceStrengths[0];
  const selectedStatus: string = state.filters.statuses.length === 0 ? "all" : state.filters.statuses[0];
  const selectedPrecision = state.filters.locationPrecisions.length === 1 && state.filters.locationPrecisions[0] === "site"
    ? "site"
    : state.filters.locationPrecisions.length > 0
      ? "approximate"
      : "all";

  return (
    <div className="grid items-center gap-2 xl:grid-cols-[minmax(18rem,1fr)_10rem_11rem_12rem_10rem_auto]">
      <InputGroup className="h-9">
        <InputGroupAddon><Search /></InputGroupAddon>
        <InputGroupInput
          value={state.filters.query}
          onChange={(event) => dispatch({ type: "set-query", query: event.target.value })}
          placeholder={`Search ${stageLabel(state.lifecycleStage).toLowerCase()}, places, organizations`}
          aria-label={`Search ${stageLabel(state.lifecycleStage)}, places, or organizations`}
        />
        {state.filters.query && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label="Clear search" onClick={() => dispatch({ type: "set-query", query: "" })}><X /></InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>

      <Select value={state.personaLens} onValueChange={(value) => dispatch({ type: "set-persona", persona: value as PersonaLens })}>
        <SelectTrigger className="h-9 w-full" aria-label="View as persona"><SelectValue /></SelectTrigger>
        <SelectContent align="start">
          {Object.keys(personaConfig).map((persona) => <SelectItem key={persona} value={persona}>View as: {persona}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={selectedTechnology} onValueChange={(value) => {
        const next = value == null ? "all" : String(value);
        dispatch({ type: "set-technologies", technologies: next === "all" ? [] : [next] });
      }}>
        <SelectTrigger className="h-9 w-full" aria-label={projectsStage ? "Technology" : "Record type"}>
          <SelectValue>{selectedTechnology === "all" ? projectsStage ? "All technologies" : "All types" : humanize(selectedTechnology)}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="all">{projectsStage ? "All technologies" : "All types"}</SelectItem>
          {technologies.map((technology) => <SelectItem key={technology} value={technology}>{humanize(technology)}</SelectItem>)}
        </SelectContent>
      </Select>

      {state.lifecycleStage === "projects" ? (
        <Select value={selectedStrength} onValueChange={(value) => {
          const next = value == null ? "all" : String(value);
          dispatch({ type: "set-strengths", strengths: next === "all" ? [] : [next] });
        }}>
          <SelectTrigger className="h-9 w-full" aria-label="Evidence strength">
            <SelectValue>{selectedStrength === "all" ? "All evidence strengths" : selectedStrength}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="all">All evidence strengths</SelectItem>
            {strengths.map((strength) => <SelectItem key={strength} value={strength}>{strength} · {bindingLabels[strength] ?? "Public evidence"}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Select value={selectedStatus} onValueChange={(value) => {
          const next = value == null ? "all" : String(value);
          dispatch({ type: "set-statuses", statuses: next === "all" ? [] : [next] });
        }}>
          <SelectTrigger className="h-9 w-full" aria-label="Status">
            <SelectValue>{selectedStatus === "all" ? "All statuses" : humanize(selectedStatus)}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((status) => <SelectItem key={status} value={status}>{humanize(status)}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Select value={selectedPrecision} onValueChange={(value) => dispatch({
        type: "set-precisions",
        precisions: value === "site" ? ["site"] : value === "approximate" ? approximatePrecisions : [],
      })}>
        <SelectTrigger className="h-9 w-full" aria-label="Location precision">
          <SelectValue>{selectedPrecision === "all" ? "All locations" : selectedPrecision === "site" ? "Exact sites" : "Approximate areas"}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="all">All locations</SelectItem>
          <SelectItem value="site">Exact sites</SelectItem>
          <SelectItem value="approximate">Approximate areas</SelectItem>
        </SelectContent>
      </Select>

      <AtlasViewToggle state={state} dispatch={dispatch} />
    </div>
  );
}

function LayerControls({ state, dispatch, records, visibleCount, stageName }: {
  state: AtlasWorkspaceState;
  dispatch: React.Dispatch<Parameters<typeof reduceAtlasState>[1]>;
  records: AtlasRecord[];
  visibleCount: number;
  stageName: string;
}) {
  const exact = state.filters.locationPrecisions.length === 0 || state.filters.locationPrecisions.includes("site");
  const approximate = state.filters.locationPrecisions.length === 0 || state.filters.locationPrecisions.some((precision) => precision !== "site");
  const exactCount = records.filter((record) => record.locationPrecision === "site").length;
  const approximateCount = records.length - exactCount;

  function setLayer(nextExact: boolean, nextApproximate: boolean) {
    const precisions = locationPrecisionsForLayers(nextExact, nextApproximate);
    if (precisions) dispatch({ type: "set-precisions", precisions });
  }

  return (
    <div className="space-y-1 p-3">
      <div className="flex items-center justify-between rounded-lg px-2 py-2 text-sm">
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary" />{stageName} records</span>
        <span className="font-mono text-xs text-muted-foreground">{visibleCount}</span>
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/60">
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-evidence-exact" />Exact sites <span className="text-xs text-muted-foreground">{exactCount}</span></span>
        <Switch disabled={exact && !approximate} checked={exact} onCheckedChange={(checked) => setLayer(checked, approximate)} aria-label="Show exact sites" />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/60">
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-evidence-approximate" />Approximate <span className="text-xs text-muted-foreground">{approximateCount}</span></span>
        <Switch disabled={approximate && !exact} checked={approximate} onCheckedChange={(checked) => setLayer(exact, checked)} aria-label="Show approximate areas" />
      </label>
      <Separator className="my-3" />
      <p className="px-2 text-xs leading-5 text-muted-foreground">Approximate markers show an area, never an invented site. Open a record to see its location rule.</p>
    </div>
  );
}

export function AtlasWorkspace({ records, release }: AtlasWorkspaceProps) {
  const hydrated = React.useSyncExternalStore(
    React.useCallback(() => () => undefined, []),
    () => true,
    () => false,
  );

  if (!hydrated) {
    return <div className="min-h-[48rem] bg-background"><Skeleton className="h-48 rounded-none" /><Skeleton className="mt-px h-[38rem] rounded-none" /></div>;
  }

  return <HydratedAtlasWorkspace records={records} release={release} />;
}

function HydratedAtlasWorkspace({ records, release }: AtlasWorkspaceProps) {
  const [state, dispatch] = React.useReducer(reduceAtlasState, undefined, () => {
    let storedPersona: string | null = null;
    try {
      storedPersona = window.localStorage.getItem(ATLAS_PERSONA_STORAGE_KEY);
    } catch {
      // Persona persistence is optional. Storage can be disabled by browser policy.
    }
    return parseAtlasSearch(window.location.search, createInitialAtlasState(storedPersona));
  });
  const [mapFailed, setMapFailed] = React.useState<false | "startup" | "resource">(false);
  const [mapAttempt, setMapAttempt] = React.useState(0);
  const desktopPanels = useMediaQuery("(min-width: 1024px)");
  const wideFilters = useMediaQuery("(min-width: 1280px)");
  const serializedSearch = serializeAtlasSearch(state);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(ATLAS_PERSONA_STORAGE_KEY, state.personaLens);
    } catch {
      // Keep the workspace usable when storage is unavailable.
    }
    window.history.replaceState(null, "", serializedSearch ? `${window.location.pathname}?${serializedSearch}` : window.location.pathname);
  }, [serializedSearch, state.personaLens]);

  const visibleRecords = React.useMemo(
    () => filterAtlasRecordsByCriteria(records, state.lifecycleStage, state.filters),
    [records, state.lifecycleStage, state.filters],
  );
  const selectedRecord = records.find((record) => record.id === state.selectedRecordId) ?? null;
  const filtersActive = activeFilterCount(state);
  const currentStageLabel = stageLabel(state.lifecycleStage);

  const inspectorContent = state.inspector === "sources"
    ? <SourceInspector release={release} stage={state.lifecycleStage} />
    : selectedRecord
      ? <EvidenceInspector record={selectedRecord} sources={release.sources} />
      : <AtlasGuide stageLabel={currentStageLabel} count={visibleRecords.length} persona={state.personaLens} onOpenSources={() => dispatch({ type: "open-inspector", inspector: "sources" })} />;

  return (
    <section aria-labelledby="atlas-title" className="bg-background">
      <header className="border-b bg-card/40 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1920px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h1 id="atlas-title" className="text-3xl font-semibold leading-none tracking-tight sm:text-4xl lg:text-[2.75rem]">Nuclear Atlas</h1>
            <p className="mt-2 max-w-5xl text-sm font-medium leading-5 text-foreground/85 sm:text-base">Understand the global nuclear landscape, from fuel supply and new projects to spent fuel and decommissioning.</p>
            <p className="mt-1 max-w-5xl text-xs leading-5 text-muted-foreground sm:text-sm">Built from public evidence. Every record shows its source, date, and location precision. Coverage gaps remain visible.</p>
          </div>
          <ButtonGroup>
            <Button type="button" variant="outline" size="lg" onClick={() => dispatch({ type: "open-inspector", inspector: "sources" })}>
              <Database data-icon="inline-start" />
              <span className="text-left"><span className="block text-xs">{release.sourceCount} snapshot sources</span><span className="block text-[0.6875rem] font-normal text-muted-foreground">{release.reviewStatus === "approved" ? "Released" : "Draft for review"} through {release.sourceCutoffUtc ?? "published cutoff"}</span></span>
            </Button>
            <DownloadButtons compact stage={state.lifecycleStage} />
          </ButtonGroup>
        </div>
      </header>

      <Tabs value={state.lifecycleStage} onValueChange={(value) => dispatch({ type: "set-stage", stage: value as LifecycleStage })} className="gap-0">
        <div className="overflow-x-auto border-b bg-card/25 px-2 py-2 sm:px-6 lg:px-8">
          <TabsList className="h-auto min-w-max gap-1 bg-transparent p-0">
            {lifecycleStages.map((stage, index) => (
              <TabsTrigger
                key={stage.id}
                value={stage.id}
                className="group h-9 flex-none border-border bg-card px-3 shadow-xs hover:bg-muted data-active:border-primary data-active:bg-primary data-active:text-primary-foreground sm:px-4"
              >
                <span className="font-mono text-[0.6875rem] text-muted-foreground group-data-active:text-primary-foreground">{String(index + 1).padStart(2, "0")}</span>
                {stage.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <div className="border-b bg-background px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1920px]">
          {wideFilters ? (
            <FilterControls state={state} dispatch={dispatch} records={records.filter((record) => record.stage === state.lifecycleStage)} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => dispatch({ type: "open-mobile-panel", panel: "filters" })}><Filter /> Filters{filtersActive > 0 ? ` (${filtersActive})` : ""}</Button>
                {!desktopPanels && <Button type="button" variant="outline" onClick={() => dispatch({ type: "open-mobile-panel", panel: "layers" })}><Layers3 /> Layers</Button>}
              </div>
              <div className="flex items-center gap-2">
                {filtersActive > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => dispatch({ type: "clear-filters" })}><RotateCcw /> Clear {filtersActive}</Button>}
                <AtlasViewToggle state={state} dispatch={dispatch} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={cn(
        "mx-auto grid min-h-[36rem] max-w-[1920px] border-x",
        state.layersCollapsed ? "lg:grid-cols-[3rem_minmax(0,1fr)]" : "lg:grid-cols-[15rem_minmax(0,1fr)]",
        !state.inspectorCollapsed && "lg:grid-cols-[15rem_minmax(0,1fr)_22.5rem]",
        state.layersCollapsed && !state.inspectorCollapsed && "lg:grid-cols-[3rem_minmax(0,1fr)_22.5rem]",
      )}>
        <aside className="hidden border-r bg-card/35 lg:block" aria-label="Map layers">
          <div className="flex h-12 items-center justify-between border-b px-3">
            {!state.layersCollapsed && <span className="flex items-center gap-2 text-sm font-medium"><Layers3 className="size-4" />Layers</span>}
            <Tooltip>
              <TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={state.layersCollapsed ? "Open layers" : "Collapse layers"} onClick={() => dispatch({ type: "toggle-layers" })} />}>
                {state.layersCollapsed ? <ChevronRight /> : <ChevronLeft />}
              </TooltipTrigger>
              <TooltipContent>{state.layersCollapsed ? "Open layers" : "Collapse layers"}</TooltipContent>
            </Tooltip>
          </div>
          {!state.layersCollapsed && <LayerControls state={state} dispatch={dispatch} records={records.filter((record) => record.stage === state.lifecycleStage)} visibleCount={visibleRecords.length} stageName={currentStageLabel} />}
        </aside>

        <div className="relative min-w-0 bg-map-water">
          {visibleRecords.length === 0 && (
            <div className="absolute inset-x-4 bottom-4 z-20 mx-auto max-w-xl">
              <EvidenceAlert title="No published records match">Change the filters. This snapshot has not concluded that no {currentStageLabel.toLowerCase()} activity exists.</EvidenceAlert>
            </div>
          )}
          {mapFailed && (
            <Alert variant="destructive" className="absolute inset-x-4 top-4 z-30 mx-auto max-w-xl">
              <MapIcon />
              <AlertTitle>Map tiles are unavailable</AlertTitle>
              <AlertDescription>The same filtered evidence remains available in Table view.</AlertDescription>
              <AlertAction><Button type="button" variant="outline" size="sm" onClick={() => {
                if (mapFailed === "startup") {
                  // MapLibre's shared dispatcher can retain an unresponsive worker.
                  // A new page clears it; URL state preserves the user's filters.
                  const search = serializeAtlasSearch({ ...state, view: "map" });
                  window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
                  window.location.reload();
                  return;
                }
                setMapFailed(false);
                setMapAttempt((value) => value + 1);
                dispatch({ type: "set-view", view: "map" });
              }}>Retry</Button></AlertAction>
            </Alert>
          )}
          {state.view === "map" ? (
            <AtlasMap
              key={mapAttempt}
              records={visibleRecords}
              selectedRecordId={state.selectedRecordId}
              resetRevision={state.mapResetRevision}
              onSelect={(id) => dispatch({ type: "select-record", id })}
              onFailure={(reason) => { setMapFailed(reason); dispatch({ type: "set-view", view: "table" }); }}
            />
          ) : (
            <AtlasDataTable records={visibleRecords} selectedRecordId={state.selectedRecordId} onSelect={(id) => dispatch({ type: "select-record", id })} />
          )}
          {state.inspectorCollapsed && (
            <Button type="button" variant="secondary" size="sm" className="absolute right-3 top-14 z-20 hidden shadow-lg lg:inline-flex" onClick={() => dispatch({ type: "toggle-inspector" })}>
              <PanelRightOpen />Details
            </Button>
          )}
        </div>

        {!state.inspectorCollapsed && (
          <aside className="hidden min-w-0 border-l bg-card/40 lg:block" aria-label="Evidence details">
            <div className="flex h-12 items-center justify-between border-b px-3">
              <span className="text-sm font-medium">{state.inspector === "sources" ? "Data sources" : selectedRecord ? "Evidence record" : "Atlas guide"}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Collapse details" onClick={() => dispatch({ type: "toggle-inspector" })}><PanelRightClose /></Button>
            </div>
            <div className="h-[calc(100%-3rem)]">{inspectorContent}</div>
          </aside>
        )}
      </div>

      <Sheet open={!wideFilters && state.mobilePanel === "filters"} onOpenChange={(open) => !open && dispatch({ type: "close-mobile-panel" })}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto xl:hidden">
          <SheetHeader><SheetTitle>Filter the atlas</SheetTitle><SheetDescription>Every filter applies to both Map and Table views.</SheetDescription></SheetHeader>
          <div className="space-y-4 px-4 pb-6"><FilterControls state={state} dispatch={dispatch} records={records.filter((record) => record.stage === state.lifecycleStage)} /></div>
        </SheetContent>
      </Sheet>

      <Sheet open={!desktopPanels && state.mobilePanel === "layers"} onOpenChange={(open) => !open && dispatch({ type: "close-mobile-panel" })}>
        <SheetContent side="bottom" className="lg:hidden">
          <SheetHeader><SheetTitle>Map layers</SheetTitle><SheetDescription>Control how exact and approximate locations appear.</SheetDescription></SheetHeader>
          <LayerControls state={state} dispatch={dispatch} records={records.filter((record) => record.stage === state.lifecycleStage)} visibleCount={visibleRecords.length} stageName={currentStageLabel} />
        </SheetContent>
      </Sheet>

      <Sheet open={!desktopPanels && (state.inspector === "record" || state.inspector === "sources") && !state.inspectorCollapsed} onOpenChange={(open) => !open && dispatch({ type: "close-inspector" })}>
        <SheetContent side="right" className="w-[min(92vw,26rem)] lg:hidden">
          <SheetHeader><SheetTitle>{state.inspector === "sources" ? "Data sources" : "Evidence record"}</SheetTitle><SheetDescription>{state.inspector === "sources" ? "What each public source can support." : "The public record behind this marker."}</SheetDescription></SheetHeader>
          <div className="min-h-0 flex-1">{inspectorContent}</div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
