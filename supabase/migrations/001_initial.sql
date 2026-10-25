-- Run in a new Supabase project's SQL editor. No service key is used by the app.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  avatar_url text,
  created_at timestamptz not null default now()
);
create table public.rehabilitation_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  status text not null check (status in ('active','achieved')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.rehabilitation_goals(user_id);
create table public.exercises (
  id text primary key,
  name text not null,
  description text not null,
  body_part text not null,
  instructions jsonb not null default '[]',
  camera_direction text not null,
  target_landmarks jsonb not null,
  measurement_config jsonb not null,
  precautions text not null,
  reference_url text not null
);
insert into public.exercises values
 ('knee','무릎 굽혔다 펴기','공개 자료 참고 측정 예시','무릎','["의료진이 지정한 범위에서 수행하세요."]','측면','{"left":[23,25,27],"right":[24,26,28]}','{"version":"2d-projected-v1","confidence":0.65,"fps":10}','통증이 생기면 중단하고 의료진과 상담하세요.','https://www.orthoinfo.org/recovery/knee-conditioning-program/'),
 ('shoulder','팔 들어 올리기','공개 자료 참고 측정 예시','어깨','["의료진이 지정한 범위와 방향에서 수행하세요."]','정면','{"left":[23,11,13],"right":[24,12,14]}','{"version":"2d-projected-v1","confidence":0.65,"fps":10}','통증이 생기면 중단하고 의료진과 상담하세요.','https://www.orthoinfo.org/recovery/rotator-cuff-and-shoulder-conditioning-program/'),
 ('elbow','팔꿈치 굽혔다 펴기','공개 자료 참고 측정 예시','팔꿈치','["의료진이 지정한 범위에서 수행하세요."]','측면','{"left":[11,13,15],"right":[12,14,16]}','{"version":"2d-projected-v1","confidence":0.65,"fps":10}','무게를 임의로 추가하지 마세요.','https://www.orthoinfo.org/recovery/rotator-cuff-and-shoulder-conditioning-program/');
create table public.rehabilitation_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  goal_id uuid references public.rehabilitation_goals(id) on delete set null,
  created_by uuid not null references auth.users(id),
  approval_status text not null default 'self_reported' check (approval_status = 'self_reported'),
  start_date date not null default current_date,
  status text not null default 'active'
);
create table public.plan_exercises (
  id text not null,
  plan_id uuid not null references public.rehabilitation_plans(id) on delete cascade,
  exercise_id text not null references public.exercises(id),
  target_sets integer not null check (target_sets between 1 and 20),
  target_repetitions integer not null check (target_repetitions between 1 and 100),
  target_frequency text not null check (char_length(target_frequency) between 1 and 80),
  clinician_notes text not null check (char_length(clinician_notes) <= 1000),
  source text not null check (source in ('reference','personal')),
  self_confirmed boolean not null default false,
  primary key (plan_id,id)
);
create table public.exercise_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null references public.exercises(id),
  plan_id uuid references public.rehabilitation_plans(id) on delete set null,
  recorded_at timestamptz not null,
  duration double precision not null check (duration between 0.5 and 180),
  side text not null check (side in ('left','right')),
  camera_direction text not null check (camera_direction in ('측면','정면','기타')),
  video_url text,
  analysis_status text not null default 'completed' check (analysis_status = 'completed'),
  analysis_version text not null
);
create index on public.exercise_sessions(user_id,recorded_at desc);
create table public.exercise_analysis (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.exercise_sessions(id) on delete cascade,
  joint_type text not null,
  min_angle double precision not null check (min_angle between 0 and 180),
  max_angle double precision not null check (max_angle between 0 and 180 and max_angle >= min_angle),
  angle_range double precision not null check (angle_range between 0 and 180),
  valid_frame_ratio double precision not null check (valid_frame_ratio between 0 and 1),
  repetition_count integer check (repetition_count >= 0),
  result_json jsonb not null
);
-- This projection contains ONLY the fields selected in the share form.
-- Do not expose or join private session data to render a post.
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  content text not null check (char_length(content) between 1 and 2000),
  media_url text,
  media_type text,
  shared_session_id uuid references public.exercise_sessions(id) on delete set null,
  shared_data jsonb not null default '{}' check (jsonb_typeof(shared_data) = 'object' and (shared_data - array['exerciseName','date','range','difference']::text[]) = '{}'::jsonb),
  created_at timestamptz not null default now()
);
create index on public.community_posts(created_at desc);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
create index on public.comments(post_id);
create table public.likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(post_id,user_id)
);

