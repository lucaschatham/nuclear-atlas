export const collectionStateLabels: Record<string, string> = {
  approved_automated: "Automated collection",
  manual_only: "Manual review",
  candidate: "Candidate source",
  probed: "Access tested",
  paused: "Paused",
  retired: "Retired",
};

export interface MethodologySource {
  id: string;
  name: string;
  category: string;
  description: string;
  examples: string[];
  state: string;
  endpoint: string;
  access: string;
  cadence: string;
  geography: string[];
  authority: string;
  notes: string;
  lastCheckUtc: string | null;
}

export function filterMethodologySources(
  sources: MethodologySource[],
  query: string,
  state: string,
) {
  const term = query.trim().toLocaleLowerCase("en-US");
  return sources.filter(
    (source) =>
      (state === "all" || source.state === state) &&
      [source.name, source.category, source.description, ...source.examples]
        .join(" ")
        .toLocaleLowerCase("en-US")
        .includes(term),
  );
}
