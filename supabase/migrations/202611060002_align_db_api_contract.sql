-- Bring the existing schema in line with CONTRACT.md and DB-API.md.
-- All changes are metadata/value renames; existing task and history rows are retained.

alter type public.app_role rename value 'poster' to 'manager';
alter type public.task_status rename value 'rework' to 'revision';

-- Both API specifications name the entity "objects" and the task FK "object_id".
alter table public.sites rename to objects;
alter table public.tasks rename column site_id to object_id;
alter index public.tasks_site_id_idx rename to tasks_object_id_idx;
alter table public.tasks alter column description drop not null;

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

  new.updated_at := now();
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

create or replace function public.change_task_status(
  p_task_id uuid,
  p_new_status public.task_status,
  p_comment text default null
) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform set_config('app.task_status_change_rpc', 'on', true);
  perform set_config('app.transition_comment', coalesce(p_comment, ''), true);
  update public.tasks set status = p_new_status where id = p_task_id;
  if not found then
    raise exception 'Task not found or access denied';
  end if;
end;
$$;
revoke all on function public.change_task_status(uuid, public.task_status, text) from public, anon;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;

-- Rebind the three lifecycle triggers explicitly to the renamed schema objects.
drop trigger if exists task_creation_rules on public.tasks;
create trigger task_creation_rules before insert on public.tasks
  for each row execute function public.enforce_task_creation();
drop trigger if exists task_update_rules on public.tasks;
create trigger task_update_rules before update on public.tasks
  for each row execute function public.enforce_task_update();
drop trigger if exists task_creation_history on public.tasks;
create trigger task_creation_history after insert on public.tasks
  for each row execute function public.record_task_creation();

drop policy if exists "profiles visible to posters and self" on public.profiles;
create policy "profiles visible to managers and self" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.current_app_role() is not distinct from 'manager');

drop policy if exists "poster site management" on public.objects;
drop policy if exists "executors see assigned sites" on public.objects;
create policy "manager object management" on public.objects for all to authenticated
  using (public.current_app_role() is not distinct from 'manager')
  with check (public.current_app_role() is not distinct from 'manager');
create policy "executors see assigned objects" on public.objects for select to authenticated
  using (public.current_app_role() is not distinct from 'executor' and exists (
    select 1 from public.tasks t
    where t.object_id = objects.id and t.assignee_id = (select auth.uid())
  ));

drop policy if exists "visible tasks" on public.tasks;
create policy "visible tasks" on public.tasks for select to authenticated
  using (public.current_app_role() is not distinct from 'manager'
    or (public.current_app_role() is not distinct from 'executor' and assignee_id = (select auth.uid())));

drop policy if exists "poster creates tasks" on public.tasks;
create policy "manager creates tasks" on public.tasks for insert to authenticated
  with check (public.current_app_role() is not distinct from 'manager' and author_id = (select auth.uid()));

drop policy if exists "poster or assignee updates" on public.tasks;
create policy "manager or assignee updates" on public.tasks for update to authenticated
  using (public.current_app_role() is not distinct from 'manager'
    or (public.current_app_role() is not distinct from 'executor' and assignee_id = (select auth.uid())))
  with check (public.current_app_role() is not distinct from 'manager'
    or (public.current_app_role() is not distinct from 'executor' and assignee_id = (select auth.uid())));

drop policy if exists "poster deletes tasks" on public.tasks;
create policy "manager deletes tasks" on public.tasks for delete to authenticated
  using (public.current_app_role() is not distinct from 'manager');

drop policy if exists "visible history" on public.task_status_history;
create policy "visible task status history" on public.task_status_history for select to authenticated
  using (public.current_app_role() is not distinct from 'manager'
    or (public.current_app_role() is not distinct from 'executor' and exists (
    select 1 from public.tasks t
    where t.id = task_status_history.task_id and t.assignee_id = (select auth.uid())
  )));

revoke insert, update, delete on public.task_status_history from public, anon, authenticated;
grant select on public.task_status_history to authenticated;
