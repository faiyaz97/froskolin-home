# Froskolin Home

Froskolin Home is a small, private household-expense app for trusted roommates. It combines a simple bank-like activity feed with deterministic expense splitting, away-period tracking, utility-bill extraction, recurring expenses, settlements, an immutable audit trail, and in-app notifications.

The architecture is intentionally small: one Next.js application, one Supabase project, and one daily Vercel cron. There is no queue, Redis instance, worker service, or stored balance cache.

## Stack

- Next.js 16.3.3, React 19, TypeScript, App Router, and Tailwind CSS 4
- Supabase Auth, PostgreSQL, private Storage, and optional Realtime
- Zod for all server boundaries
- Vitest for financial/domain tests and Playwright for browser smoke tests
- Gemini behind a provider-neutral `BillExtractor` interface
- Vercel for the web app and idempotent daily recurrence trigger

Node.js 22+ and pnpm 11 are required.

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start Docker Desktop, then start the local Supabase stack:

   ```bash
   pnpm supabase:start
   pnpm supabase:reset
   ```

3. Copy `.env.example` to `.env.local` and fill in the values printed by `supabase status`. Generate high-entropy values for `PIN_PEPPER` and `CRON_SECRET`.

4. Start the app:

   ```bash
   pnpm dev
   ```

The app runs at [http://localhost:3000](http://localhost:3000); Supabase Studio runs at [http://localhost:56323](http://localhost:56323). Froskolin uses the `5632x` local port range to avoid colliding with other Supabase projects using the defaults.

## Environment variables

| Variable                               | Exposure     | Purpose                                                  |
| -------------------------------------- | ------------ | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Browser-safe | Supabase project URL                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Publishable/anon client key                              |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server only  | Account provisioning and private administration          |
| `PIN_PEPPER`                           | Server only  | HMAC pepper used to turn a PIN into a long Auth password |
| `GEMINI_API_KEY`                       | Server only  | Optional semantic bill extraction                        |
| `CRON_SECRET`                          | Server only  | Authorizes recurring-generation requests                 |
| `NEXT_PUBLIC_SITE_URL`                 | Browser-safe | Redirect and link origin                                 |

Never expose or prefix the service-role key, PIN pepper, Gemini key, or cron secret with `NEXT_PUBLIC_`.

## Data and correctness model

- All monetary values are integer cents (`bigint` in PostgreSQL).
- Expense shares are explicit rows and must sum exactly to the expense total.
- Balances are derived per currency from payments, shares, and settlements; no mutable balance field and no FX conversion exist.
- An optional landlord is an external payer, never a member account. Landlord-paid expenses are excluded from roommate balances, while each member's outstanding landlord amount is derived from their shares minus separate payment records.
- Date-only values are converted to UTC epoch-day integers. Service periods and away ranges are inclusive.
- Utility fixed costs are split equally. Variable costs are weighted by presence days. If everyone is away for the whole period, the variable portion is split equally and the fallback is recorded.
- Remainder cents use largest-remainder allocation with stable participant-order tie-breaking.
- Historical financial rows are voided rather than physically deleted.

## Bill privacy

Uploads are limited to PDF, JPEG, PNG, and WebP files up to 4 MiB and 10 pages, stored in a private bucket. The 4 MiB ceiling keeps multipart requests below Vercel Functions' 4.5 MB request-body limit. A bill is sent to Gemini only after explicit per-upload consent. Extraction produces a draft only; a person must review the dates, total, fixed/variable classification, payer, and participants before an expense can be created. The model never receives occupancy data and never calculates shares.

## PIN authentication threat model

Each household has a readable House Code (`FROSKO-2847`), a separate six-digit Join PIN for adding new roommates, and a six-digit personal PIN for each member. An existing member signs in with the House Code, their name, and only their personal PIN. The Join PIN and personal PINs are never stored in plaintext: the server stores a keyed digest for the Join PIN and derives a long Supabase Auth password from a private alias and each personal PIN. A returning browser remembers only the House Code and member name; signing out preserves that convenience, while **Forget this device** removes it.

## Quality checks

```bash
pnpm check
pnpm build
pnpm test:e2e
pnpm supabase:test
```

Domain tests cover exact-cent invariants, equal/exact/percentage splits, occupancy normalization, leap years, cross-month/year service periods, all-away fallback, per-currency balances, debt simplification, and month-end recurrence behavior.

The PostgreSQL/pgTAP suite requires the local Supabase stack, so Docker Desktop must be running. It verifies household RLS isolation, audit immutability, notification actor exclusion, and recurring-generation idempotency.

## Deployment

1. Create a Supabase project and run the migrations in `supabase/migrations` with the Supabase CLI.
   Disable public user and email signups in the hosted Auth settings; Froskolin provisions only private alias accounts through the server.
2. Create a Vercel project using Node.js 22 and add every variable from `.env.example`.
3. Set `NEXT_PUBLIC_SITE_URL` to the production origin and add that origin to Supabase Auth redirect URLs.
4. Deploy. `vercel.json` invokes `/api/cron/recurring` once daily; Vercel supplies the bearer value from `CRON_SECRET`.
5. Confirm that the `froskolin-bills` Storage bucket is private and that its object policies were applied.

The recurrence endpoint and database uniqueness constraint are both idempotent, so a retry cannot create a duplicate occurrence. Household settings also provide a **Generate due** recovery action if a scheduled run is missed.
