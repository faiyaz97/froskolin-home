-- Supabase's automatic-RLS dashboard option installs this event-trigger
-- helper in public. Event triggers invoke it internally, so API roles do not
-- need permission to call the SECURITY DEFINER function directly.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
