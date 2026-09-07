# Froskolin architecture and invariants

## Purpose

This document is the source of truth for system structure, backend boundaries, authorization, persistence, and domain invariants. Operational commands and mandatory agent checks live in the repository-root `AGENTS.md`; visual rules live in `docs/DESIGN_SYSTEM.md`.

The product is described to users as a **group** expense-sharing app. Existing routes, database objects, and code identifiers use `household` and remain compatibility contracts.

## Runtime and technology

Froskolin is one Next.js 16 App Router deployment using React 19 and strict TypeScript. Supabase provides Postgres 17, Auth, Storage, and the Data API. Tailwind CSS handles presentation; Zod validates untrusted application inputs. Vitest covers domain/component behavior, Playwright covers user flows, and pgTAP covers database security and invariants.

The request path is intentionally layered:

```text
Page / Client Component
        │
        ├── read ──> Server Component or src/lib/queries
        │                 │
        │                 └── request-scoped Supabase client + user JWT + RLS
        │
        ├── ordinary mutation ──> Server Action
        │                              ├── Zod validation
        │                              ├── authentication/authorization
        │                              └── Supabase row write or atomic RPC
        │
        └── binary/AI/cron ──> Route Handler or server service
                                      ├── validation and authorization
                                      ├── private Storage / extractor
                                      └── database record or atomic RPC
```

## Source boundaries

### Routes and rendering

- `src/app/**/page.tsx` and layouts are Server Components by default. They authenticate, read data, normalize database rows, and compose feature components.
- `src/app/h/[householdId]/layout.tsx` requires active membership and supplies the authenticated group shell.
- `src/components/**` owns interactive UI. Client boundaries should be as small as practical.
- `src/components/ui` contains cross-feature primitives; `components/expenses`, `components/bills`, and `components/household` contain reusable feature behavior.
- `src/proxy.ts` refreshes Supabase cookies and performs the forced-PIN redirect. Proxy is not the final authorization layer.

### Application and domain code

- `src/lib/queries` owns reusable reads made with the caller’s request-scoped Supabase client.
- `src/lib/actions` owns ordinary mutations exposed as Server Actions. Actions validate, authorize, call row operations or RPCs, and return `ActionResult` rather than leaking raw errors.
- `src/lib/domain` contains deterministic, framework-free calculations for money, splits, balances, occupancy, utility allocation, and recurrence.
- `src/lib/validation` contains Zod schemas for untrusted action, API, upload, and extraction input.
- `src/lib/services` contains server-only orchestration such as recurring occurrence generation.
- `src/lib/auth` owns identity provisioning, PIN derivation, membership checks, owner checks, and mutation gates.
- `src/lib/supabase` owns browser, request-scoped server, and admin client creation plus generated database types.

### API routes

`src/app/api` is deliberately narrow:

- bill upload, viewing, and extraction;
- expense attachment upload/view/removal;
- recurring cron execution.

Ordinary form mutations belong in Server Actions. Route Handlers independently validate path/query/body/FormData values and authorize the request; being reachable from an authenticated page is never sufficient.

## Authentication and authorization

### Identity model

Users authenticate through Supabase Auth using an internal, random alias. A personal PIN is transformed server-side with `PIN_PEPPER` into the Supabase password. The alias and derived password are implementation details and must never be exposed as user-facing credentials.

PINs and group join PINs are handled only in server-only modules. Join verification uses a keyed digest; the owner-visible join PIN is stored separately in encrypted form. Authentication failures deliberately return generic copy.

The application assumes one active group membership per Auth account. A forced PIN reset is stored in trusted `app_metadata.must_change_pin`; user-editable `user_metadata` must never authorize access.

### Authorization helpers

Use the helpers in `src/lib/auth/authorization.ts`:

- `requireAuthenticatedUser` for an authenticated read.
- `requireAuthenticatedMutation` for a mutation that also requires PIN-change completion.
- `requireHouseholdMembership` for active group membership.
- `requireHouseholdMutation` for an active member allowed to mutate.
- `requireHouseholdOwner` / `requireHouseholdOwnerMutation` for owner-only operations.

