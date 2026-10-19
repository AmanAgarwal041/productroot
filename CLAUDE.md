@AGENTS.md

# ProductRoot notes

- Plan: `product-launch-and-operations-hub-plan.md`; audit and decisions: `docs/AUDIT.md`. Built so far: Milestones 1–2.
- `lib/core` stays pure (no I/O) and is unit tested; add a test with every new check.
- A check may return `missing` only for a presence check over a source read in full; otherwise `needs_confirmation`. Manual completion is `confirmed`, never `verified`.
- Reuse MetaInfo (SEO/AEO) and SocialBrewery (social posts) through their APIs (`lib/server/integrations`); don't re-implement their features.
- SocialBrewery publishes immediately and has no idempotency keys: never call its publishing tools without an approved, audited workflow run, and never auto-retry them.
- Run `npm test && npm run typecheck && npm run lint` before finishing.
