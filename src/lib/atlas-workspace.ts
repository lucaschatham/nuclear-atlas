import type { AtlasRelease, AtlasReleaseRecord } from "@/lib/types";

export const lifecycleStages = [
  { id: "projects", label: "Projects" },
  { id: "fuel-supply", label: "Fuel Supply" },
  { id: "build-license", label: "Build & License" },
  { id: "operations", label: "Operations" },
  { id: "spent-fuel", label: "Spent Fuel" },
  { id: "waste-disposal", label: "Waste & Disposal" },
  { id: "decommissioning", label: "Decommissioning" },
] as const;

export type LifecycleStage = (typeof lifecycleStages)[number]["id"];
export type AtlasView = "map" | "table";
export type LocationPrecision = NonNullable<AtlasReleaseRecord["location"]>["precision"];
export type InspectorView = "closed" | "guide" | "record" | "sources";
export type MobilePanel = "closed" | "filters" | "layers";

export const ALL_EVIDENCE_LENS = "All evidence";
export const ATLAS_PERSONA_STORAGE_KEY = "nuclear-atlas:persona:v1";

export const personaConfig = {
  [ALL_EVIDENCE_LENS]: { stage: "projects", description: "The complete published project record." },
  Developer: { stage: "build-license", description: "Licensing, siting, grid access, and schedule evidence." },
  "Energy buyer": { stage: "projects", description: "Deliverability, binding commitments, and target dates." },
  "Fuel procurement": { stage: "fuel-supply", description: "Fuel sources, reactor requirements, and spent-fuel pathways." },
  "Grid planner": { stage: "operations", description: "Operating capacity, grid constraints, and outages." },
  Supplier: { stage: "build-license", description: "Emerging demand, technology, and procurement timing." },
  Regulator: { stage: "build-license", description: "Applications, safety records, and evidence conflicts." },
  "Capital provider": { stage: "projects", description: "Counterparties, funding, milestones, and execution risk." },
  Community: { stage: "spent-fuel", description: "Nearby facilities, waste, and public decisions." },
} as const satisfies Record<string, { stage: LifecycleStage; description: string }>;

export type PersonaLens = keyof typeof personaConfig;

export interface AtlasRecord extends Omit<AtlasReleaseRecord, "location"> {
  locationLabel: string;
  locationPrecision: LocationPrecision;
  coordinateNote: string;
  latitude: number;
  longitude: number;
}

export interface AtlasFilters {
  query: string;
  technologies: string[];
  evidenceStrengths: string[];
  statuses: string[];
  locationPrecisions: LocationPrecision[];
  sourceAuthorities: string[];
}

export interface AtlasWorkspaceState {
  view: AtlasView;
  lifecycleStage: LifecycleStage;
  personaLens: PersonaLens;
  filters: AtlasFilters;
  selectedRecordId: string | null;
  inspector: InspectorView;
  mobilePanel: MobilePanel;
  layersCollapsed: boolean;
  inspectorCollapsed: boolean;
  mapResetRevision: number;
}

export type AtlasWorkspaceAction =
  | { type: "set-view"; view: AtlasView }
  | { type: "set-stage"; stage: LifecycleStage }
  | { type: "set-persona"; persona: PersonaLens }
  | { type: "set-query"; query: string }
  | { type: "set-technologies"; technologies: string[] }
  | { type: "set-strengths"; strengths: string[] }
  | { type: "set-statuses"; statuses: string[] }
  | { type: "set-precisions"; precisions: LocationPrecision[] }
  | { type: "select-record"; id: string }
  | { type: "open-inspector"; inspector: Exclude<InspectorView, "closed"> }
  | { type: "close-inspector" }
  | { type: "open-mobile-panel"; panel: Exclude<MobilePanel, "closed"> }
  | { type: "close-mobile-panel" }
  | { type: "toggle-layers" }
  | { type: "toggle-inspector" }
  | { type: "clear-filters" }
  | { type: "reset-map" };

const emptyFilters = (): AtlasFilters => ({
  query: "",
  technologies: [],
  evidenceStrengths: [],
  statuses: [],
  locationPrecisions: [],
  sourceAuthorities: [],
});

