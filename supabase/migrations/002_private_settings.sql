-- Apply after 001_initial.sql. Stores self-reported symptoms and preferences
-- privately. This does not add clinical diagnoses or clinician approval.
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}' check (
    jsonb_typeof(payload)='object'
    and payload ?& array['symptoms','preferences']::text[]
    and (payload - array['symptoms','preferences']::text[])='{}'::jsonb
    and jsonb_typeof(payload->'preferences')='object'
    and coalesce(jsonb_typeof(payload->'preferences'->'saveOriginal')='boolean',false)
    and (payload->'symptoms' is null or payload->'symptoms'='null'::jsonb or (
      jsonb_typeof(payload->'symptoms')='object'
      and (payload->'symptoms') ?& array['description','areas','side','professionalGuidance','updatedAt']::text[]
      and coalesce(char_length(payload->'symptoms'->>'description') between 1 and 1500,false)
      and jsonb_typeof(payload->'symptoms'->'areas')='array'
      and jsonb_array_length(payload->'symptoms'->'areas') between 1 and 4
      and (payload->'symptoms'->'areas') <@ '["knee","shoulder","elbow","other"]'::jsonb
      and coalesce(payload->'symptoms'->>'side' in ('left','right','both','unsure'),false)
      and jsonb_typeof(payload->'symptoms'->'professionalGuidance')='boolean'
    ))
  ),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "own private settings" on public.user_settings for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update,delete on public.user_settings to authenticated;
revoke all on public.user_settings from anon;

create function public.sync_private_data_v2(goals_data jsonb, plans_data jsonb, sessions_data jsonb, display_name text, settings_data jsonb)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.sync_private_data(goals_data,plans_data,sessions_data,display_name);
  insert into public.user_settings(user_id,payload) values(auth.uid(),settings_data)
    on conflict(user_id) do update set payload=excluded.payload,updated_at=now();
end $$;

create function public.load_private_data_v2() returns jsonb language sql stable security invoker set search_path=public as $$
  select public.load_private_data() || jsonb_build_object(
    'symptoms', (select payload->'symptoms' from public.user_settings where user_id=auth.uid()),
    'preferences', coalesce((select payload->'preferences' from public.user_settings where user_id=auth.uid()),'{"saveOriginal":true}'::jsonb)
  );
$$;
revoke all on function public.sync_private_data_v2(jsonb,jsonb,jsonb,text,jsonb) from public,anon;
revoke all on function public.load_private_data_v2() from public,anon;
grant execute on function public.sync_private_data_v2(jsonb,jsonb,jsonb,text,jsonb),public.load_private_data_v2() to authenticated;
