import registry from "../../data/credibility/sources.json";
import guide from "../../data/credibility/source-guide.json";
import examples from "../../data/credibility/source-examples.json";
import status from "../../data/credibility/source-status.json";
import content from "../../data/methodology.json";
import { lifecycleStages } from "./atlas-workspace";
import type { MethodologySource } from "./methodology-contract";

export { filterMethodologySources } from "./methodology-contract";
export const methodology = content;
export const methodologyStages = lifecycleStages.map((stage) => ({
  ...stage,
  ...content.stages[stage.id],
}));

export const methodologySources: MethodologySource[] = registry.map(
  (source) => {
    const description = guide.find((entry) => entry.source_id === source.id);
    const sourceExamples = (examples as Record<string, string[]>)[source.id];
    if (!description || !sourceExamples)
      throw new Error(`Missing methodology coverage for ${source.id}`);
    return {
      id: source.id,
      name: source.name,
      category: description.category,
      description: description.plain_english,
      examples: sourceExamples,
      state: source.operational_state,
      endpoint: source.endpoint,
      access: source.access_method,
      cadence: source.expected_cadence.replaceAll("_", " "),
      geography: source.geographic_scope,
      authority: source.authority_class.replaceAll("_", " "),
      notes: source.notes,
      lastCheckUtc:
        status.find((entry) => entry.source_id === source.id)
          ?.last_checked_at ?? null,
    };
  },
);
