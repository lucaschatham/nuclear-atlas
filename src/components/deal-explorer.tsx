"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Check, ChevronDown, Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { BindingBadge, StructureBadge } from "@/components/deal-badges";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buyerTypeLabels, formatDate, formatMw, structureLabels, technologyLabels } from "@/lib/format";
import type { Deal } from "@/lib/types";
import { cn } from "@/lib/utils";

const MW_MAX = 12000;
const bindingRank = { B0: 0, B1: 1, B2: 2, B3: 3, B4: 4, B5: 5, BX: -1 };

type FacetOption = { label: string; value: string };

function parseList(value: string | null) {
  return new Set(value?.split(",").filter(Boolean) ?? []);
}

function FacetedFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FacetOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="border-dashed" />}>
        <Filter className="size-3.5" />
        {label}
        {selected.size > 0 && (
          <span className="ml-1 border-l border-border pl-2 font-mono text-[10px]">{selected.size}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Filter ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>No values found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const active = selected.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => {
                      const next = new Set(selected);
                      if (active) next.delete(option.value);
                      else next.add(option.value);
                      onChange(next);
                    }}
                  >
                    <span className={cn("grid size-4 place-items-center border", active ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                      {active && <Check className="size-3" />}
                    </span>
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem className="justify-center" onSelect={() => onChange(new Set())}>Clear filter</CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function sortableHeader(label: string) {
  function SortableHeader({ column }: { column: { toggleSorting: (descending?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
    return (
      <Button variant="ghost" size="xs" className="-ml-2 font-mono text-[10px] uppercase tracking-wider" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        {label}<ArrowUpDown className="size-3" />
      </Button>
    );
  }
  SortableHeader.displayName = `SortableHeader(${label})`;
  return SortableHeader;
}

const columns: ColumnDef<Deal>[] = [
  {
    accessorKey: "name",
    header: sortableHeader("Deal"),
    cell: ({ row }) => (
      <div className="min-w-[270px] py-1">
        <Link href={`/deal/${row.original.id}`} className="font-medium underline-offset-4 hover:underline focus-visible:outline-2">
          {row.original.name}
        </Link>
        {row.original.needs_verification && <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Verification flag</div>}
      </div>
    ),
  },
  {
    id: "offtaker",
    accessorFn: (deal) => deal.parties.offtaker,
    header: sortableHeader("Offtaker"),
    cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue<string>()}</span>,
  },
  {
    id: "structure",
    accessorFn: (deal) => deal.structure_type,
    header: "Structure",
    cell: ({ row }) => <StructureBadge structure={row.original.structure_type} />,
  },
  {
    id: "bindingness",
    accessorFn: (deal) => bindingRank[deal.bindingness.tier],
    header: sortableHeader("Binding"),
    cell: ({ row }) => <BindingBadge tier={row.original.bindingness.tier} />,
  },
  {
    accessorKey: "mw_firm",
    header: sortableHeader("MW firm"),
    cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs tabular-nums">{row.original.mw_firm?.toLocaleString("en-US") ?? "—"}</span>,
  },
  {
    accessorKey: "mw_optioned",
    header: sortableHeader("MW optioned"),
    cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs tabular-nums">{row.original.mw_optioned?.toLocaleString("en-US") ?? "—"}</span>,
  },
  {
    id: "technology",
    accessorFn: (deal) => technologyLabels[deal.technology],
    header: sortableHeader("Technology"),
    cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{technologyLabels[row.original.technology]}</span>,
  },
  {
    id: "announced",
    accessorFn: (deal) => deal.dates.announced,
    header: sortableHeader("Announced"),
    cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs">{formatDate(row.original.dates.announced)}</span>,
  },
  {
    id: "target",
    accessorFn: (deal) => deal.dates.target_cod ?? "",
    header: "Target COD",
    cell: ({ row }) => <span className="block min-w-[150px] text-muted-foreground">{row.original.dates.target_cod ?? "Not disclosed"}</span>,
  },
];

export function DealExplorer({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "announced", desc: true }]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const setParam = React.useCallback((key: string, value?: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const structures = parseList(searchParams.get("structure"));
  const bindings = parseList(searchParams.get("binding"));
  const technologies = parseList(searchParams.get("technology"));
  const buyers = parseList(searchParams.get("buyer"));
  const regions = parseList(searchParams.get("region"));
  const query = searchParams.get("q")?.toLowerCase().trim() ?? "";
  const recent = searchParams.get("recent") === "90";
  const minMw = Number(searchParams.get("min_mw") ?? 0);
  const maxMw = Number(searchParams.get("max_mw") ?? MW_MAX);

  const facetOptions = React.useMemo(() => ({
    structures: Array.from(new Set(deals.map((deal) => deal.structure_type))).sort().map((value) => ({ value, label: structureLabels[value] })),
    bindings: Array.from(new Set(deals.map((deal) => deal.bindingness.tier))).sort().map((value) => ({ value, label: value })),
    technologies: Array.from(new Set(deals.map((deal) => deal.technology))).sort().map((value) => ({ value, label: technologyLabels[value] })),
    buyers: Array.from(new Set(deals.map((deal) => deal.parties.offtaker_type))).sort().map((value) => ({ value, label: buyerTypeLabels[value] })),
    regions: Array.from(new Set(deals.map((deal) => `${deal.location.state ?? "Not disclosed"} · ${deal.location.grid_region ?? "Not disclosed"}`))).sort().map((value) => ({ value, label: value })),
  }), [deals]);

  const snapshotDate = React.useMemo(() => new Date(`${deals.map((deal) => deal.last_verified).sort().at(-1)}T00:00:00Z`), [deals]);
  const recentCutoff = React.useMemo(() => new Date(snapshotDate.getTime() - 90 * 86400000), [snapshotDate]);

  const filteredDeals = React.useMemo(() => deals.filter((deal) => {
    const haystack = [
      deal.name,
      deal.parties.offtaker,
      deal.parties.developer,
      deal.parties.technology_vendor,
      deal.location.site,
      deal.location.state,
      deal.location.grid_region,
      deal.bindingness.evidence,
    ].filter(Boolean).join(" ").toLowerCase();
    const region = `${deal.location.state ?? "Not disclosed"} · ${deal.location.grid_region ?? "Not disclosed"}`;
    const disclosedMw = Math.max(deal.mw_firm ?? 0, deal.mw_optioned ?? 0);
    return (!query || haystack.includes(query))
      && (!structures.size || structures.has(deal.structure_type))
      && (!bindings.size || bindings.has(deal.bindingness.tier))
      && (!technologies.size || technologies.has(deal.technology))
      && (!buyers.size || buyers.has(deal.parties.offtaker_type))
      && (!regions.size || regions.has(region))
      && disclosedMw >= minMw
      && disclosedMw <= maxMw
      && (!recent || new Date(`${deal.dates.announced}T00:00:00Z`) >= recentCutoff);
  }), [bindings, buyers, deals, maxMw, minMw, query, recent, recentCutoff, regions, structures, technologies]);

  // TanStack Table returns intentionally stateful functions that React Compiler must not memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredDeals,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hasFilters = searchParams.toString().length > 0;
  const setFacet = (key: string) => (values: Set<string>) => setParam(key, Array.from(values).join(","));
  const applyPreset = (preset: "binding" | "operating" | "recent") => {
    const next = new URLSearchParams();
    if (preset === "binding") next.set("binding", "B3,B4,B5");
    if (preset === "operating") next.set("binding", "B5");
    if (preset === "recent") next.set("recent", "90");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <section aria-labelledby="deal-ledger" className="border-t border-border bg-background/85">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Primary record</p>
            <h2 id="deal-ledger" className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">Deal ledger</h2>
            <p className="mt-2 text-sm text-muted-foreground">{filteredDeals.length} of {deals.length} deals shown. Capacity filters use the larger disclosed firm or optioned figure.</p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Filter presets">
            <Button variant="outline" size="sm" onClick={() => applyPreset("binding")}>Binding only (B3+)</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("operating")}>Operating</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("recent")}>Announced last 90 days</Button>
          </div>
        </div>

        <div className="border-y border-border bg-card/55 py-3">
          <div className="flex flex-col gap-3 px-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1 lg:max-w-sm">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchParams.get("q") ?? ""} onChange={(event) => setParam("q", event.target.value)} placeholder="Search deals, parties, sites…" className="h-8 pl-8" aria-label="Search deals" />
              </div>
              <div className="flex flex-wrap gap-2">
                <FacetedFilter label="Structure" options={facetOptions.structures} selected={structures} onChange={setFacet("structure")} />
                <FacetedFilter label="Binding" options={facetOptions.bindings} selected={bindings} onChange={setFacet("binding")} />
                <FacetedFilter label="Technology" options={facetOptions.technologies} selected={technologies} onChange={setFacet("technology")} />
                <FacetedFilter label="Buyer type" options={facetOptions.buyers} selected={buyers} onChange={setFacet("buyer")} />
                <FacetedFilter label="State / region" options={facetOptions.regions} selected={regions} onChange={setFacet("region")} />
                <Popover>
                  <PopoverTrigger render={<Button variant="outline" size="sm" className="border-dashed" />}>
                    <SlidersHorizontal className="size-3.5" /> MW range
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="start">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="text-sm font-medium">Disclosed capacity</span>
                      <span className="font-mono text-xs text-muted-foreground">{minMw.toLocaleString()} to {maxMw.toLocaleString()} MW</span>
                    </div>
                    <Slider min={0} max={MW_MAX} step={50} value={[minMw, maxMw]} onValueCommitted={(value) => {
                      const range = typeof value === "number" ? [value, value] : value;
                      const next = new URLSearchParams(searchParams.toString());
                      if (range[0] > 0) next.set("min_mw", String(range[0])); else next.delete("min_mw");
                      if (range[1] < MW_MAX) next.set("max_mw", String(range[1])); else next.delete("max_mw");
                      const queryString = next.toString();
                      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
                    }} />
                  </PopoverContent>
                </Popover>
                {hasFilters && <Button variant="ghost" size="sm" onClick={() => router.replace(pathname, { scroll: false })}><RotateCcw className="size-3.5" /> Reset</Button>}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="lg:ml-auto" />}>
                  Columns <ChevronDown className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table.getAllColumns().filter((column) => column.getCanHide()).map((column) => (
                    <DropdownMenuCheckboxItem key={column.id} checked={column.getIsVisible()} onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}>
                      {column.id.replaceAll("_", " ")}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="mt-4 hidden overflow-hidden border border-border bg-card/50 md:block">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/45 hover:bg-muted/45">
                    {headerGroup.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="transition-colors hover:bg-accent/35">
                    {row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">No deals match these filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:hidden">
          {table.getRowModel().rows.length ? table.getRowModel().rows.map(({ original: deal }) => (
            <article key={deal.id} className="relative border border-border bg-card/65 p-4 transition-transform hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{deal.parties.offtaker}</p>
                  <h3 className="mt-1 text-base font-semibold"><Link className="after:absolute after:inset-0" href={`/deal/${deal.id}`}>{deal.name}</Link></h3>
                </div>
                <BindingBadge tier={deal.bindingness.tier} />
              </div>
              <div className="mt-4"><StructureBadge structure={deal.structure_type} /></div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-sm">
                <div><dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Firm</dt><dd className="mt-1 font-mono">{formatMw(deal.mw_firm)}</dd></div>
                <div><dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Optioned</dt><dd className="mt-1 font-mono">{formatMw(deal.mw_optioned)}</dd></div>
                <div><dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Technology</dt><dd className="mt-1">{technologyLabels[deal.technology]}</dd></div>
                <div><dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Announced</dt><dd className="mt-1">{formatDate(deal.dates.announced)}</dd></div>
              </dl>
            </article>
          )) : <div className="border border-border p-8 text-center text-sm text-muted-foreground">No deals match these filters.</div>}
        </div>
      </div>
    </section>
  );
}

export function DealExplorerFallback() {
  return <div className="mx-auto max-w-[1600px] px-4 py-16 text-sm text-muted-foreground">Loading deal ledger…</div>;
}
