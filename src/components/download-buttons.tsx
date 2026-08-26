import { ChevronDown, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function DownloadButtons({ compact = false }: { compact?: boolean }) {
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
        <DropdownMenuItem render={<a href={`${basePath}/data/deals.csv`} download />}>
          <FileSpreadsheet /> Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={`${basePath}/data/deals.json`} download />}>
          <FileJson /> Download JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
