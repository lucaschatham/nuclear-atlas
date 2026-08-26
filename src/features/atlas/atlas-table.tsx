"use client";

import { ArrowUpRight, Database } from "lucide-react";
import { EvidenceBadge, LocationPrecisionBadge } from "@/components/atlas-ui/evidence";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AtlasRecord } from "@/lib/atlas-workspace";

function formatMetric(record: AtlasRecord) {
  const metric = record.metrics[0];
  if (!metric) return "Unknown";
  return `${typeof metric.value === "number" ? metric.value.toLocaleString("en-US") : metric.value}${metric.unit ? ` ${metric.unit}` : ""}`;
}

function humanize(value: string | null) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";
}

export function AtlasDataTable({
  records,
  selectedRecordId,
  onSelect,
}: {
  records: AtlasRecord[];
  selectedRecordId: string | null;
  onSelect: (id: string) => void;
}) {
  if (records.length === 0) {
    return (
      <Empty className="h-full min-h-[32rem] rounded-none border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Database /></EmptyMedia>
          <EmptyTitle>No published records match</EmptyTitle>
          <EmptyDescription>Change the filters. This result is not evidence that no project exists.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const projectsStage = records[0]?.stage === "projects";

  return (
    <ScrollArea className="h-full min-h-[32rem] bg-background">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
          <TableRow>
            <TableHead className="min-w-64">Record</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Location</TableHead>
            <TableHead className="hidden lg:table-cell">{projectsStage ? "Technology" : "Type"}</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Published value</TableHead>
            <TableHead className="hidden xl:table-cell">As of</TableHead>
            <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow
              key={record.id}
              data-state={selectedRecordId === record.id ? "selected" : undefined}
              className="cursor-pointer"
              onClick={() => onSelect(record.id)}
            >
              <TableCell>
                <div className="font-medium text-foreground">{record.name}</div>
                <div className="mt-1 max-w-72 truncate text-xs text-muted-foreground">{record.summary ?? record.typeLabel ?? "Public evidence record"}</div>
              </TableCell>
              <TableCell>
                {record.evidenceStrength ? <EvidenceBadge strength={record.evidenceStrength} /> : <Badge variant="secondary">{humanize(record.status)}</Badge>}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="space-y-1.5">
                  <div className="max-w-56 truncate text-sm">{record.locationLabel}</div>
                  <LocationPrecisionBadge precision={record.locationPrecision} />
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">{humanize(projectsStage ? record.technology : record.typeLabel)}</TableCell>
              <TableCell className="hidden text-right font-mono text-xs tabular-nums sm:table-cell">{formatMetric(record)}</TableCell>
              <TableCell className="hidden font-mono text-xs text-muted-foreground xl:table-cell">{record.asOf ?? "Unknown"}</TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Inspect ${record.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(record.id);
                  }}
                >
                  <ArrowUpRight />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
