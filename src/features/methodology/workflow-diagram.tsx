import { ArrowRight, Download, MoveHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { SourceInventory } from "./source-inventory";
import { methodology, methodologySources } from "@/lib/methodology";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function Connection() {
  return (
    <div
      aria-hidden="true"
      data-workflow-connection
      className="flex w-12 shrink-0 items-center text-primary"
    >
      <span className="h-px flex-1 bg-current" />
      <ArrowRight className="-ml-1 size-5" />
    </div>
  );
}

export function WorkflowDiagram() {
  return (
    <figure
      data-workflow-diagram
      className="min-w-0 overflow-hidden rounded-xl border bg-card"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <p className="text-sm font-medium">
          Many sources. One evidence workflow.
        </p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <MoveHorizontal className="size-4" aria-hidden="true" />
          Scroll across the workflow; scroll down the source list.
        </p>
      </figcaption>
      <ScrollArea
        className="w-full"
        aria-label="Connected source-to-dashboard workflow"
      >
        <div className="flex w-max items-center p-4 pb-8">
          <div className="w-80 shrink-0 sm:w-96">
            <SourceInventory sources={methodologySources} />
          </div>
          {methodology.workflow.map((step, index) => (
            <div
              key={step.id}
              className="flex items-center"
              data-workflow-step={step.id}
            >
              <Connection />
              <Card className="w-64 shrink-0 border-primary/30 shadow-none">
                <CardHeader>
                  <Badge variant="secondary" className="w-fit">
                    {String(index + 2).padStart(2, "0")}
                  </Badge>
                  <CardTitle>
                    <h3>{step.title}</h3>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-6">{step.detail}</p>
                  <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">
                    {step.caveat}
                  </p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" keepMounted />
      </ScrollArea>
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2">
        <p className="mr-auto text-xs text-muted-foreground">
          Solid source lines: automated collection. Dashed: not automated.
        </p>
        <Button
          variant="ghost"
          className="min-h-11"
          nativeButton={false}
          role="link"
          render={
            <a href={`${basePath}/methodology/workflow.mmd`} download />
          }
        >
          <Download /> Mermaid source
        </Button>
      </div>
    </figure>
  );
}
