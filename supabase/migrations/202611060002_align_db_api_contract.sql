-- Bring the existing schema in line with CONTRACT.md and DB-API.md.
-- All changes are metadata/value renames; existing task and history rows are retained.

alter type public.app_role rename value 'poster' to 'manager';
alter type public.task_status rename value 'rework' to 'revision';

alter table public.task_history rename to task_status_history;
alter table public.task_status_history rename column changed_at to created_at;
alter index public.history_task_time_idx rename to task_status_history_task_time_idx;

drop function public.transition_task(uuid, public.task_status, text);

create or replace function public.enforce_task_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  role_now public.app_role := public.current_app_role();
  note text;
begin
  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.site_id is distinct from old.site_id
     or new.assignee_id is distinct from old.assignee_id
     or new.author_id is distinct from old.author_id
     or new.created_at is distinct from old.created_at then
    if role_now <> 'manager' then
      raise exception 'Only managers may edit task details';
    end if;
  end if;

  if new.status is distinct from old.status then
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

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.enforce_task_creation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_app_role() <> 'manager' then
    raise exception 'Only managers may create tasks';
  end if;
  new.author_id := (select auth.uid());
  new.status := 'new';
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

create or replace function public.change_task_status(
  p_task_id uuid,
  p_new_status public.task_status,
  p_comment text default null
) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform set_config('app.transition_comment', coalesce(p_comment, ''), true);
  update public.tasks set status = p_new_status where id = p_task_id;
  if not found then
    raise exception 'Task not found or access denied';
  end if;
end;
$$;
revoke all on function public.change_task_status(uuid, public.task_status, text) from public;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;

drop policy if exists "profiles visible to posters and self" on public.profiles;
create policy "profiles visible to managers and self" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.current_app_role() = 'manager');

drop policy if exists "poster site management" on public.sites;
create policy "manager site management" on public.sites for all to authenticated
  using (public.current_app_role() = 'manager')
  with check (public.current_app_role() = 'manager');

drop policy if exists "visible tasks" on public.tasks;
create policy "visible tasks" on public.tasks for select to authenticated
  using (public.current_app_role() = 'manager' or assignee_id = (select auth.uid()));

drop policy if exists "poster creates tasks" on public.tasks;
create policy "manager creates tasks" on public.tasks for insert to authenticated
  with check (public.current_app_role() = 'manager' and author_id = (select auth.uid()));

drop policy if exists "poster or assignee updates" on public.tasks;
create policy "manager or assignee updates" on public.tasks for update to authenticated
  using (public.current_app_role() = 'manager' or assignee_id = (select auth.uid()))
  with check (public.current_app_role() = 'manager' or assignee_id = (select auth.uid()));

drop policy if exists "poster deletes tasks" on public.tasks;
create policy "manager deletes tasks" on public.tasks for delete to authenticated
  using (public.current_app_role() = 'manager');

drop policy if exists "visible history" on public.task_status_history;
create policy "visible task status history" on public.task_status_history for select to authenticated
  using (public.current_app_role() = 'manager' or exists (
    select 1 from public.tasks t
    where t.id = task_status_history.task_id and t.assignee_id = (select auth.uid())
  ));

revoke insert, update, delete on public.task_status_history from anon, authenticated;
grant select on public.task_status_history to authenticated;
