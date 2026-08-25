import { AtlasWorkspace } from "@/features/atlas/atlas-workspace";
import { createAtlasRecords } from "@/lib/atlas-workspace";
import { atlasLocations, dashboardSources, deals } from "@/lib/data";

export default function Home() {
  const records = createAtlasRecords(deals, atlasLocations);
  return (
    <main><AtlasWorkspace records={records} sources={dashboardSources} /></main>
  );
}