alter table public.profiles enable row level security;
alter table public.rehabilitation_goals enable row level security;
alter table public.exercises enable row level security;
alter table public.rehabilitation_plans enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.exercise_sessions enable row level security;
alter table public.exercise_analysis enable row level security;
alter table public.community_posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;

create policy "own profile" on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "own goals" on public.rehabilitation_goals for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reference catalog" on public.exercises for select to authenticated using (true);
create policy "own plans" on public.rehabilitation_plans for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and created_by = (select auth.uid()) and (goal_id is null or exists (select 1 from public.rehabilitation_goals g where g.id = goal_id and g.user_id = (select auth.uid()))));
create policy "own plan exercises" on public.plan_exercises for all to authenticated using (exists (select 1 from public.rehabilitation_plans p where p.id = plan_id and p.user_id = (select auth.uid()))) with check (exists (select 1 from public.rehabilitation_plans p where p.id = plan_id and p.user_id = (select auth.uid())));
create policy "own sessions" on public.exercise_sessions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (plan_id is null or exists (select 1 from public.rehabilitation_plans p where p.id = plan_id and p.user_id = (select auth.uid()))));
create policy "own analysis" on public.exercise_analysis for all to authenticated using (exists (select 1 from public.exercise_sessions s where s.id = session_id and s.user_id = (select auth.uid()))) with check (exists (select 1 from public.exercise_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy "read explicitly shared posts" on public.community_posts for select to authenticated using (true);
create policy "write own posts" on public.community_posts for insert to authenticated with check (user_id = (select auth.uid()) and shared_session_id is null and (media_url is null or split_part(media_url,'/',1) = (select auth.uid())::text));
create policy "delete own posts" on public.community_posts for delete to authenticated using (user_id = (select auth.uid()));
create policy "read comments" on public.comments for select to authenticated using (true);
create policy "write own comments" on public.comments for insert to authenticated with check (user_id = (select auth.uid()));
create policy "delete own comments" on public.comments for delete to authenticated using (user_id = (select auth.uid()));
create policy "read likes" on public.likes for select to authenticated using (true);
create policy "write own likes" on public.likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "delete own likes" on public.likes for delete to authenticated using (user_id = (select auth.uid()));

-- SECURITY INVOKER keeps every operation subject to the RLS policies above.
create function public.sync_private_data(goals_data jsonb, plans_data jsonb, sessions_data jsonb, display_name text)
returns void language plpgsql security invoker set search_path = public as $$
declare owner_id uuid := auth.uid(); plan_uuid uuid; item jsonb; session_uuid uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(goals_data) <> 'array' or jsonb_typeof(plans_data) <> 'array' or jsonb_typeof(sessions_data) <> 'array' then raise exception 'Invalid data'; end if;
  if (select count(*) from jsonb_array_elements(goals_data) g where (g->>'primary')::boolean) > 1 then raise exception 'Only one primary goal is allowed'; end if;
  insert into profiles(id,nickname) values(owner_id,display_name) on conflict(id) do update set nickname = excluded.nickname;
  delete from rehabilitation_goals where user_id=owner_id and id not in (select (g->>'id')::uuid from jsonb_array_elements(goals_data) g);
  for item in select * from jsonb_array_elements(goals_data) loop
    insert into rehabilitation_goals(id,user_id,title,description,status,is_primary,created_at)
    values((item->>'id')::uuid,owner_id,item->>'title',item->>'description',item->>'status',(item->>'primary')::boolean,(item->>'createdAt')::timestamptz)
    on conflict(id) do update set title=excluded.title,description=excluded.description,status=excluded.status,is_primary=excluded.is_primary;
  end loop;
  insert into rehabilitation_plans(user_id,created_by) values(owner_id,owner_id) on conflict(user_id) do update set user_id=excluded.user_id returning id into plan_uuid;
  delete from plan_exercises where plan_id=plan_uuid;
  for item in select * from jsonb_array_elements(plans_data) loop
    insert into plan_exercises(id,plan_id,exercise_id,target_sets,target_repetitions,target_frequency,clinician_notes,source,self_confirmed)
    values(item->>'id',plan_uuid,item->>'exerciseId',(item->>'sets')::integer,(item->>'repetitions')::integer,item->>'frequency',item->>'notes',item->>'source',(item->>'confirmed')::boolean);
  end loop;
  delete from exercise_sessions where user_id=owner_id and id not in (select (s->>'id')::uuid from jsonb_array_elements(sessions_data) s);
  for item in select * from jsonb_array_elements(sessions_data) loop
    session_uuid := (item->>'id')::uuid;
    insert into exercise_sessions(id,user_id,exercise_id,plan_id,recorded_at,duration,side,camera_direction,analysis_version)
    values(session_uuid,owner_id,item->>'exerciseId',plan_uuid,(item->>'recordedAt')::timestamptz,(item->>'duration')::double precision,item->>'side',item->>'cameraDirection',item->>'version')
    on conflict(id) do update set duration=excluded.duration,side=excluded.side,camera_direction=excluded.camera_direction,analysis_version=excluded.analysis_version;
    insert into exercise_analysis(session_id,joint_type,min_angle,max_angle,angle_range,valid_frame_ratio,repetition_count,result_json)
    values(session_uuid,item->>'exerciseId',(item->'analysis'->>'min')::double precision,(item->'analysis'->>'max')::double precision,(item->'analysis'->>'range')::double precision,(item->'analysis'->>'validRatio')::double precision,(item->'analysis'->>'repetitions')::integer,item->'analysis')
    on conflict(session_id) do update set min_angle=excluded.min_angle,max_angle=excluded.max_angle,angle_range=excluded.angle_range,valid_frame_ratio=excluded.valid_frame_ratio,repetition_count=excluded.repetition_count,result_json=excluded.result_json;
  end loop;
end $$;

create function public.load_private_data() returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object(
   'nickname',coalesce((select nickname from profiles where id=auth.uid()),'무브'),
   'goals',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'status',status,'primary',is_primary,'createdAt',created_at) order by created_at) from rehabilitation_goals where user_id=auth.uid()),'[]'::jsonb),
   'plans',coalesce((select jsonb_agg(jsonb_build_object('id',pe.id,'exerciseId',pe.exercise_id,'sets',target_sets,'repetitions',target_repetitions,'frequency',target_frequency,'notes',clinician_notes,'source',source,'confirmed',self_confirmed) order by pe.id) from plan_exercises pe join rehabilitation_plans p on p.id=pe.plan_id where p.user_id=auth.uid()),'[]'::jsonb),
   'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'exerciseId',exercise_id,'recordedAt',recorded_at,'duration',duration,'side',side,'cameraDirection',camera_direction,'version',analysis_version,'analysis',a.result_json) order by recorded_at) from exercise_sessions s join exercise_analysis a on a.session_id=s.id where s.user_id=auth.uid()),'[]'::jsonb)
 );
