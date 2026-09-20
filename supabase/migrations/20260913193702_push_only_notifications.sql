-- Push-only delivery: stop producing inbox history. Existing audit records remain.
drop trigger if exists notifications_from_audit on public.audit_events;

create table public.push_subscriptions (
  endpoint text primary key check (length(endpoint) between 1 and 2048),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null check (length(p256dh) = 87),
  auth text not null check (length(auth) = 22),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
-- Only validated server actions access device delivery secrets.
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;
