import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  GitPullRequest,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkflowDiagram } from "@/features/methodology/workflow-diagram";
import {
  methodology,
  methodologySources,
  methodologyStages,
} from "@/lib/methodology";
import { deals } from "@/lib/data";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Methodology & living PRD",
  description:
    "Every registered source, the review workflow, open storage decisions, and the product contract for Nuclear Atlas.",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  const automated = methodologySources.filter(
    (source) => source.state === "approved_automated",
  ).length;
  return (
    <main className="mx-auto w-full max-w-screen-2xl space-y-8 px-4 py-8 sm:px-6 lg:px-10">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Methodology / Living PRD</Badge>
          <Badge variant="secondary">
            {methodology.status} · v{methodology.version}
          </Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          How Nuclear Atlas works.
        </h1>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">
          Public sources become traceable evidence, then a usable dashboard.
          This is our open product blueprint, including what works today and
          what we still need to decide.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            variant="outline"
            nativeButton={false}
            role="link"
            render={
              <a
                href={`${basePath}/methodology/nuclear-atlas-prd.md`}
                download
              />
            }
          >
            <Download />
            Download PRD
          </Button>
          <Button
            className="min-h-11"
            variant="outline"
            nativeButton={false}
            role="link"
            render={
              <a
                href="https://github.com/lucaschatham/nuclear-atlas/issues"
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <GitPullRequest />
            Propose a change
            <ExternalLink />
          </Button>
        </div>
      </header>

      <section
        aria-label="Implementation snapshot"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {[
          [
            String(methodologySources.length),
            "Registered source families",
            "Not all connected",
          ],
          [
            String(automated),
            "Automated collectors",
            "Review required before publication",
          ],
          [
            String(deals.length),
            "Published project records",
            "Curated dataset, not global completeness",
          ],
          ["Open", "Long-term storage decision", "No migration approved here"],
        ].map(([value, label, note]) => (
          <Card key={label} size="sm">
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs leading-5 text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <nav
        aria-label="Methodology sections"
        className="flex flex-wrap gap-2 border-y py-3"
      >
        {[
          ["workflow", "Workflow"],
          ["source-inventory", "All sources"],
          ["storage", "Storage decisions"],
          ["product-contract", "Product contract"],
          ["evidence-rules", "Evidence rules"],
        ].map(([id, label]) => (
          <Button
            key={id}
            variant="ghost"
            className="min-h-11"
            nativeButton={false}
            role="link"
            render={<a href={`#${id}`} />}
          >
            {label}
          </Button>
        ))}
      </nav>

      <section
        id="workflow"
        className="scroll-mt-24 space-y-4"
        aria-labelledby="workflow-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Badge variant="outline">The complete workflow</Badge>
            <h2 id="workflow-title" className="text-xl font-semibold">
              From source to screen
            </h2>
          </div>
          <Badge variant="secondary">
            Current system + clearly labeled open decisions
          </Badge>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Every source is a row on the left. Connections converge into one
          collection, storage, review, and publication flow. Open decisions
          remain labeled inside their steps.
        </p>
        <WorkflowDiagram />
        <Alert>
          <ShieldCheck />
          <AlertTitle>Collection is not publication.</AlertTitle>
          <AlertDescription>
            Daily polling does not mean daily source updates. Registered does
            not mean connected, and a successful download does not prove a
            claim.
          </AlertDescription>
        </Alert>
      </section>

      <section
        id="storage"
        className="scroll-mt-24 space-y-4"
        aria-labelledby="storage-title"
      >
        <div className="space-y-2">
          <Badge variant="outline">Architecture review</Badge>
          <h2 id="storage-title" className="text-xl font-semibold">
            Storage is an open decision.
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Document the system we have before choosing the system we need. No
            database, private data repository, or durable archive is introduced
            by this PRD page.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {methodology.storage.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <Badge variant="outline" className="mb-2 w-fit">
                  {item.status}
                </Badge>
                <CardTitle>
                  <h3>{item.title}</h3>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  {item.detail}
                </p>
                <p className="break-words rounded-md bg-muted p-2 font-mono text-xs leading-5">
                  {item.location}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              <h3>Decisions to work through together</h3>
            </CardTitle>
            <CardDescription>
              These are design questions, not approved infrastructure
              requirements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="divide-y">
              {methodology.decisions.map((decision, index) => (
                <li
                  key={decision.title}
                  className="space-y-2 py-4 first:pt-0 last:pb-0"
                >
                  <h4 className="text-sm font-semibold">
                    {index + 1}. {decision.title}
                  </h4>
                  <p className="text-sm leading-6">{decision.question}</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    <span className="font-medium">Decision test:</span>{" "}
                    {decision.acceptance}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>
      <section
        id="product-contract"
        aria-labelledby="product-title"
        className="scroll-mt-24 space-y-5 border-t pt-8"
      >
        <div className="space-y-2">
          <Badge variant="outline">03 / Dashboard experience</Badge>
          <h2 id="product-title" className="text-2xl font-semibold">
            One workspace. The whole lifecycle.
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {methodology.objective} Projects is the only populated stage today.
            The questions below define intended usefulness, not existing data
            coverage.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {methodology.ui.map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <Badge variant="outline" className="mb-2 w-fit">
                  {item.status}
                </Badge>
                <CardTitle>
                  <h3>{item.title}</h3>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                {item.detail}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {methodologyStages.map((stage, index) => (
            <Card key={stage.id}>
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Badge
                    variant={
                      stage.status === "Published" ? "secondary" : "outline"
                    }
                  >
                    {stage.status}
                  </Badge>
                </div>
                <CardTitle>
                  <h3>{stage.label}</h3>
                </CardTitle>
                <CardDescription>{stage.audience}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {stage.questions.map((question) => (
                    <li key={question} className="flex gap-2 text-sm leading-6">
                      <ArrowRight
                        className="mt-1 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {question}
                    </li>
                  ))}
                </ul>
                <p className="border-t pt-3 text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Next milestone:
                  </span>{" "}
                  {stage.next}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section
        id="evidence-rules"
        aria-labelledby="rules-title"
        className="scroll-mt-24 space-y-5 border-t pt-8"
      >
        <div className="space-y-2">
          <Badge variant="outline">Product guardrails</Badge>
          <h2 id="rules-title" className="text-2xl font-semibold">
            Evidence first. Unknown stays unknown.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {methodology.rules.map((rule) => (
            <Card key={rule.title}>
              <CardHeader>
                <CardTitle>
                  <h3>{rule.title}</h3>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                {rule.detail}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>What qualifies as a project?</h3>
              </CardTitle>
              <CardDescription>Current Projects inclusion rule</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>
                Publicly announced fission deals between a nuclear power
                provider and a named large-load buyer or developer. The
                comparable dataset excludes anonymous counterparties and fusion
                agreements.
              </p>
              <h4 className="font-semibold text-foreground">
                Explicit non-goals
              </h4>
              <ul className="list-disc space-y-2 pl-4">
                {methodology.nonGoals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>Bindingness rubric</h3>
              </CardTitle>
              <CardDescription>
                Contractual support, not project quality or a prediction of
                success.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                {methodology.rubric.map(([tier, definition]) => (
                  <div
                    key={tier}
                    className="grid grid-cols-[3rem_1fr] gap-3 py-3 first:pt-0"
                  >
                    <dt>
                      <Badge variant="secondary">{tier}</Badge>
                    </dt>
                    <dd className="text-sm leading-6 text-muted-foreground">
                      {definition}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        aria-labelledby="acceptance-title"
        className="grid gap-6 border-t pt-8 lg:grid-cols-2"
      >
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="acceptance-title">What counts as done?</h2>
            </CardTitle>
            <CardDescription>
              Release tests for the product and future data pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {methodology.releaseChecks.map((check) => (
                <li key={check} className="flex gap-3 text-sm leading-6">
                  <Check className="mt-1 size-4 shrink-0" aria-hidden="true" />
                  {check}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Layers3 className="mb-2 size-5 text-muted-foreground" />
            <CardTitle>
              <h2>Keep this blueprint editable.</h2>
            </CardTitle>
            <CardDescription>
              The page and downloadable PRD share the same content files.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              Edit requirements in{" "}
              <code className="break-all font-mono text-xs">
                data/methodology.json
              </code>
              , source examples in{" "}
              <code className="break-all font-mono text-xs">
                data/credibility/source-examples.json
              </code>
              , and diagrams in{" "}
              <code className="break-all font-mono text-xs">
                public/methodology/*.mmd
              </code>
              . Re-render diagrams after changing the workflow or theme.
            </p>
            <p>
              Propose corrections with a record ID, the exact claim, and an
              original source. Change policy and infrastructure through reviewed
              pull requests.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                nativeButton={false}
                role="link"
                render={
                  <a href={`${basePath}/data/source-registry.json`} download />
                }
              >
                <Download />
                Source registry
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                nativeButton={false}
                role="link"
                render={<Link href="/" />}
              >
                Open the Atlas
                <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
      <footer className="grid gap-3 border-t pt-6 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
        <p>
          All registered families are listed; this is not an exhaustive
          inventory of every nuclear dataset worldwide. Global records are
          supported, but current collection is U.S.-first.
        </p>
        <p>
          Code and Atlas-authored data use the MIT License. Upstream records
          keep their own terms. Informational only; source records and public
          facts can change.
        </p>
      </footer>
    </main>
  );
}
