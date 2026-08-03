import changelogJson from "../../data/changelog.json";
import dealsJson from "../../data/deals.json";
import type { ChangelogEntry, Deal } from "@/lib/types";

export const deals = dealsJson as Deal[];
export const changelog = changelogJson as ChangelogEntry[];

export const getDeal = (id: string) => deals.find((deal) => deal.id === id);

export const totals = deals.reduce(
  (summary, deal) => ({
    firmMw: summary.firmMw + (deal.mw_firm ?? 0),
    optionedMw: summary.optionedMw + (deal.mw_optioned ?? 0),
  }),
  { firmMw: 0, optionedMw: 0 },
);
