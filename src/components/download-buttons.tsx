import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function DownloadButtons({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button render={<a href={`${basePath}/data/deals.csv`} download />} nativeButton={false} variant="outline" size={compact ? "sm" : "default"}>
        <Download className="size-3.5" /> Download CSV
      </Button>
      <Button render={<a href={`${basePath}/data/deals.json`} download />} nativeButton={false} variant="outline" size={compact ? "sm" : "default"}>
        <Download className="size-3.5" /> Download JSON
      </Button>
    </div>
  );
}
