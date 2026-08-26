# Editing the living methodology PRD

The public page is `/about/`. It is a local design and product-planning surface until reviewed and deployed. It does not change collection or authorize a storage migration.

## Sources of truth

| Edit                                                 | File                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| Requirements, open decisions, stages, evidence rules | `data/methodology.json`                                      |
| Source identity, access, and actual collection state | `data/credibility/sources.json`                              |
| Existing source summaries and categories             | `data/credibility/source-guide.json`                         |
| Two or three plain-language source examples          | `data/credibility/source-examples.json`                      |
| Unified workflow                                     | `data/methodology.json` and `src/lib/methodology-diagram.ts` |
| Colors                                               | Semantic tokens in `src/app/globals.css`                     |

The server prepares the source inventory. Only the search and filter controls are client components. No private source credentials are sent to visitors. Registered capabilities are not presented as already-published data.

## Regenerate

1. Run `npm ci`.
2. Run `npx playwright install chromium` if Chromium is not already installed.
3. Run `npm run generate:methodology` after editing diagrams or theme tokens.
4. Run `npm run generate:methodology:docs` after editing content. This also runs before development and production builds.
5. Run `npm test`, `npm run lint`, `npm run validate:ui`, and `npm run build`.
6. Stop any development server, then run `npx playwright test tests/e2e/methodology.spec.ts`.

The page contains one connected diagram, built from existing Card, Badge, Button, and ScrollArea components. All source cards form its left column, with individual branches joining the shared intake line. Source details expand inline. The source column scrolls vertically; the full canvas scrolls horizontally on every screen. No separate source inventory or second diagram appears below it.

The same source records and workflow steps generate one downloadable Mermaid graph, SVG, PNG, and Markdown PRD. Mermaid and Playwright render exports offline, not through a CDN. The live page uses accessible HTML nodes instead of shrinking a 34-source SVG to unreadable text. Update the canonical JSON and regenerate; do not edit the generated `.mmd` directly.

The diagram skill can also export editable Excalidraw scenes. To regenerate those optional files, set `MERMAID_EXCALIDRAW_BUNDLE` to its local `lib/diagram-render/dist/diagram-render.html`, then run `npm run generate:methodology`. The site does not depend on that bundle. Excalidraw edits do not update the canonical JSON.

## Truthfulness checks

- Source inventory IDs and collection states must match the registry.
- The downloadable PRD must be generated from the same content as the page.
- Diagram hashes must match their Mermaid source and theme tokens.
- Current versus planned infrastructure must stay explicit.
- Do not describe daily polling as live data or successful collection as permission to publish.
- Do not mark a lifecycle stage published until actual reviewed records reach the dashboard.

## Open next decision

Storage is intentionally unresolved. Measure volume and historical-query needs; compare Git-only storage against a database and object archive; approve retention and access; prove recovery before a cutover. Do not create infrastructure just to make the diagram look complete.
