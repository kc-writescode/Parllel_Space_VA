create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz default now() not null
);

create index idx_audit_logs_restaurant_created on audit_logs(restaurant_id, created_at desc);

alter table audit_logs enable row level security;

create policy "members can view audit logs"
  on audit_logs for select
  using (
    restaurant_id in (
      select restaurant_id from restaurant_members where user_id = auth.uid()
    )
  );
