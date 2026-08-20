# Contributing

This tracker treats source quality as product quality. Corrections and additions are welcome.

## Add or correct a deal

1. Open an issue first if you are unsure whether the record meets the inclusion rule.
2. Edit `data/deals.json`. Keep firm and optioned capacity in separate fields.
3. Cite a primary source for every material number. Company releases, SEC filings, and regulator dockets are preferred.
4. Explain what each source supports in its `supports` field.
5. Add a dated entry to `data/changelog.json`.
6. Run `npm test`, `npm run validate:data`, and `npm run build`.
7. Submit a pull request that describes the evidence and any remaining uncertainty.

Every record needs at least one source, a bindingness tier, an evidence sentence, and a current `last_verified` date. Set `needs_verification` to `true` when a material fact remains unresolved.

## Tip line

Use [GitHub issues](https://github.com/lucaschatham/nuclear-notebook/issues) for leads, dead links, status changes, and suspected errors. Include a source URL and the affected deal id when possible.