Server authentication uses `supabase.auth.getUser()`, which validates with Supabase Auth. Cookie presence, client state, hidden UI, page rendering, and Proxy redirects are not authorization boundaries.

### Client separation

- `src/lib/supabase/client.ts`: browser-safe publishable-key client, singleton per browser.
- `src/lib/supabase/server.ts`: request-scoped cookie client using the publishable key and the user JWT. RLS applies.
- `src/lib/supabase/admin.ts`: service-role client, server-only, no persisted session.

The service-role key is restricted to account provisioning, PIN administration, narrowly scoped audit support, cron/service work, and other explicitly reviewed server operations. Never import the admin client into a Client Component or send the key through a `NEXT_PUBLIC_` variable.

## Data isolation and RLS

Every exposed group-owned row carries `household_id`. RLS calls private indexed membership helpers; active membership is required for reads and financial writes. Owner-only administration is checked at the server entry point and again by database policy/function where applicable.

Key isolation rules:

- Members can see only groups in which they have an active membership.
- Member administration is owner-only.
- Members can manage their own absence periods; owners may correct historical absences for removed members.
- Audit rows are immutable to application roles.
- Notifications are readable only by their recipient.
- Private bill and attachment objects are resolved only after group membership and matching `household_id` are verified.

`supabase/config.toml` sets `api.auto_expose_new_tables = false`. A new table/view/function is not ready for application access until it has explicit least-privilege grants and appropriate RLS. Enabling RLS and granting Data API privileges are separate requirements.

Keep privileged helpers in the unexposed `private` schema. If an RPC must be exposed from `public`, narrowly grant execution, validate membership/ownership inside the function, use a locked-down `search_path`, and review any `SECURITY DEFINER` behavior.

## Persistence lifecycle and auditability

Financial records and memberships are normally voided, removed, or archived instead of physically deleted. This preserves ledger explanations and audit history.

- Expenses and settlements remain attributable after later edits.
- Removed members retain historical participation.
- Recurring rules are archived rather than erased.
- Attachment metadata records removal; storage cleanup is part of the attachment lifecycle.
- Audit events cannot be edited by normal application roles.

Do not introduce physical deletion for ledger-linked data without an explicit retention/audit design review.

## Money and ledger invariants

### Representation

- Persist and calculate money as integer cents (`bigint` where database arithmetic requires it).
- Decimal strings and floating-point parsing are confined to form/input boundaries.
- An expense has one payer, one currency, and explicit participant shares.
- The payer does not have to be a participant.
- Every currency is an independent ledger; never convert or net currencies implicitly.

The ledger never stores a mutable balance:

```text
net(member, currency)
  = expenses paid
  - expense shares assigned
  + settlements sent
  - settlements received
```

A positive net means the member should receive money; a negative net means they owe money. Debt simplification deterministically pairs debtors and creditors and is calculated on demand, never persisted.

### Expense shares

The split configuration preserves the user’s intent (`equal`, exact amounts, or percentages). `expense_shares` stores the final integer-cent allocation.

Invariants:

- participant order is explicit and stable;
- all shares are non-negative;
- final shares sum exactly to `expenses.total_cents`;
- percentage inputs resolve deterministically to cents;
- creation/replacement of an expense and its shares commits atomically.

PostgreSQL functions own create/replace operations that span expense, split configuration, shares, utility details, or audit rows. Client code must not emulate these transactions with sequential writes.

## Utility bill allocation

Service dates and absence dates are inclusive date-only values. Domain calculations interpret them as UTC epoch days to avoid daylight-saving transitions.

```text
presenceDays(member) = inclusiveServiceDays - mergedAwayDays
memberTotal = equalFixedShare + weightedVariableShare
```

Rules:

- clip absences to the service period;
- merge overlapping or adjacent absence intervals before counting;
- split fixed fees equally regardless of occupancy;
- split usage costs in proportion to presence days;
- perform integer allocation with stable largest-remainder handling;
- use participant order to break equal fractional remainders;
- if every participant has zero presence, use the explicit equal-split fallback;
- assert fixed, usage, and combined totals independently.

Changing an absence range recalculates every overlapping confirmed utility involving that member in the same transaction.

## Dates, timezone, and locale

