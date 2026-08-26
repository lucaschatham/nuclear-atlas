import { AtlasWorkspace } from "@/features/atlas/atlas-workspace";
import { createAtlasRecords } from "@/lib/atlas-workspace";
import { atlasRelease } from "@/lib/data";

export default function Home() {
  const records = createAtlasRecords(atlasRelease);
  return (
    <main><AtlasWorkspace records={records} release={atlasRelease} /></main>
  );
}
