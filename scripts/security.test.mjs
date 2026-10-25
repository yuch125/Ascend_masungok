import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';

// Ephemeral PostgreSQL, with minimal auth/storage stubs. This tests our SQL,
// not Supabase's hosted Auth, Storage HTTP API, PostgREST or email delivery.
const db = new PGlite();
const userA = '00000000-0000-4000-8000-000000000001';
const userB = '00000000-0000-4000-8000-000000000002';
const goalId = '00000000-0000-4000-8000-000000000011';
const sessionId = '00000000-0000-4000-8000-000000000021';
const postId = '00000000-0000-4000-8000-000000000031';
const goal = {
  id: goalId,
  title: 'Private test goal',
  description: 'Private description',
  status: 'active',
  primary: true,
  createdAt: '2026-10-24T00:00:00Z',
};
const plan = {
  id: 'knee',
  exerciseId: 'knee',
  sets: 2,
  repetitions: 10,
  frequency: 'Test only',
  notes: 'Test fixture',
  source: 'reference',
  confirmed: false,
};
const session = {
  id: sessionId,
  exerciseId: 'knee',
  recordedAt: '2026-10-24T00:00:00Z',
  duration: 5,
  side: 'left',
  cameraDirection: '측면',
  version: '2d-projected-v1',
  analysis: {
    min: 40,
    max: 100,
    range: 60,
    validRatio: 1,
    validFrames: 50,
    totalFrames: 50,
    repetitions: 2,
    frames: [],
  },
};

