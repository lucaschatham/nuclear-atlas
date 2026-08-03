import { Badge } from "@/components/ui/badge";
import { structureLabels } from "@/lib/format";
import type { BindingTier, Deal } from "@/lib/types";
import { cn } from "@/lib/utils";

const structureStyles: Record<string, string> = {
  ppa_front_of_meter: "border-blue-500/45 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  ppa_behind_meter: "border-cyan-500/45 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  restart_ppa: "border-violet-500/45 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  uprate_ppa: "border-fuchsia-500/45 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  development_funding: "border-indigo-500/45 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  energy_rights_option: "border-pink-500/45 bg-pink-500/10 text-pink-700 dark:text-pink-300",
  master_agreement: "border-sky-500/45 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

export function BindingBadge({ tier }: { tier: BindingTier }) {
  return (
    <Badge variant="outline" className="min-w-9 justify-center border-foreground/30 bg-background font-mono text-[11px] font-semibold tracking-wide">
      {tier}
    </Badge>
  );
}

export function StructureBadge({ structure }: { structure: Deal["structure_type"] }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-normal", structureStyles[structure] ?? "border-foreground/20 bg-muted text-muted-foreground")}>
      {structureLabels[structure]}
    </Badge>
  );
}
