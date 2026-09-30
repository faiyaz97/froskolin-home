# Production smoke check

The `Production smoke` GitHub Actions workflow runs after Vercel reports a successful Production deployment, each morning, and on manual dispatch. It checks the public entry and sign-in pages, then signs in as one dedicated QA member and reads Home, Balances, Activity, and Group Settings on desktop and mobile. It does not create or change financial records.

Configure repository Actions secrets `SMOKE_GROUP_CODE`, `SMOKE_MEMBER_NAME`, and `SMOKE_PERSONAL_PIN` for a dedicated production QA group/account. Keep its PIN only in Actions secrets. The workflow fails clearly if any secret is missing. Do not use a real member's account.

Run locally with those environment variables set:

```sh
pnpm exec playwright test --config=playwright.production.config.ts
```

Keep full financial, database, and mutation tests in the isolated CI environment. A separate staging Supabase project is needed before running those tests against a Vercel Preview deployment. The smoke check confirms availability and basic navigation, not accounting correctness, push delivery, or live Gemini extraction.