Expense, service, absence, settlement, and recurrence dates use `YYYY-MM-DD` strings. Do not introduce local-midnight JavaScript `Date` arithmetic into domain code.

The group record stores an IANA timezone and formatting locale established at creation. The timezone determines the group-local “today” for default transaction dates and recurrence generation. Date-only allocation remains UTC-based; timestamps are formatted into the stored group timezone for display. Locale affects formatting, not ledger identity or arithmetic.

## Recurrence

Monthly occurrences derive from the rule’s original anchor day. Short months clamp to month-end, and later months return to the original anchor: January 31 produces February 28/29 and March 31 rather than drifting permanently to the 28th.

The recurring service creates every occurrence due through the group-local date. A unique `(recurring_rule_id, occurrence_date)` constraint plus insert-on-conflict behavior makes cron retries idempotent.

Generated occurrences are ordinary editable expenses. Editing an occurrence does not mutate its source rule. The member-authorized **Generate due** action is a recovery path for missed cron invocations and uses the same idempotent service/database operation as the scheduled cron.

## Private uploads and Storage

Bills and expense attachments use the private `froskolin-bills` bucket.

- Accept only PDF, JPEG, PNG, and WebP within the application limit.
- Validate the true MIME type and byte size server-side; never trust the filename or browser-provided type.
- Use opaque random object keys under a `householdId/` prefix. Do not include user identifiers or original bill filenames in sensitive object keys.
- Authorize membership/mutation before upload, view, replacement, or removal.
- Store sanitized original filenames only where the product needs to display them.
- Viewing uses short-lived signed URLs returned only after authorization.
- Upload is not complete until its database record succeeds. If record creation fails, remove the new object; replacement failures must preserve or restore the previous logical attachment where possible.
- Keep Storage policies and database RLS aligned. A client must never receive broad bucket access.

## Bill extraction boundary

Bill extraction is advisory. A private upload is normalized and text/content is extracted before a configured `BillExtractor` receives it. Sending content to the extractor requires explicit consent.

Structured extraction output is parsed through Zod and checked for dates, amounts, classification, and confidence. The result remains a client-visible draft until a person confirms it. The extractor:

- never receives group absence data;
- cannot calculate final member shares;
- cannot write an expense or utility bill;
- cannot bypass deterministic domain validation.

Only application/domain code and the atomic database operation calculate and persist money.

## Server actions, errors, and client refresh

All Server Actions are untrusted POST entry points. Each action must:

1. parse input with the relevant Zod schema;
2. authenticate and authorize for the requested group/entity;
3. derive identity and protected row data from trusted server reads;
4. use RLS-backed row operations or the appropriate atomic RPC;
5. return the `ActionResult<T>` contract;
6. expose safe, actionable errors rather than raw database/Auth/Storage details.

`validationFailure` may include field errors. `actionFailure` converts internal failures into safe generic copy while preserving explicit authorization messages. Client components follow established `router.replace(...)` and `router.refresh()` behavior after success.

## Database change rules

Schema history is append-only under `supabase/migrations`.

1. Create a named migration with `pnpm exec supabase migration new <descriptive_name>`.
2. Implement the smallest forward change; never rewrite an applied migration.
3. Review grants, RLS, indexes, triggers, function security, search paths, and storage policies.
4. Update pgTAP tests in `supabase/tests` for access rules and database invariants.
5. Reset or apply locally and run `pnpm supabase:test`.
6. Regenerate `src/lib/supabase/database.types.ts` with `pnpm supabase:types`.
7. Verify the migration list and inspect the final diff.

The generated database types are an output, not the schema source. `supabase/seed.sql` supplies local seed data and must not contain production credentials or secrets.

## Verification map

- Pure allocation, balance, money, occupancy, and recurrence logic: Vitest unit tests.
- Component contracts and client validation: Vitest + Testing Library.
- Add/edit/navigation and responsive user flows: Playwright.
- RLS, grants, RPC authorization, trigger invariants, and cross-group isolation: pgTAP through `pnpm supabase:test`.
- Production integration and route compilation: `pnpm build`.

Security-sensitive changes should be tested at both the application entry point and the database boundary.
