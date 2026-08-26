export const bindingTiers = ["B0", "B1", "B2", "B3", "B4", "B5", "BX"] as const;
export type BindingTier = (typeof bindingTiers)[number];

export type Deal = {
  id: string;
  name: string;
  parties: {
    offtaker: string;
    offtaker_type: "hyperscaler" | "colocation" | "neocloud" | "enterprise" | "utility" | "other";
    developer: string | null;
    technology_vendor: string | null;
    utility: string | null;
    epc: string | null;
  };
  technology: "smr" | "large_lwr" | "restart" | "uprate" | "existing_plant_ppa" | "multiple" | "other";
  mw_firm: number | null;
  mw_optioned: number | null;
  structure_type:
    | "ppa_front_of_meter"
    | "ppa_behind_meter"
    | "restart_ppa"
    | "uprate_ppa"
    | "development_funding"
    | "jv_equity"
    | "energy_rights_option"
    | "master_agreement"
    | "mou_collaboration"
    | "site_development"
    | "other";
  bindingness: { tier: BindingTier; evidence: string };
  dates: {
    announced: string;
    target_cod: string | null;
    status_changes: { date: string; change: string }[];
  };
  location: {
    site: string | null;
    state: string | null;
    country: string | null;
    grid_region: string | null;
  };
  sources: { url: string; publisher: string; title: string; date: string; supports: string }[];
  analyst_note: string;
  needs_verification: boolean;
  last_verified: string;
};

export type ChangelogEntry = {
  date: string;
  deal: string;
  what_changed: string;
  source: string;
};

export type AtlasLocation = {
  deal_id: string;
  latitude: number;
  longitude: number;
  precision: "site" | "county" | "state" | "region" | "country";
  display_label: string;
  coordinate_note: string;
  source_url: string;
};

export type SourceDashboardItem = {
  id: string;
  name: string;
  publisher: string;
  endpoint: string;
  category: string;
  plainEnglish: string;
  operationalState: "candidate" | "probed" | "manual_only" | "approved_automated" | "paused" | "retired";
  claimTypes: string[];
  lastCheckedAt: string | null;
  healthy: boolean | null;
};

export type AtlasRecordCitation = {
  id: string;
  sourceId: string;
  publisher: string;
  sourceName: string;
  url: string;
  locator: string | null;
  supportsFields: string[];
  sourceDateOriginal: string | null;
  sourceDatePrecision: string | null;
  effectiveDate: string | null;
  retrievedAtUtc: string | null;
  reviewStatus: string;
};

export type AtlasReleaseRecord = {
  id: string;
  stage: string;
  name: string;
  status: string | null;
  typeLabel: string | null;
  technology: string | null;
  evidenceStrength: string | null;
  summary: string | null;
  asOf: string | null;
  reviewStatus: string;
  location: {
    latitude: number;
    longitude: number;
    precision: "site" | "county" | "state" | "region" | "country";
    label: string;
    coordinateNote: string;
  } | null;
  sourceIds: string[];
  citations: AtlasRecordCitation[];
  metrics: { label: string; value: string | number; unit: string | null }[];
  details: { label: string; value: string }[];
  href: string | null;
};

export type AtlasReleaseSource = {
  id: string;
  publisher: string;
  name: string;
  authorityClass: string;
  url: string;
  reuseStatus: string;
  geographicScope: string;
  sourceAsOf: string | null;
  retrievedAtUtc: string | null;
  plainEnglish: string | null;
};

export type AtlasRelease = {
  schemaVersion: number;
  releaseId: string;
  reviewStatus: string;
  approvedBy: string | null;
  sourceCutoffUtc: string | null;
  generatedAtUtc: string | null;
  workbookSha256: string;
  canonicalModelSha256: string;
  sourceCount: number;
  sources: AtlasReleaseSource[];
  stages: Record<string, {
    stage: string;
    label: string;
    status: "published" | "coverage_only" | "draft";
    records: AtlasReleaseRecord[];
    recordCount: number;
    sourceIds: string[];
  }>;
};