export function isPersonaLens(value: string | null | undefined): value is PersonaLens {
  return Boolean(value && Object.hasOwn(personaConfig, value));
}

export function createInitialAtlasState(storedPersona?: string | null): AtlasWorkspaceState {
  const personaLens = isPersonaLens(storedPersona) ? storedPersona : ALL_EVIDENCE_LENS;
  return {
    view: "map",
    lifecycleStage: personaConfig[personaLens].stage,
    personaLens,
    filters: emptyFilters(),
    selectedRecordId: null,
    inspector: "guide",
    mobilePanel: "closed",
    layersCollapsed: false,
    inspectorCollapsed: false,
    mapResetRevision: 0,
  };
}

export function createAtlasRecords(release: AtlasRelease): AtlasRecord[] {
  return lifecycleStages.flatMap(({ id }) => release.stages[id]?.records ?? []).flatMap((record) => {
    if (!record.location) return [];
    return [{
      ...record,
      locationLabel: record.location.label,
      locationPrecision: record.location.precision,
      coordinateNote: record.location.coordinateNote,
      latitude: record.location.latitude,
      longitude: record.location.longitude,
    }];
  });
}

export function filterAtlasRecordsByCriteria(records: AtlasRecord[], lifecycleStage: LifecycleStage, filters: AtlasFilters): AtlasRecord[] {
  const query = filters.query.trim().toLowerCase();
  return records.filter((record) => {
    const searchable = [
      record.name,
      record.locationLabel,
      record.status,
      record.typeLabel,
      record.technology,
      record.summary,
      ...record.details.map((item) => item.value),
    ].filter(Boolean).join(" ").toLowerCase();
    return record.stage === lifecycleStage
      && (!query || searchable.includes(query))
      && (filters.technologies.length === 0 || filters.technologies.includes(record.stage === "projects" ? (record.technology ?? "") : (record.typeLabel ?? "")))
      && (filters.evidenceStrengths.length === 0 || (record.evidenceStrength && filters.evidenceStrengths.includes(record.evidenceStrength)))
      && (filters.statuses.length === 0 || (record.status && filters.statuses.includes(record.status)))
      && (filters.locationPrecisions.length === 0 || filters.locationPrecisions.includes(record.locationPrecision));
  });
}

export function filterAtlasRecords(records: AtlasRecord[], state: AtlasWorkspaceState): AtlasRecord[] {
  return filterAtlasRecordsByCriteria(records, state.lifecycleStage, state.filters);
}

export function atlasRecordSetKey(state: AtlasWorkspaceState): string {
  return JSON.stringify([
    state.lifecycleStage,
    state.filters.query,
    state.filters.technologies,
    state.filters.evidenceStrengths,
    state.filters.statuses,
    state.filters.locationPrecisions,
  ]);
}

export function locationPrecisionsForLayers(exact: boolean, approximate: boolean): LocationPrecision[] | null {
  if (!exact && !approximate) return null;
  if (exact && approximate) return [];
  return exact ? ["site"] : ["county", "state", "region", "country"];
}

function clearSelection(state: AtlasWorkspaceState): AtlasWorkspaceState {
  return { ...state, selectedRecordId: null, inspector: state.inspector === "record" ? "guide" : state.inspector };
}

