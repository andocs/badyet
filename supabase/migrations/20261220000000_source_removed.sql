-- rev-38: a built-in source can be removed from the Rules list (it stops listening) and added back later. Its reader stays in the app.
alter table public.capture_sources add column if not exists removed boolean not null default false;

-- Rollback:
-- alter table public.capture_sources drop column if exists removed;
