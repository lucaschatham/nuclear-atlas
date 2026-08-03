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
