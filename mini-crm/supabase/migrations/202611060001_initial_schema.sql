create extension if not exists pgcrypto;
create type public.app_role as enum ('poster','executor');
create type public.task_status as enum ('new','in_progress','review','accepted','rework');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null,
 role public.app_role not null,
 created_at timestamptz not null default now()
);
create table public.sites (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0),
 address text not null check(length(trim(address))>0), created_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title))>0),
 description text not null default '', site_id uuid not null references public.sites(id) on delete cascade,
 assignee_id uuid references public.profiles(id) on delete set null,
 author_id uuid not null references public.profiles(id), status public.task_status not null default 'new',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.task_history (
 id uuid primary key default gen_random_uuid(), task_id uuid not null,
 changed_by uuid not null references public.profiles(id), from_status public.task_status,
 to_status public.task_status not null, comment text, changed_at timestamptz not null default now()
);
create index tasks_site_id_idx on public.tasks(site_id);
create index tasks_assignee_id_idx on public.tasks(assignee_id);
create index history_task_time_idx on public.task_history(task_id,changed_at desc);

create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=(select auth.uid())
$$;
revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

create function public.enforce_task_update() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); role_now public.app_role := public.current_app_role(); note text;
begin
 if new.title is distinct from old.title or new.description is distinct from old.description
    or new.site_id is distinct from old.site_id or new.assignee_id is distinct from old.assignee_id
    or new.author_id is distinct from old.author_id or new.created_at is distinct from old.created_at then
   if role_now <> 'poster' then raise exception 'Only posters may edit task details'; end if;
 end if;
 if new.status is distinct from old.status then
   note := nullif(trim(coalesce(current_setting('app.transition_comment',true),'')), '');
   if role_now='poster' and old.status='review' and new.status in ('accepted','rework') then
     if new.status='rework' and note is null then raise exception 'A comment is required for rework'; end if;
   elsif role_now='executor' and old.assignee_id=actor and
     ((old.status in ('new','rework') and new.status='in_progress') or (old.status='in_progress' and new.status='review')) then
     if note is not null then raise exception 'Unexpected transition comment'; end if;
   else raise exception 'This status transition is not allowed';
   end if;
   insert into public.task_history(task_id,changed_by,from_status,to_status,comment)
   values(old.id,actor,old.status,new.status,case when new.status='rework' then note end);
 end if;
 new.updated_at:=now(); return new;
end $$;
create trigger task_update_rules before update on public.tasks for each row execute function public.enforce_task_update();

create function public.enforce_task_creation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if public.current_app_role() <> 'poster' then raise exception 'Only posters may create tasks'; end if;
 new.author_id := (select auth.uid());
 new.status := 'new';
 return new;
end $$;
create trigger task_creation_rules before insert on public.tasks for each row execute function public.enforce_task_creation();

create function public.record_task_creation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.task_history(task_id,changed_by,from_status,to_status) values(new.id,new.author_id,null,'new');
 return new;
end $$;
create trigger task_creation_history after insert on public.tasks for each row execute function public.record_task_creation();

create function public.transition_task(p_task_id uuid,p_to_status public.task_status,p_comment text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform set_config('app.transition_comment',coalesce(p_comment,''),true);
 update public.tasks set status=p_to_status where id=p_task_id;
 if not found then raise exception 'Task not found or access denied'; end if;
end $$;
grant execute on function public.transition_task(uuid,public.task_status,text) to authenticated;

create function public.reject_history_change() returns trigger
language plpgsql set search_path='' as $$ begin raise exception 'Task history is immutable'; end $$;
create trigger immutable_history before update or delete on public.task_history for each row execute function public.reject_history_change();

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;
create policy "profiles visible to posters and self" on public.profiles for select to authenticated
 using(id=(select auth.uid()) or public.current_app_role()='poster');
create policy "poster site management" on public.sites for all to authenticated
 using(public.current_app_role()='poster') with check(public.current_app_role()='poster');
create policy "executors see assigned sites" on public.sites for select to authenticated
 using(exists(select 1 from public.tasks t where t.site_id=sites.id and t.assignee_id=(select auth.uid())));
create policy "visible tasks" on public.tasks for select to authenticated
 using(public.current_app_role()='poster' or assignee_id=(select auth.uid()));
create policy "poster creates tasks" on public.tasks for insert to authenticated
 with check(public.current_app_role()='poster' and author_id=(select auth.uid()));
create policy "poster or assignee updates" on public.tasks for update to authenticated
 using(public.current_app_role()='poster' or assignee_id=(select auth.uid()))
 with check(public.current_app_role()='poster' or assignee_id=(select auth.uid()));
create policy "poster deletes tasks" on public.tasks for delete to authenticated
 using(public.current_app_role()='poster');
create policy "visible history" on public.task_history for select to authenticated
 using(public.current_app_role()='poster' or exists(select 1 from public.tasks t where t.id=task_id and t.assignee_id=(select auth.uid())));
revoke insert,update,delete on public.task_history from anon,authenticated;
revoke insert,update,delete on public.profiles from anon,authenticated;
grant select on public.profiles,public.sites,public.tasks,public.task_history to authenticated;
grant insert,update,delete on public.sites,public.tasks to authenticated;
