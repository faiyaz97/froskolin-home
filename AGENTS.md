<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Froskolin agent guide

## Read first

- Read `docs/ARCHITECTURE.md` before architectural, database, authentication, authorization, financial/domain, API, storage, recurrence, or migration work.
- Read `docs/DESIGN_SYSTEM.md` before meaningful UI work. Only its named completed pages are canonical visual references.
- Froskolin is a group expense-sharing app. Use **group** and **member** in user-facing copy. Existing `household` route/database names are compatibility identifiers; do not casually rename them.

## Stack

Node.js 22+, pnpm 11.19.0, Next.js 16.3 App Router, React 19.2, strict TypeScript, Tailwind CSS 4, Supabase Postgres/Auth/Storage/RLS, Zod 4, Vitest, Playwright, and pgTAP. See `docs/ARCHITECTURE.md` for boundaries and invariants.

## Exact commands

Run from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm dev                 # next dev --webpack
pnpm build               # next build
pnpm start               # next start
pnpm lint                # eslint
pnpm format              # prettier --write .
pnpm format:check        # prettier --check .
pnpm typecheck           # tsc --noEmit
pnpm test                # vitest run
pnpm test:watch          # vitest
pnpm test:e2e            # playwright test
pnpm check               # format:check + lint + typecheck + test
pnpm supabase:start      # supabase start
pnpm supabase:stop       # supabase stop
pnpm supabase:reset      # supabase db reset
pnpm supabase:test       # supabase test db
pnpm supabase:types      # regenerate local database types
```

Focused validation:

```sh
pnpm vitest run <test-file>
pnpm exec playwright test <spec> --project=chromium
```

CI runs `pnpm check`, `pnpm build`, Chromium E2E, and Supabase database tests.

## Working rules

- Preserve existing behavior, architecture, dependencies, and lockfiles unless the task explicitly requires change. Prefer the smallest correct change; do not re-scaffold or perform unrelated cleanup.
- Inspect relevant implementation, tests, and conventions before editing. Preserve unrelated user changes in a dirty worktree.
- Keep pages/layouts server-first and small. Put reusable interaction in feature components and cross-feature primitives in `src/components/ui`.
- Use Server Actions for ordinary mutations and Route Handlers for the existing binary upload/view/extraction and cron boundaries.
- Treat every action, Route Handler, query parameter, and form payload as untrusted. Validate inputs and authorize inside the server entry point; page visibility is not authorization.
- Supabase RLS remains the final data boundary. Never expose the service-role key or import the admin client into client code.
- Keep financial writes that span multiple rows atomic in PostgreSQL functions. Use integer cents, exact share totals, stable participant ordering, and UTC date-only domain behavior.
- Use `@/*`, named exports, `cn()`, existing CSS tokens, Lucide icons, and accessible names/roles. Follow the deeper conventions in the two docs.
- Add and edit flows for one entity must reuse the same form/workspace component with initial state; do not fork their UI.
- Do not expose raw database, auth, storage, or extraction errors to users.

## Design-system maintenance

When meaningful UI work introduces, changes, or standardizes a reusable visual pattern, update `docs/DESIGN_SYSTEM.md` as part of the same task.

Do not update the design system for one-off page details or unfinished experiments.

Update it when:

- a new shared UI primitive becomes canonical;
- an existing canonical component changes behavior or appearance;
- a previously unresolved design decision is settled;
- a completed page establishes a reusable pattern;
- an existing inconsistency is intentionally standardized.

## Database and migration safety

- Create schema changes with `pnpm exec supabase migration new <descriptive_name>`. Never edit an already-applied migration; add a later migration.
- New exposed objects require explicit least-privilege grants and RLS. Privileged functions require focused security review.
- Regenerate `src/lib/supabase/database.types.ts` with `pnpm supabase:types` after schema changes.
- Add/update pgTAP coverage for RLS, grants, or database invariants and run `pnpm supabase:test`.
- Never put secrets, service-role keys, signing keys, or `PIN_PEPPER` in source, fixtures, docs, logs, or client-visible variables.

## Validation requirements

- Calibrate checks to the change, but meaningful code changes require the most relevant tests, typecheck, lint/format checks, and final diff inspection.
- UI changes: inspect the rendered result when browser tooling is available; test affected responsive states and interactions.
- Database/auth/API/financial changes: run focused unit/contract tests plus database security tests where applicable.
- Before handoff, run `git diff --check` and confirm unrelated files were not changed.
- Report what changed, validation run, failures or skipped checks, and remaining risks. Do not claim unrun checks passed.

## Do not edit manually

- Generated/build output: `.next/**`, `out/**`, `build/**`, `coverage/**`, `playwright-report/**`, `test-results/**`, `next-env.d.ts`, `*.tsbuildinfo`.
- Installed dependencies: `node_modules/**` (the bundled Next.js docs are read-only reference material).
- Generated database types: `src/lib/supabase/database.types.ts`; regenerate them instead.
- `pnpm-lock.yaml`; change dependencies through pnpm.
- Applied files in `supabase/migrations/**`; create a new migration.
- Environment/secret files. Do not modify credentials.
- This file’s auto-generated Next.js block; `next dev` will restore it if removed.
