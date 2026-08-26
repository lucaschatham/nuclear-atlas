import {
  collectionStateLabels,
  type MethodologySource,
} from "./methodology-contract";

interface WorkflowStep {
  id: string;
  title: string;
  detail: string;
  caveat: string;
}

// The website and downloadable graph share source records and workflow content.
// Escape record text as Mermaid labels, never as executable graph syntax.
function label(value: string) {
  return value
    .replaceAll("&", "#38;")
    .replaceAll('"', "#quot;")
    .replaceAll("<", "#60;")
    .replaceAll(">", "#62;")
    .replaceAll("\n", " ");
}

export function buildWorkflowMermaid(
  sources: MethodologySource[],
  steps: WorkflowStep[],
) {
  return [
    "flowchart LR",
    "  accTitle: Nuclear Atlas source-to-dashboard workflow",
    "  accDescr: Individual sources form a vertical list on the left and converge on one shared workflow. Solid source connections mean automated collection; dashed connections are not automated. Human review is required before publication.",
    ...sources.flatMap((source, index) => [
      `  %% source: ${source.id.replaceAll(/[\r\n]/g, "")}`,
      `  source_${index}["${[source.name, collectionStateLabels[source.state], ...source.examples].map(label).join("<br/>")}"]`,
      `  source_${index} ${source.state === "approved_automated" ? "-->" : "-.->"} step_0`,
    ]),
    ...steps.flatMap((step, index) => [
      `  step_${index}["${[step.title, step.detail, step.caveat].map(label).join("<br/>")}"]`,
      ...(index < steps.length - 1
        ? [`  step_${index} --> step_${index + 1}`]
        : []),
    ]),
    `  class ${steps.map((_, index) => `step_${index}`).join(",")} action`,
    `  class ${sources.map((_, index) => `source_${index}`).join(",")} store`,
    "",
  ].join("\n");
}
