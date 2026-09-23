create table public.related_think_runs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_think_id uuid not null references public.thinks(id) on delete cascade,
    input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
    status text not null check (status in ('processing', 'completed', 'failed')),
    scores jsonb,
    model text not null,
    prompt_version text not null,
    lease_token uuid,
    lease_expires_at timestamptz,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint related_think_runs_cache_key unique (
        user_id,
        source_think_id,
        input_hash
    ),
    constraint related_think_runs_completed_scores_check check (
        status <> 'completed'
        or (
            scores is not null
            and
            jsonb_typeof(scores) = 'array'
            and completed_at is not null
        )
    ),
    constraint related_think_runs_processing_lease_check check (
        status <> 'processing'
        or (
            lease_token is not null
            and lease_expires_at is not null
        )
    )
);

alter table public.related_think_runs enable row level security;

-- CONNECTキャッシュはEdge Function専用。ブラウザから直接読み書きさせない。
revoke all on table public.related_think_runs from anon, authenticated;

create or replace function public.acquire_related_think_run(
    p_user_id uuid,
    p_source_think_id uuid,
    p_input_hash text,
    p_model text,
    p_prompt_version text,
    p_lock_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_now timestamptz := clock_timestamp();
    v_run public.related_think_runs%rowtype;
    v_lease_token uuid := pg_catalog.gen_random_uuid();
    v_retry_after integer;
begin
    if p_input_hash !~ '^[0-9a-f]{64}$'
        or nullif(pg_catalog.btrim(p_model), '') is null
        or nullif(pg_catalog.btrim(p_prompt_version), '') is null
        or p_lock_minutes not between 1 and 10 then
        return jsonb_build_object('action', 'invalid_request');
    end if;

    if not exists (
        select 1
        from public.thinks as think
        where think.id = p_source_think_id
          and (
              think.is_public = true
              or think.user_id = p_user_id
          )
    ) then
        return jsonb_build_object('action', 'forbidden');
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            'connect:'
            || p_user_id::text
            || ':'
            || p_source_think_id::text
            || ':'
            || p_input_hash,
            0
        )
    );

    select *
      into v_run
      from public.related_think_runs
     where user_id = p_user_id
       and source_think_id = p_source_think_id
       and input_hash = p_input_hash
     for update;

    if found and v_run.status = 'completed' then
        return jsonb_build_object(
            'action', 'cached',
            'run_id', v_run.id,
            'scores', v_run.scores,
            'model', v_run.model,
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

    if v_run.id is null then
        insert into public.related_think_runs (
            user_id,
            source_think_id,
            input_hash,
            status,
            scores,
            model,
            prompt_version,
            lease_token,
            lease_expires_at,
            started_at
        ) values (
            p_user_id,
            p_source_think_id,
            p_input_hash,
            'processing',
            null,
            p_model,
            p_prompt_version,
            v_lease_token,
            v_now + make_interval(mins => p_lock_minutes),
            v_now
        )
        returning * into v_run;
    else
        update public.related_think_runs
           set status = 'processing',
               scores = null,
               model = p_model,
               prompt_version = p_prompt_version,
               lease_token = v_lease_token,
               lease_expires_at = v_now + make_interval(mins => p_lock_minutes),
               started_at = v_now,
               completed_at = null
         where id = v_run.id
        returning * into v_run;
    end if;

    return jsonb_build_object(
        'action', 'started',
        'run_id', v_run.id,
        'lease_token', v_lease_token
    );
end;
$$;

revoke all on function public.acquire_related_think_run(
    uuid,
    uuid,
    text,
    text,
    text,
    integer
) from public, anon, authenticated;

grant execute on function public.acquire_related_think_run(
    uuid,
    uuid,
    text,
    text,
    text,
    integer
) to service_role;

comment on table public.related_think_runs is
    'ユーザー別のJev関連判定キャッシュと同時実行リース。本文は保存しない。';
