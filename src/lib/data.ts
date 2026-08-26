import changelogJson from "../../data/changelog.json";
import dealsJson from "../../data/deals.json";
import atlasLocationsJson from "../../data/atlas-locations.json";
import atlasReleaseJson from "../../data/atlas-release.json";
import sourceGuideJson from "../../data/credibility/source-guide.json";
import sourceStatusJson from "../../data/credibility/source-status.json";
import sourcesJson from "../../data/credibility/sources.json";
import type { AtlasLocation, AtlasRelease, ChangelogEntry, Deal, SourceDashboardItem } from "@/lib/types";

export const deals = dealsJson as Deal[];
export const atlasLocations = atlasLocationsJson as AtlasLocation[];
export const atlasRelease = atlasReleaseJson as AtlasRelease;
export const changelog = changelogJson as ChangelogEntry[];

const sourceGuide = new Map(sourceGuideJson.map((entry) => [entry.source_id, entry]));
const sourceStatus = new Map(sourceStatusJson.map((status) => [status.source_id, status]));

export const dashboardSources = sourcesJson.map((source) => {
  const guide = sourceGuide.get(source.id);
  const status = sourceStatus.get(source.id);
  if (!guide) throw new Error(`Missing plain-language source guide for ${source.id}`);

  return {
    id: source.id,
    name: source.name,
    publisher: source.publisher,
    endpoint: source.endpoint,
    category: guide.category,
    plainEnglish: guide.plain_english,
    operationalState: source.operational_state,
    claimTypes: source.supported_claim_types,
    lastCheckedAt: status?.last_checked_at ?? null,
    healthy: status ? !status.is_stale && status.check_status !== "failed" : null,
  };
}) as SourceDashboardItem[];

export const getDeal = (id: string) => deals.find((deal) => deal.id === id);

export const totals = deals.reduce(
  (summary, deal) => ({
    firmMw: summary.firmMw + (deal.mw_firm ?? 0),
    optionedMw: summary.optionedMw + (deal.mw_optioned ?? 0),
  }),
  { firmMw: 0, optionedMw: 0 },
);
