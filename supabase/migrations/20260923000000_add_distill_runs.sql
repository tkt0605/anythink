create table public.distill_runs (
    id uuid primary key default gen_random_uuid(),
    think_id uuid not null references public.thinks(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
    reply_count integer not null check (reply_count between 1 and 100),
    last_reply_at timestamptz not null,
    status text not null check (status in ('processing', 'completed', 'failed')),
    summary text,
    common_points text,
    disagreements text,
    open_questions text,
    model text not null,
    lease_token uuid,
    lease_expires_at timestamptz,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint distill_runs_think_id_input_hash_key unique (think_id, input_hash),
    constraint distill_runs_completed_result_check check (
        status <> 'completed'
        or (
            summary is not null
            and common_points is not null
            and disagreements is not null
            and open_questions is not null
            and completed_at is not null
        )
    )
);

create index distill_runs_user_id_created_at_idx
    on public.distill_runs (user_id, created_at desc);

create index distill_runs_think_id_completed_at_idx
    on public.distill_runs (think_id, completed_at desc)
    where status = 'completed';

create table public.distill_usage_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    think_id uuid not null references public.thinks(id) on delete cascade,
    distill_run_id uuid not null references public.distill_runs(id) on delete cascade,
    status text not null check (status in ('started', 'completed', 'failed')),
    created_at timestamptz not null default now()
);

create index distill_usage_events_user_id_created_at_idx
    on public.distill_usage_events (user_id, created_at desc);

create index distill_usage_events_think_id_created_at_idx
    on public.distill_usage_events (think_id, created_at desc);

alter table public.distill_runs enable row level security;
alter table public.distill_usage_events enable row level security;

revoke all on table public.distill_runs from anon, authenticated;
revoke all on table public.distill_usage_events from anon, authenticated;