async function asUser(id) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function sync(
  goals,
  plans,
  sessions,
  name,
  settings = { symptoms: null, preferences: { saveOriginal: true } },
) {
  await db.query('select public.sync_private_data_v2($1::jsonb,$2::jsonb,$3::jsonb,$4,$5::jsonb)', [
    JSON.stringify(goals),
    JSON.stringify(plans),
    JSON.stringify(sessions),
    name,
    JSON.stringify(settings),
  ]);
}
before(
  async () => {
    await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $fn$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $fn$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $fn$;
    grant usage on schema public,auth,storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
    insert into auth.users values('${userA}'),('${userB}');
  `);
    let migration = await readFile(
      new URL('../supabase/migrations/001_initial.sql', import.meta.url),
      'utf8',
    );
    // gen_random_uuid() is built into PostgreSQL; pgcrypto packaging is Supabase-specific.
    migration = migration.replace('create extension if not exists pgcrypto;', '');
    await db.exec(migration);
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/002_private_settings.sql', import.meta.url),
        'utf8',
      ),
    );
    await db.exec(
      await readFile(new URL('../supabase/migrations/003_ipad_media.sql', import.meta.url), 'utf8'),
    );
    const { rows: mediaBuckets } = await db.query(
      "select public, allowed_mime_types from storage.buckets where id='community-media'",
    );
    assert.equal(mediaBuckets[0].public, false);
    assert.ok(mediaBuckets[0].allowed_mime_types.includes('video/quicktime'));
  },
  { timeout: 60000 },
);
after(async () => {
  await db.close();
});

test('SQL migration and private sync/read round trip', async () => {
  await asUser(userA);
  await sync([goal], [plan], [session], 'Account A');
  const { rows } = await db.query('select public.load_private_data() as data');
  assert.equal(rows[0].data.nickname, 'Account A');
  assert.equal(rows[0].data.goals[0].title, 'Private test goal');
  assert.equal(rows[0].data.sessions[0].analysis.range, 60);
  assert.equal(rows[0].data.plans[0].exerciseId, 'knee');
});
test('another account cannot read, mutate, or claim private records', async () => {
  await asUser(userB);
  for (const table of [
    'profiles',
    'rehabilitation_goals',
    'rehabilitation_plans',
    'plan_exercises',
    'exercise_sessions',
    'exercise_analysis',
    'user_settings',
  ]) {
    assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0, table);
  }
  assert.equal(
    (
      await db.query('update public.exercise_sessions set duration=10 where id=$1 returning id', [
        sessionId,
      ])
    ).rows.length,
    0,
  );
  await assert.rejects(sync([goal], [plan], [], 'Account B'), /row-level security/i);
  await assert.rejects(
    db.query(
      "insert into public.exercise_analysis(session_id,joint_type,min_angle,max_angle,angle_range,valid_frame_ratio,result_json) values($1,'knee',0,90,90,1,'{}')",
      [sessionId],
    ),
    /row-level security/i,
  );
});
test('community exposes only an explicit projection, while private data stays hidden', async () => {
  await asUser(userA);
  await db.query(
    'insert into public.community_posts(id,user_id,nickname,content,shared_data) values($1,$2,$3,$4,$5)',
    [
      postId,
      userA,
      'Account A',
      'Test-only shared message',
      JSON.stringify({ exerciseName: 'Test movement' }),
    ],
  );
  await assert.rejects(
    db.query(
      "insert into public.community_posts(user_id,nickname,content,shared_data) values($1,'A','x','{\"frames\":[]}')",
      [userA],
    ),
    /check constraint/i,
  );
  await asUser(userB);
  const post = (await db.query('select * from public.community_posts')).rows[0];
  assert.deepEqual(post.shared_data, { exerciseName: 'Test movement' });
  assert.equal(post.shared_session_id, null);
  assert.equal((await db.query('select * from public.exercise_analysis')).rows.length, 0);
  assert.equal(
    (await db.query('delete from public.community_posts where id=$1 returning id', [postId])).rows
      .length,
    0,
  );
  await assert.rejects(
    db.query('insert into public.likes(post_id,user_id) values($1,$2)', [postId, userA]),
    /row-level security/i,
  );
});
test('storage policies isolate private originals and allow only explicitly published media', async () => {
  await asUser(userA);
  const privatePath = `${userA}/private-test.mp4`,
    sharedPath = `${userA}/shared-test.mp4`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('private-videos',$1),('community-media',$2)",
    [privatePath, sharedPath],
  );
  await asUser(userB);
  assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
  await assert.rejects(
    db.query("insert into storage.objects(bucket_id,name) values('private-videos',$1)", [
      `${userA}/forged.mp4`,
    ]),
    /row-level security/i,
  );
  await asUser(userA);
  await db.query(
    "insert into public.community_posts(user_id,nickname,content,media_url) values($1,'A','Explicit attachment',$2)",
    [userA, sharedPath],
  );
  await asUser(userB);
  const objects = (await db.query('select * from storage.objects')).rows;
  assert.equal(objects.length, 1);
  assert.equal(objects[0].name, sharedPath);
});
test('symptoms and preferences sync privately and never leak through another account', async () => {
  const symptoms = {
    description: 'Private test symptom',
    areas: ['knee'],
    side: 'right',
    professionalGuidance: false,
    updatedAt: '2026-10-24T00:00:00Z',
  };
  await asUser(userA);
  await sync([goal], [plan], [session], 'Account A', {
    symptoms,
    preferences: { saveOriginal: false },
  });
  const own = (await db.query('select public.load_private_data_v2() as data')).rows[0].data;
  assert.equal(own.symptoms.description, 'Private test symptom');
  assert.equal(own.preferences.saveOriginal, false);
  assert.equal(own.sessions[0].id, sessionId);
  await asUser(userB);
  assert.equal((await db.query('select * from public.user_settings')).rows.length, 0);
  assert.equal(
    (await db.query('select public.load_private_data_v2() as data')).rows[0].data.symptoms,
    null,
  );
  assert.equal(
    (
      await db.query(
        "update public.user_settings set payload='{}' where user_id=$1 returning user_id",
        [userA],
      )
    ).rows.length,
    0,
  );
});
test('private settings validation rolls back the entire data transaction', async () => {
  await asUser(userA);
  await assert.rejects(
    sync([goal], [plan], [session], 'SHOULD ROLL BACK', { privateExtra: 'invalid' }),
    /check constraint/i,
  );
  const own = (await db.query('select public.load_private_data_v2() as data')).rows[0].data;
  assert.equal(own.nickname, 'Account A');
  assert.equal(own.symptoms.description, 'Private test symptom');
});
test('anonymous users cannot query rehabilitation data or invoke private RPCs', async () => {
  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select * from public.exercise_sessions'), /permission denied/i);
  await assert.rejects(db.query('select public.load_private_data()'), /permission denied/i);
  await assert.rejects(db.query('select public.load_private_data_v2()'), /permission denied/i);
  await assert.rejects(db.query('select * from public.user_settings'), /permission denied/i);
});
