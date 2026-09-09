import { ChevronDown, ExternalLink } from "lucide-react";
import data from "../../../data/personas.json";

export function PersonaGuide() {
  return <section id="product-contract" aria-labelledby="audience-title" className="scroll-mt-36 space-y-6">
    <div className="max-w-3xl space-y-2">
      <h2 id="audience-title" className="text-xl font-semibold">Who uses Nuclear Atlas?</h2>
      <p className="text-base leading-7 text-muted-foreground">Find your role. Explore the questions that guide what we collect and how we organize the atlas.</p>
      <p className="text-sm leading-6 text-muted-foreground">Stakeholder groups follow the IAEA framework. Role labels and questions are our adaptations; the IAEA does not rank these questions or endorse this tool.</p>
      <a href={data.framework.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">IAEA stakeholder framework</a>
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-2 border-y py-3 text-sm text-muted-foreground"><span>{data.personas.length} stakeholder roles</span><span>5 candidate questions each</span><span>Coverage is partial, primarily U.S.</span></div>
    <div className="divide-y">
      {data.personas.map((persona, index) => <details key={persona.id} className="group py-5" open={index === 0}>
        <summary className="flex min-h-11 cursor-pointer list-none items-start gap-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 [&::-webkit-details-marker]:hidden">
          <span className="pt-1 text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
          <div className="flex-1"><h3 className="text-lg font-semibold">{persona.title}</h3><p className="mt-1 text-sm text-muted-foreground">{persona.role}</p></div>
          <ChevronDown aria-hidden="true" className="mt-1 size-5 shrink-0 transition-transform group-open:rotate-180"/>
        </summary>
        <div className="mt-5 space-y-5 sm:pl-8">
          <p className="max-w-3xl text-base leading-7">{persona.job}</p>
          <p className="text-sm text-muted-foreground">IAEA category: <strong className="font-medium text-foreground">{persona.iaeaCategory}</strong> · {persona.iaeaLocator}</p>
          <ol className="divide-y border-y">{persona.questions.map((question, i) => <li key={question.text} className="flex flex-col gap-2 py-4 md:flex-row md:items-baseline md:justify-between md:gap-8">
            <p className="max-w-3xl text-base leading-6"><span className="mr-3 text-xs text-muted-foreground">{i + 1}.</span>{question.text}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{question.status}</span>
          </li>)}</ol>
          <p className="max-w-3xl text-xs leading-5 text-muted-foreground">These questions guide product research. We have not yet verified which can be answered by the current dataset.</p>
          {persona.id === "fuel-buyer" && <p className="max-w-3xl text-sm leading-6 text-muted-foreground">TRISO describes a fuel form. High-assay low-enriched uranium (HALEU) describes an enrichment category. Supplier discovery does not confirm available stock, qualification, price, or delivery.</p>}
          <div className="space-y-2"><h4 className="text-sm font-semibold">Sources behind these questions</h4><p className="text-xs text-muted-foreground">Our synthesis of the subjects these sources cover, not quoted questions or confirmed customer demand.</p>
            <ul className="space-y-2">{persona.sources.map(key => { const source = data.sources[key as keyof typeof data.sources]; return <li key={key}><a href={source.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4 hover:text-evidence-exact visited:text-muted-foreground">{source.title}<ExternalLink aria-hidden="true" className="size-3 shrink-0"/></a></li>;})}</ul>
          </div>
          <div className="border-t pt-4"><h4 className="text-sm font-semibold">What this suggests for the dashboard</h4><p className="mt-2 text-sm leading-6 text-muted-foreground">Proposed filters: {persona.filters.join(" · ")}. These are design inputs, not new controls available today.</p></div>
        </div>
      </details>)}
    </div>
  </section>;
}
