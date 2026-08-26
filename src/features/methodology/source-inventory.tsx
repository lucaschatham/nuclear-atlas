"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  collectionStateLabels,
  filterMethodologySources,
  type MethodologySource,
} from "@/lib/methodology-contract";

export function SourceInventory({ sources }: { sources: MethodologySource[] }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const filtered = filterMethodologySources(sources, query, state);
  const states = [...new Set(sources.map((source) => source.state))];

  return (
    <Card
      id="source-inventory"
      className="min-w-0 scroll-mt-24 rounded-none border-0 bg-transparent shadow-none"
    >
      <CardHeader>
        <Badge variant="outline" className="w-fit">
          01 / Inputs
        </Badge>
        <CardTitle>
          <h2>Public data sources</h2>
        </CardTitle>
        <InputGroup className="mt-2">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search data sources"
            placeholder="Search sources or data types"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
        <Select
          value={state}
          onValueChange={(value) => setState(value ?? "all")}
        >
          <SelectTrigger aria-label="Collection state" className="h-11 w-full">
            <SelectValue>
              {state === "all"
                ? "All collection states"
                : collectionStateLabels[state]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All collection states</SelectItem>
            {states.map((value) => (
              <SelectItem key={value} value={value}>
                {collectionStateLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span role="status">
            {filtered.length} of {sources.length} sources
          </span>
          {(query || state !== "all") && (
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setQuery("");
                setState("all");
              }}
            >
              Reset source filters
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <ScrollArea
          className="h-128 border-r border-primary/50"
          aria-label="Source nodes"
        >
          <div className="space-y-3 pl-4 pb-2">
            {filtered.map((source) => (
              <div key={source.id} className="flex items-center">
                <article
                  data-source-id={source.id}
                  className="min-w-0 flex-1 space-y-1 rounded-lg border bg-background p-2"
                >
                  <h3 className="text-sm font-semibold leading-5">
                    <Button
                      variant="ghost"
                      className="h-auto min-h-11 w-full justify-between px-1 text-left whitespace-normal"
                      aria-expanded={expandedSource === source.id}
                      aria-controls={`details-${source.id}`}
                      onClick={() =>
                        setExpandedSource(
                          expandedSource === source.id ? null : source.id,
                        )
                      }
                    >
                      <span>{source.name}</span>
                      <ChevronDown
                        className={`size-4 shrink-0 ${expandedSource === source.id ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </Button>
                  </h3>
                  <p className="line-clamp-2 px-1 text-xs leading-5 text-muted-foreground">
                    {source.examples.join(" · ")}
                  </p>
                  <p className="px-1 text-xs font-medium text-muted-foreground">
                    {collectionStateLabels[source.state]} ·{" "}
                    {source.geography.join(", ")}
                  </p>
                  <div
                    id={`details-${source.id}`}
                    hidden={expandedSource !== source.id}
                    className="space-y-1 border-t pt-3 text-xs leading-5 text-muted-foreground"
                  >
                    <ul className="list-disc space-y-1 pl-4">
                      {source.examples.map((example) => (
                        <li key={example}>{example}</li>
                      ))}
                    </ul>
                    <Button
                      variant="ghost"
                      className="min-h-11"
                      nativeButton={false}
                      role="link"
                      render={
                        <a
                          href={source.endpoint}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      Open source <ExternalLink />
                    </Button>
                    <p>
                      <span className="font-medium text-foreground">
                        Access:
                      </span>{" "}
                      {source.access.toUpperCase()} · Source cadence:{" "}
                      {source.cadence}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Authority:
                      </span>{" "}
                      {source.authority}
                    </p>
                    <p className="break-words">
                      <span className="font-medium text-foreground">
                        Last recorded check:
                      </span>{" "}
                      {source.lastCheckUtc
                        ? `${source.lastCheckUtc.replace("T", " ").replace("Z", "")} UTC`
                        : "No collection receipt published"}
                    </p>
                    {source.state !== "approved_automated" && (
                      <p>{source.notes}</p>
                    )}
                  </div>
                </article>
                <span
                  data-source-connection
                  aria-hidden="true"
                  className={`w-6 shrink-0 border-t ${source.state === "approved_automated" ? "border-primary" : "border-dashed border-muted-foreground"}`}
                />
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                No sources match these filters.
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
