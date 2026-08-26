"use client";

import { ArrowUpRight, Database } from "lucide-react";
import { EvidenceBadge, LocationPrecisionBadge } from "@/components/atlas-ui/evidence";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AtlasRecord } from "@/lib/atlas-workspace";
import { formatMw } from "@/lib/format";

const technologyLabels: Record<AtlasRecord["technology"], string> = {
  smr: "SMR",
  large_lwr: "Large LWR",
  restart: "Restart",
  uprate: "Uprate",
  existing_plant_ppa: "Operating PPA",
  multiple: "Multiple",
  other: "Other",
};

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

  return (
    <ScrollArea className="h-full min-h-[32rem] bg-background">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
          <TableRow>
            <TableHead className="min-w-64">Project</TableHead>
            <TableHead>Evidence</TableHead>
            <TableHead className="hidden md:table-cell">Location</TableHead>
            <TableHead className="hidden lg:table-cell">Technology</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Firm</TableHead>
            <TableHead className="hidden text-right xl:table-cell">Optioned</TableHead>
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
                <div className="mt-1 max-w-72 truncate text-xs text-muted-foreground">{record.deal.parties.offtaker}</div>
              </TableCell>
              <TableCell><EvidenceBadge strength={record.evidenceStrength} /></TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="space-y-1.5">
                  <div className="max-w-56 truncate text-sm">{record.locationLabel}</div>
                  <LocationPrecisionBadge precision={record.locationPrecision} />
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">{technologyLabels[record.technology]}</TableCell>
              <TableCell className="hidden text-right font-mono text-xs tabular-nums sm:table-cell">{formatMw(record.firmMw)}</TableCell>
              <TableCell className="hidden text-right font-mono text-xs tabular-nums xl:table-cell">{formatMw(record.optionedMw)}</TableCell>
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
