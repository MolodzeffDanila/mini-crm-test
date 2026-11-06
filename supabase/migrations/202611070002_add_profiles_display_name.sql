-- Add display_name to profiles for the frontend user-display contract.
-- Safe on both provisioning paths (add column if not exists).

alter table public.profiles
  add column if not exists display_name text not null default '';

comment on column public.profiles.display_name is 'Отображаемое имя пользователя в интерфейсе';

-- Backfill from the Auth email local part so existing accounts show a name
-- (manager@test.com -> "manager"). Owners can refine names later in the dashboard.
update public.profiles p
set display_name = split_part(u.email, '@', 1)
from auth.users u
where u.id = p.id
  and nullif(trim(p.display_name), '') is null;
