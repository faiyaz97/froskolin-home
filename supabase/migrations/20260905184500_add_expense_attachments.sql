create table public.expense_attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  expense_id uuid not null,
  uploader_user_id uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[^/]+$'),
  original_file_name text not null check (char_length(original_file_name) between 1 and 160),
  detected_mime text not null check (detected_mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  byte_count integer not null check (byte_count > 0 and byte_count <= 4194304),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  foreign key (expense_id, household_id) references public.expenses(id, household_id) on delete restrict,
  unique (id, household_id)
);

create unique index expense_attachments_one_active_idx
  on public.expense_attachments (expense_id)
  where removed_at is null;
create index expense_attachments_household_idx
  on public.expense_attachments (household_id, created_at desc);

alter table public.expense_attachments enable row level security;

create policy expense_attachments_member_all
  on public.expense_attachments
  for all
  to authenticated
  using ((select private.is_active_household_member(household_id)))
  with check ((select private.is_active_household_member(household_id)));

grant select, insert, update on public.expense_attachments to authenticated;

