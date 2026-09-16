-- 第一次テスト、名無しユーザでもinsert可能に
alter table public.thinks enable row level security;
create policy "Allow anonymous inserts"on public.thinks
  for insert
    to anon
    with check (true)
