-- 第一次テスト、名無しユーザでもinsert可能に
alter table public.thinks enable row level security;
create policy "Allow anonymous inserts"on public.thinks
  for insert
    to anon
    using (true)
-- 第二次テスト、名無しユーザでもselect可能に
create policy "Allow anonymous reads"
on public.thinks
    for select
    to anon
    using (true)
