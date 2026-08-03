export const structureLabels: Record<string, string> = {
  ppa_front_of_meter: "Front-of-meter PPA",
  ppa_behind_meter: "Behind-the-meter PPA",
  restart_ppa: "Restart PPA",
  uprate_ppa: "Uprate PPA",
  development_funding: "Development funding",
  jv_equity: "JV / equity",
  energy_rights_option: "Energy rights",
  master_agreement: "Master agreement",
  mou_collaboration: "MOU / collaboration",
  site_development: "Site development",
  other: "Other",
};

export const technologyLabels: Record<string, string> = {
  smr: "SMR / advanced",
  large_lwr: "Large LWR",
  restart: "Restart",
  uprate: "Uprate",
  existing_plant_ppa: "Existing plant PPA",
  multiple: "Multiple",
  other: "Other",
};

export const buyerTypeLabels: Record<string, string> = {
  hyperscaler: "Hyperscaler",
  colocation: "Colocation",
  neocloud: "Neocloud",
  enterprise: "Enterprise",
  utility: "Utility",
  other: "Other",
};

export function formatMw(value: number | null) {
  return value === null ? "Not disclosed" : `${value.toLocaleString("en-US")} MW`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function formatGw(value: number) {
  return `${(value / 1000).toFixed(2)} GW`;
}
