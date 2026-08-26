import { AlertTriangle, CheckCircle2, Clock3, MapPin, Radio, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { AtlasRecord, LocationPrecision } from "@/lib/atlas-workspace";
import { formatFreshnessDate } from "@/lib/format";
import type { SourceDashboardItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const precisionLabels: Record<LocationPrecision, string> = {
  site: "Exact site",
  county: "County area",
  state: "State area",
  region: "Regional area",
  country: "Country area",
};

export function LocationPrecisionBadge({ precision }: { precision: LocationPrecision }) {
  const exact = precision === "site";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5",
        exact
          ? "border-evidence-exact/40 bg-evidence-exact/10 text-evidence-exact"
          : "border-evidence-approximate/40 bg-evidence-approximate/10 text-evidence-approximate",
      )}
    >
      <MapPin data-icon="inline-start" />
      {precisionLabels[precision]}
    </Badge>
  );
}

export function EvidenceBadge({ strength }: { strength: AtlasRecord["evidenceStrength"] }) {
  const binding = strength === "B4" || strength === "B5";
  return (
    <Badge variant={binding ? "default" : "secondary"}>
      {strength}
      <span className="sr-only"> evidence strength</span>
    </Badge>
  );
}

export function SourceAuthorityBadge({ authority }: { authority: string }) {
  const label = authority.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return <Badge variant="outline">{label}</Badge>;
}

export function SourceHealth({ source, showLabel = true }: { source: SourceDashboardItem; showLabel?: boolean }) {
  const healthy = source.healthy === true;
  const failed = source.healthy === false;
  const label = failed
    ? "Check failed"
    : source.operationalState === "approved_automated"
      ? "Checked daily"
      : source.operationalState.replaceAll("_", " ");
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {healthy ? (
        <CheckCircle2 className="size-3.5 text-source-healthy" aria-hidden="true" />
      ) : failed ? (
        <ShieldAlert className="size-3.5 text-source-failed" aria-hidden="true" />
      ) : (
        <Radio className="size-3.5 text-evidence-stale" aria-hidden="true" />
      )}
      {showLabel && label}
    </span>
  );
}

export function FreshnessLabel({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">Not yet checked</span>;
  const formatted = formatFreshnessDate(value);
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Clock3 className="size-3.5" aria-hidden="true" />
      {formatted}
    </span>
  );
}

export function EvidenceAlert({
  title,
  children,
  tone = "coverage",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "coverage" | "conflict" | "error";
}) {
  const destructive = tone === "error";
  return (
    <Alert
      variant={destructive ? "destructive" : "default"}
      className={cn(
        tone === "coverage" && "border-evidence-approximate/45 bg-evidence-approximate/8",
        tone === "conflict" && "border-evidence-conflict/45 bg-evidence-conflict/8",
      )}
    >
      <AlertTriangle className={cn(tone === "coverage" && "text-evidence-approximate", tone === "conflict" && "text-evidence-conflict")} />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
