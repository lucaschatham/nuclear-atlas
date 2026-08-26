import { ChevronDown, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LifecycleStage } from "@/lib/atlas-workspace";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function DownloadButtons({ compact = false, stage = "projects" }: { compact?: boolean; stage?: LifecycleStage }) {
  const basename = `atlas/${stage}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size={compact ? "lg" : "default"} aria-label="Download" />
        }
      >
        <Download data-icon="inline-start" />
        Download
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<a href={`${basePath}/data/${basename}.csv`} download />}>
          <FileSpreadsheet /> Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={`${basePath}/data/${basename}.json`} download />}>
          <FileJson /> Download JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