export function reduceAtlasState(state: AtlasWorkspaceState, action: AtlasWorkspaceAction): AtlasWorkspaceState {
  switch (action.type) {
    case "set-view":
      return { ...state, view: action.view, mobilePanel: "closed" };
    case "set-stage":
      return clearSelection({ ...state, lifecycleStage: action.stage, filters: emptyFilters() });
    case "set-persona":
      return clearSelection({ ...state, personaLens: action.persona, lifecycleStage: personaConfig[action.persona].stage, filters: emptyFilters() });
    case "set-query":
      return clearSelection({ ...state, filters: { ...state.filters, query: action.query } });
    case "set-technologies":
      return clearSelection({ ...state, filters: { ...state.filters, technologies: action.technologies } });
    case "set-strengths":
      return clearSelection({ ...state, filters: { ...state.filters, evidenceStrengths: action.strengths } });
    case "set-statuses":
      return clearSelection({ ...state, filters: { ...state.filters, statuses: action.statuses } });
    case "set-precisions":
      return clearSelection({ ...state, filters: { ...state.filters, locationPrecisions: action.precisions } });
    case "select-record":
      return { ...state, selectedRecordId: action.id, inspector: "record", inspectorCollapsed: false, mobilePanel: "closed" };
    case "open-inspector":
      return { ...state, inspector: action.inspector, inspectorCollapsed: false };
    case "close-inspector":
      return { ...state, inspector: "closed", inspectorCollapsed: true };
    case "open-mobile-panel":
      return { ...state, mobilePanel: action.panel };
    case "close-mobile-panel":
      return { ...state, mobilePanel: "closed" };
    case "toggle-layers":
      return { ...state, layersCollapsed: !state.layersCollapsed };
    case "toggle-inspector":
      return { ...state, inspectorCollapsed: !state.inspectorCollapsed };
    case "clear-filters":
      return clearSelection({ ...state, filters: emptyFilters() });
    case "reset-map":
      return { ...state, mapResetRevision: state.mapResetRevision + 1 };
  }
}

const views = new Set<AtlasView>(["map", "table"]);
const stages = new Set<LifecycleStage>(lifecycleStages.map((stage) => stage.id));
const strengths = new Set(["B0", "B1", "B2", "B3", "B4", "B5", "BX"]);
const precisions = new Set<LocationPrecision>(["site", "county", "state", "region", "country"]);

function parseList<T extends string>(params: URLSearchParams, key: string, allowed: ReadonlySet<T>): T[] {
  const value = params.get(key);
  if (!value) return [];
  return Array.from(new Set(value.split(",").filter((item): item is T => allowed.has(item as T))));
}

function parseLocationPrecisions(params: URLSearchParams): LocationPrecision[] {
  const parsed = parseList(params, "precision", precisions);
  const includesSite = parsed.includes("site");
  const includesApproximate = parsed.some((precision) => precision !== "site");
  if (includesSite && includesApproximate) return [];
  if (includesSite) return ["site"];
  if (includesApproximate) return ["county", "state", "region", "country"];
  return [];
}

export function parseAtlasSearch(search: string, fallback = createInitialAtlasState()): AtlasWorkspaceState {
  const params = new URLSearchParams(search);
  const lens = params.get("lens");
  const stage = params.get("stage") as LifecycleStage | null;
  const view = params.get("view") as AtlasView | null;
  const state: AtlasWorkspaceState = isPersonaLens(lens)
    ? { ...fallback, personaLens: lens, lifecycleStage: personaConfig[lens].stage }
    : fallback;
  const lifecycleStage = stage && stages.has(stage) ? stage : state.lifecycleStage;
  return {
    ...state,
    view: view && views.has(view) ? view : state.view,
    lifecycleStage,
    filters: {
      query: params.get("q") ?? "",
      technologies: params.get("tech")?.split(",").filter(Boolean) ?? [],
      evidenceStrengths: lifecycleStage === "projects" ? parseList(params, "evidence", strengths) : [],
      statuses: lifecycleStage === "projects" ? [] : params.get("status")?.split(",").filter(Boolean) ?? [],
      locationPrecisions: parseLocationPrecisions(params),
      sourceAuthorities: [],
    },
  };
}

export function serializeAtlasSearch(state: AtlasWorkspaceState): string {
  const params = new URLSearchParams();
  if (state.personaLens !== ALL_EVIDENCE_LENS) params.set("lens", state.personaLens);
  if (state.lifecycleStage !== personaConfig[state.personaLens].stage) params.set("stage", state.lifecycleStage);
  if (state.view !== "map") params.set("view", state.view);
  if (state.filters.query) params.set("q", state.filters.query);
  if (state.filters.technologies.length) params.set("tech", state.filters.technologies.join(","));
  if (state.lifecycleStage === "projects" && state.filters.evidenceStrengths.length) params.set("evidence", state.filters.evidenceStrengths.join(","));
  if (state.lifecycleStage !== "projects" && state.filters.statuses.length) params.set("status", state.filters.statuses.join(","));
  if (state.filters.locationPrecisions.length) params.set("precision", state.filters.locationPrecisions.join(","));
  return params.toString();
}
