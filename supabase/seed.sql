-- Demo data for the manually-created accounts described in DB-API.md.
-- Run once, after migrations and profile provisioning, in Supabase SQL Editor.
begin;
do $$
declare
  manager_id uuid;
  executor_one uuid;
  executor_two uuid;
  object_one uuid;
  object_two uuid;
  task_accepted uuid;
  task_revision uuid;
  task_new uuid;
begin
  select p.id into manager_id
  from public.profiles p join auth.users u on u.id = p.id
  where u.email = 'manager@test.com' and p.role = 'manager';
  select p.id into executor_one
  from public.profiles p join auth.users u on u.id = p.id
  where u.email = 'executor1@test.com' and p.role = 'executor';
  select p.id into executor_two
  from public.profiles p join auth.users u on u.id = p.id
  where u.email = 'executor2@test.com' and p.role = 'executor';

  if manager_id is null or executor_one is null or executor_two is null then
    raise exception 'Create manager@test.com and executor1/2@test.com with profiles before seeding';
  end if;

  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  insert into public.objects(name, address)
  values ('Жилой комплекс Северный', 'Москва, ул. Северная, 12') returning id into object_one;
  insert into public.objects(name, address)
  values ('Складской комплекс Восток', 'Москва, ш. Энтузиастов, 48') returning id into object_two;

  insert into public.tasks(title, description, object_id, assignee_id, author_id)
  values ('Подготовить площадку', 'Очистить и разметить участок', object_one, executor_one, manager_id)
  returning id into task_accepted;
  insert into public.tasks(title, description, object_id, assignee_id, author_id)
  values ('Смонтировать ограждение', 'Установить временное ограждение', object_one, executor_two, manager_id)
  returning id into task_revision;
  insert into public.tasks(title, description, object_id, assignee_id, author_id)
  values ('Проверить подъездную дорогу', 'Подготовить отчёт о состоянии покрытия', object_two, executor_one, manager_id)
  returning id into task_new;

  perform set_config('request.jwt.claim.sub', executor_one::text, true);
  perform public.change_task_status(task_accepted, 'in_progress', null);
  perform public.change_task_status(task_accepted, 'review', null);
  perform public.change_task_status(task_new, 'in_progress', null);

  perform set_config('request.jwt.claim.sub', executor_two::text, true);
  perform public.change_task_status(task_revision, 'in_progress', null);
  perform public.change_task_status(task_revision, 'review', null);

  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  perform public.change_task_status(task_accepted, 'accepted', null);
  perform public.change_task_status(task_revision, 'revision', 'Нужно выровнять секцию у въезда');
end;
$$;
commit;