create or replace function public.acquire_distill_run(
    p_think_id uuid,
    p_user_id uuid,
    p_input_hash text,
    p_reply_count integer,
    p_last_reply_at timestamptz,
    p_model text,
    p_cooldown_minutes integer,
    p_daily_limit integer,
    p_lock_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_now timestamptz := clock_timestamp();
    v_run public.distill_runs%rowtype;
    v_usage_event_id uuid;
    v_lease_token uuid := pg_catalog.gen_random_uuid();
    v_daily_count integer;
    v_daily_oldest timestamptz;
    v_last_think_usage timestamptz;
    v_retry_after integer;
begin
    if p_input_hash !~ '^[0-9a-f]{64}$'
        or p_reply_count not between 1 and 100
        or p_last_reply_at is null
        or nullif(trim(p_model), '') is null
        or p_cooldown_minutes not between 1 and 1440
        or p_daily_limit not between 1 and 1000
        or p_lock_minutes not between 1 and 60 then
        return jsonb_build_object('action', 'invalid_request');
    end if;

    if not exists (
        select 1
        from public.thinks as think
        where think.id = p_think_id
          and think.user_id = p_user_id
    ) then
        return jsonb_build_object('action', 'forbidden');
    end if;

    -- Always acquire these in the same order. This makes limit checks and the
    -- usage reservation atomic even for two different inputs from one user.
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('distill:user:' || p_user_id::text, 0)
    );
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('distill:think:' || p_think_id::text, 0)
    );

    select *
      into v_run
      from public.distill_runs
     where think_id = p_think_id
       and input_hash = p_input_hash
     for update;

    if found and v_run.status = 'completed' then
        return jsonb_build_object(
            'action', 'cached',
            'run_id', v_run.id,
            'summary', v_run.summary,
            'common_points', v_run.common_points,
            'disagreements', v_run.disagreements,
            'open_questions', v_run.open_questions,
            'reply_count', v_run.reply_count,
            'generated_at', v_run.completed_at
        );
    end if;

    if found
       and v_run.status = 'processing'
       and v_run.lease_expires_at > v_now then
        v_retry_after := greatest(
            1,
            ceil(extract(epoch from (v_run.lease_expires_at - v_now)))::integer
        );
        return jsonb_build_object(
            'action', 'in_progress',
            'retry_after_seconds', least(v_retry_after, 10)
        );
    end if;

    select count(*)::integer, min(created_at)
      into v_daily_count, v_daily_oldest
      from public.distill_usage_events
     where user_id = p_user_id
       and created_at > v_now - interval '24 hours';

    if v_daily_count >= p_daily_limit then
        v_retry_after := greatest(
            1,
            ceil(extract(epoch from (
                v_daily_oldest + interval '24 hours' - v_now
            )))::integer
        );
        return jsonb_build_object(
            'action', 'daily_limit',
            'retry_after_seconds', v_retry_after,
            'remaining_requests', 0
        );
    end if;

    select max(created_at)
      into v_last_think_usage
      from public.distill_usage_events
     where think_id = p_think_id
       and created_at > v_now - make_interval(mins => p_cooldown_minutes);

    if v_last_think_usage is not null then
        v_retry_after := greatest(
            1,
            ceil(extract(epoch from (
                v_last_think_usage
                + make_interval(mins => p_cooldown_minutes)
                - v_now
            )))::integer
        );
        return jsonb_build_object(
            'action', 'cooldown',
            'retry_after_seconds', v_retry_after,
            'remaining_requests', p_daily_limit - v_daily_count
        );
    end if;

    if v_run.id is null then
        insert into public.distill_runs (
            think_id,
            user_id,
            input_hash,
            reply_count,
            last_reply_at,
            status,
            model,
            lease_token,
            lease_expires_at,
            started_at
        ) values (
            p_think_id,
            p_user_id,
            p_input_hash,
            p_reply_count,
            p_last_reply_at,
            'processing',
            p_model,
            v_lease_token,
            v_now + make_interval(mins => p_lock_minutes),
            v_now
        )
        returning * into v_run;
    else
        update public.distill_runs
           set user_id = p_user_id,
               reply_count = p_reply_count,
               last_reply_at = p_last_reply_at,
               status = 'processing',
               summary = null,
               common_points = null,
               disagreements = null,
               open_questions = null,
               model = p_model,
               lease_token = v_lease_token,
               lease_expires_at = v_now + make_interval(mins => p_lock_minutes),
               started_at = v_now,
               completed_at = null
         where id = v_run.id
        returning * into v_run;
    end if;

    insert into public.distill_usage_events (
        user_id,
        think_id,
        distill_run_id,
        status,
        created_at
    ) values (
        p_user_id,
        p_think_id,
        v_run.id,
        'started',
        v_now
    )
    returning id into v_usage_event_id;

    return jsonb_build_object(
        'action', 'started',
        'run_id', v_run.id,
        'lease_token', v_lease_token,
        'usage_event_id', v_usage_event_id,
        'remaining_requests', p_daily_limit - v_daily_count - 1
    );
end;
$$;

revoke all on function public.acquire_distill_run(
    uuid,
    uuid,
    text,
    integer,
    timestamptz,
    text,
    integer,
    integer,
    integer
) from public, anon, authenticated;

grant execute on function public.acquire_distill_run(
    uuid,
    uuid,
    text,
    integer,
    timestamptz,
    text,
    integer,
    integer,
    integer
) to service_role;

create or replace function public.get_distill_status(p_think_id uuid)
returns table (
    reply_count integer,
    generated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select run.reply_count, run.completed_at
      from public.distill_runs as run
      join public.thinks as think on think.id = run.think_id
     where run.think_id = p_think_id
       and run.status = 'completed'
       and think.user_id = (select auth.uid())
     order by run.completed_at desc
     limit 1;
$$;

revoke all on function public.get_distill_status(uuid) from public, anon;
grant execute on function public.get_distill_status(uuid) to authenticated;

comment on table public.distill_runs is
    'AI蒸留下書きの非公開キャッシュと同時実行ロック。公開Knowledgeとは分離する。';

comment on table public.distill_usage_events is
    'Anthropic API呼び出しを開始する処理の利用記録。失敗も保持する。';