$$;
revoke all on function public.sync_private_data(jsonb,jsonb,jsonb,text) from public,anon;
revoke all on function public.load_private_data() from public,anon;
grant execute on function public.sync_private_data(jsonb,jsonb,jsonb,text),public.load_private_data() to authenticated;
grant select,insert,update,delete on public.profiles,public.rehabilitation_goals,public.exercises,public.rehabilitation_plans,public.plan_exercises,public.exercise_sessions,public.exercise_analysis,public.community_posts,public.comments,public.likes to authenticated;
revoke all on public.profiles,public.rehabilitation_goals,public.exercises,public.rehabilitation_plans,public.plan_exercises,public.exercise_sessions,public.exercise_analysis,public.community_posts,public.comments,public.likes from anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('private-videos','private-videos',false,262144000,array['video/mp4','video/webm','video/quicktime']),
 ('community-media','community-media',false,20971520,array['image/png','image/jpeg','image/webp','video/mp4','video/webm']);
-- The current MVP stores private originals only in IndexedDB; private-videos is reserved for explicit future opt-in.
create policy "private original owner" on storage.objects for select to authenticated using (bucket_id='private-videos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "private original insert" on storage.objects for insert to authenticated with check (bucket_id='private-videos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "private original delete" on storage.objects for delete to authenticated using (bucket_id='private-videos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "explicit shared media read" on storage.objects for select to authenticated using (bucket_id='community-media' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.community_posts p where p.media_url=name)));
create policy "explicit shared media insert" on storage.objects for insert to authenticated with check (bucket_id='community-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "explicit shared media delete" on storage.objects for delete to authenticated using (bucket_id='community-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
