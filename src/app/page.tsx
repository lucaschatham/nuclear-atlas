import { AtlasWorkspace } from "@/features/atlas/atlas-workspace";
import { createAtlasRecords } from "@/lib/atlas-workspace";
import { atlasRelease } from "@/lib/data";

export default function Home() {
  const records = createAtlasRecords(atlasRelease);
  return (
    <main>
      <AtlasWorkspace records={records} release={atlasRelease} />
      <footer className="border-t bg-background px-4 py-6 text-center sm:px-6">
        <a
          href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/haleu-model.html`}
          className="inline-flex min-h-11 items-center justify-center rounded-md border bg-card px-5 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Explore HALEU core cost &amp; market scale
        </a>
        <p className="mt-2 text-xs text-muted-foreground">Interactive fuel economics calculator · Illustrative assumptions</p>
      </footer>
    </main>
  );
}
