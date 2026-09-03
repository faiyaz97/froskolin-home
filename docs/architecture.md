# Architecture and invariants

## Runtime boundaries

Froskolin Home is a single Next.js deployment. Server Components read household data with the signed-in user's Supabase session. Server Actions validate form input and perform ordinary mutations. A small set of PostgreSQL functions owns operations whose records must commit together. Route Handlers are reserved for private bill access/extraction and the recurring cron.

The service-role key is limited to server-only account provisioning, PIN administration, and cron work. Normal household data access uses the user's JWT so PostgreSQL row-level security remains the final authorization boundary.

## Household isolation

Every exposed household row carries `household_id`. RLS calls private, indexed membership helpers; an active membership is required for reads and financial writes. Member administration is owner-only. Members can manage only their own absence periods, except owners may correct the historical absences of removed members. Audit rows cannot be changed by application roles, and notifications are visible only to their recipient.

The application assumes one active household membership per account. Financial records and memberships are voided/removed rather than physically deleted so old balances and audit entries stay explainable.

## Ledger

An expense has one payer, one currency, and explicit participant shares. The payer does not have to be a participant. The ledger never stores a mutable balance:

```text
net(member, currency)
  = expenses paid
  - expense shares assigned
  + settlements sent
  - settlements received
```

Positive means the member should receive money; negative means they owe it. Every currency is an independent ledger. Debt simplification pairs debtors and creditors deterministically and is never persisted.

The split configuration records the user's input intent while `expense_shares` stores the final integer-cent result. An atomic database operation replaces the expense and all shares together and rejects a non-matching total.

## Utility calculation

Service dates and away dates are inclusive. They are interpreted as UTC epoch days rather than local timestamps, avoiding daylight-saving transitions. Absence inputs are clipped to the service period and overlapping or adjacent intervals are merged before counting.

```text
presenceDays(member) = inclusiveServiceDays - mergedAwayDays
memberTotal = equalFixedShare + weightedVariableShare
```

Fixed cents are allocated equally regardless of occupancy. Variable cents are allocated in proportion to presence. Integer division happens with `bigint`; leftover cents go to the largest fractional remainders, with stable participant order breaking ties. When every participant has zero presence, the variable part uses an explicit equal-split fallback. Fixed, variable, and combined totals are each asserted independently.

Changing an absence range recalculates every overlapping confirmed utility involving that member in the same transaction.

## Recurrence

Monthly occurrence dates derive from the rule's original anchor day. Short months clamp to month-end and later months return to the original anchor, so January 31 produces February 28/29 and March 31 rather than drifting to the 28th forever.

The daily cron asks PostgreSQL to create every occurrence due through the household-local date. A unique `(recurring_rule_id, occurrence_date)` constraint and insert-on-conflict behavior make cron retries harmless. Generated expenses are ordinary editable expenses; edits do not change their rule.

The same server-only generation service powers a member-authorized **Generate due** action in household settings. It is a recovery path for missed cron invocations and preserves the same database idempotency guarantee.

## Bill extraction

The app accepts a private PDF/image upload, validates its true type and size, extracts useful text when possible, and sends prepared content to a configured `BillExtractor` only after consent. Structured output is parsed through Zod and checked for date, amount, classification, and confidence consistency. It remains a draft until a person confirms it.

The extraction adapter never receives household absences and cannot write an expense. Only deterministic application/domain code calculates money.
