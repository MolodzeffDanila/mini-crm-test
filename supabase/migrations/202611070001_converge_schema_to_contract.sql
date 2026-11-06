-- Converge the database schema to CONTRACT.md.
--
-- Two provisioning paths exist:
--   1. fresh installs that applied migrations 1-2 (they carry auxiliary columns
--      such as profiles.display_name, objects.created_at, tasks.updated_at);
--   2. the manually provisioned project whose schema was built directly from
--      the contract (no auxiliary columns, trigger wording differs).
-- This migration is idempotent and safe on both: it drops contract-extraneous
-- columns and reinstalls the canonical lifecycle triggers without updated_at.

-- Auxiliary columns are not part of the contract.
alter table public.profiles drop column if exists display_name;
alter table public.profiles drop column if exists created_at;
alter table public.objects drop column if exists created_at;
alter table public.tasks drop column if exists updated_at;

-- Contract: description is optional.
alter table public.tasks alter column description drop not null;

-- Canonical lifecycle triggers (identical to migration 2, without updated_at,
-- which is no longer part of the tasks table).
create or replace function public.enforce_task_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  role_now text := public.current_app_role()::text;
  note text;
begin
  if new.id is distinct from old.id then
    raise exception 'Task primary key is immutable';
  end if;
  if new.author_id is distinct from old.author_id then
    raise exception 'Task author is immutable';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'Task creation time is immutable';
  end if;

  if new.assignee_id is distinct from old.assignee_id
     and (new.assignee_id is null or not exists (
       select 1 from public.profiles p
       where p.id = new.assignee_id and p.role = 'executor'
     )) then
    raise exception 'Task assignee must have the executor role';
  end if;

  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.object_id is distinct from old.object_id
     or new.assignee_id is distinct from old.assignee_id
     or new.author_id is distinct from old.author_id
     or new.created_at is distinct from old.created_at then
    if role_now is distinct from 'manager' then
      raise exception 'Only managers may edit task details';
    end if;
  end if;

  if new.status is distinct from old.status then
    if current_setting('app.task_status_change_rpc', true) is distinct from 'on' then
      raise exception 'Task status must be changed through change_task_status';
    end if;

    note := nullif(trim(coalesce(current_setting('app.transition_comment', true), '')), '');
    if role_now = 'manager'
       and old.status = 'review'
       and new.status in ('accepted', 'revision') then
      if new.status = 'revision' and note is null then
        raise exception 'A comment is required for revision';
      end if;
    elsif role_now = 'executor'
       and old.assignee_id = actor
       and ((old.status in ('new', 'revision') and new.status = 'in_progress')
         or (old.status = 'in_progress' and new.status = 'review')) then
      if note is not null then
        raise exception 'Unexpected transition comment';
      end if;
    else
      raise exception 'This status transition is not allowed';
    end if;

    insert into public.task_status_history(task_id, changed_by, from_status, to_status, comment)
    values (old.id, actor, old.status, new.status, case when new.status = 'revision' then note end);
  end if;

  return new;
end;
$$;

create or replace function public.enforce_task_creation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_app_role() is distinct from 'manager' then
    raise exception 'Only managers may create tasks';
  end if;
  if new.assignee_id is null or not exists (
    select 1 from public.profiles p
    where p.id = new.assignee_id and p.role = 'executor'
  ) then
    raise exception 'Task assignee must have the executor role';
  end if;
  new.author_id := (select auth.uid());
  new.status := 'new';
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.record_task_creation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.task_status_history(task_id, changed_by, from_status, to_status)
  values (new.id, new.author_id, null, 'new');
  return new;
end;
$$;
