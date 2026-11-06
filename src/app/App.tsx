
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Brand } from '../components/Brand';
import { TaskCard } from '../components/TaskCard';
import { TaskForm } from '../components/TaskForm';
import { changeTaskStatus, createTask, deleteTask, updateTask } from '../entities/task/api/task.api';
import type { Role, Site, Task, TaskStatus } from '../types/domain';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  const [profile, setProfile] = useState<{
    role: Role;
    display_name: string;
  } | null>(null);

  const [sites, setSites] = useState<Site[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [executors, setExecutors] = useState<{ id: string }[]>([]);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [savingTask, setSavingTask] = useState(false);

  const [selected, setSelected] = useState('');
  const [loadedFor, setLoadedFor] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Auth session
  useEffect(() => {
    if (!supabase) return;

    let live = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      if (!nextSession) {
        setProfile(null);
        setSites([]);
        setTasks([]);
        setExecutors([]);
        setSelected('');
        setLoadedFor('');
        setProfileError(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!live) return;
      if (sessionError) {
        console.error('Session restore error:', sessionError);
        setError('Не удалось восстановить сессию. Войдите снова.');
      }
      setSession(data.session);
      setAuthLoading(false);
    }).catch((sessionError: unknown) => {
      if (!live) return;
      console.error('Session restore error:', sessionError);
      setError('Не удалось восстановить сессию. Войдите снова.');
      setAuthLoading(false);
    });

    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load profile, objects and tasks
  useEffect(() => {

  if (!session || !supabase) return;

    let live = true;

    void (async () => {
      const [p, s, t, e] = await Promise.all([
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single(),

        supabase
          .from('objects')
          .select('id, name, address')
          .order('id', { ascending: false }),

        supabase
          .from('tasks')
          .select(
            'id, title, description, status, object_id, assignee_id, created_at',
          )
          .order('created_at', { ascending: false }),

        supabase.from('profiles').select('id').eq('role', 'executor'),
      ]);

      if (!live) return;

      if (p.error || !p.data || (p.data.role !== 'manager' && p.data.role !== 'executor')) {
        console.error('Profile loading error:', p.error);
        setProfile(null);
        setProfileError(true);
        setError('Не удалось определить роль пользователя. Обратитесь к администратору.');
        setLoadedFor(session.user.id);
        return;
      }

      setProfileError(false);
      setError('');

      if (s.error || t.error || e.error) {
        console.error('Supabase loading error:', {
          objects: s.error,
          tasks: t.error,
          executors: e.error,
        });

        setError('Не удалось загрузить данные. Проверьте права доступа.');
      }

      setProfile({
        role: p.data.role as Role,
        display_name: session.user.email ?? '',
      });

      setSites((s.data ?? []) as Site[]);

      setTasks((t.data ?? []) as Task[]);
      setExecutors(e.data ?? []);

      if (s.data?.length) {
        setSelected((current) => current || s.data[0].id);
      }

      setLoadedFor(session.user.id);
    })();

    return () => {
      live = false;
    };
  }, [session]);

  // Sign in
  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!supabase) return;

    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Sign in error:', error);
        setError('Не удалось войти. Проверьте email и пароль.');
      }
    } catch (signInError) {
      console.error('Sign in error:', signInError);
      setError('Не удалось войти. Проверьте email и пароль.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        setError('Не удалось выйти из системы. Повторите попытку.');
      }
    } catch (signOutError) {
      console.error('Sign out error:', signOutError);
      setError('Не удалось выйти из системы. Повторите попытку.');
    } finally {
      setBusy(false);
    }
  }

  // Change task status
  async function act(task: Task, status: TaskStatus) {
    if (!supabase) return;

    const comment =
      status === 'revision'
        ? window.prompt('Комментарий для доработки (обязателен):')
        : null;

    if (status === 'revision' && !comment?.trim()) return;

    const { error } = await changeTaskStatus(task.id, status, comment?.trim() || null);

    if (error) {
      console.error('Status transition error:', error);
      setError(
        'Переход не выполнен: проверьте права и допустимость действия.',
      );
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select(
        'id, title, description, status, object_id, assignee_id, created_at',
      )
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Tasks reload error:', fetchError);
      setError(
        'Статус изменён, но не удалось обновить список задач.',
      );
      return;
    }

    setTasks((data ?? []) as Task[]);

    setError('');
  }

  async function saveTask(input: import('../entities/task/api/task.api').TaskInput) {
    if (!session) return;
    setSavingTask(true);
    const result = editingTask
      ? await updateTask(editingTask.id, input)
      : await createTask(input, session.user.id);
    if (result.error) {
      console.error('Task save error:', result.error);
      setError('Не удалось сохранить задачу. Проверьте введённые данные и права доступа.');
      setSavingTask(false);
      return;
    }

    const { data, error: reloadError } = await supabase!
      .from('tasks')
      .select('id, title, description, status, object_id, assignee_id, created_at')
      .order('created_at', { ascending: false });
    if (reloadError) {
      console.error('Tasks reload error:', reloadError);
      setError('Задача сохранена, но список не удалось обновить.');
      setSavingTask(false);
      return;
    }

    setTasks((data ?? []) as Task[]);
    setSelected(input.object_id);
    setTaskFormOpen(false);
    setEditingTask(undefined);
    setError('');
    setSavingTask(false);
  }

  async function removeTask(task: Task) {
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    const { error } = await deleteTask(task.id);
    if (error) {
      console.error('Task delete error:', error);
      setError('Не удалось удалить задачу. Проверьте права доступа.');
      return;
    }
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setError('');
  }

  // Supabase configuration
  if (!isSupabaseConfigured) {
    return (
      <main className="setup">
        <Brand />
        <span className="eyebrow">НАСТРОЙКА ПРОЕКТА</span>
        <h1>Подключите Supabase</h1>
        <p>
          Скопируйте <code>.env.example</code> в <code>.env</code>,
          укажите URL проекта и публичный ключ, затем примените
          миграцию из <code>supabase/migrations</code>.
        </p>
      </main>
    );
  }

  if (authLoading) {
    return <main className="setup"><Brand /><p>Проверяем сессию…</p></main>;
  }

  // Login
  if (!session) {
    return (
      <main className="login">
        <section className="hero">
          <Brand />

          <div>
            <span className="eyebrow">
              РАБОТА НА ОБЪЕКТЕ — ПОД КОНТРОЛЕМ
            </span>

            <h1>
              Все задачи.
              <br />
              В одном месте.
            </h1>

            <p>
              Понятный рабочий ритм для команды и руководителя.
            </p>
          </div>

          <small>ОБЪЕКТЫ · ЗАДАЧИ · РЕЗУЛЬТАТ</small>
        </section>

        <form className="login-form" onSubmit={signIn}>
          <span className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</span>

          <h2>С возвращением</h2>
          <p>Войдите, чтобы продолжить работу.</p>

          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <div className="error">{error}</div>}

          <button className="primary" disabled={busy}>
            {busy ? 'Входим…' : 'Войти в систему'} →
          </button>

          <small>Доступ выдаёт руководитель. Регистрация закрыта.</small>
        </form>
      </main>
    );
  }

  // Loading
  if (loadedFor !== session.user.id) {
    return (
      <main className="setup">
        <Brand />
        <p>Загружаем рабочее пространство…</p>
      </main>
    );
  }

  if (profileError || !profile) {
    return (
      <main className="setup">
        <Brand />
        <h1>Нет доступа к рабочему пространству</h1>
        <p>{error || 'Профиль с допустимой ролью не найден.'}</p>
        <button className="primary" onClick={signOut} disabled={busy}>Выйти</button>
      </main>
    );
  }

  // Role-based data
  const mine = profile?.role === 'executor';

  const visibleTasks = mine
    ? tasks.filter((task) => task.assignee_id === session.user.id)
    : tasks;

  const allowedSites = new Set(
    visibleTasks.map((task) => task.object_id),
  );

  const visibleSites = mine
    ? sites.filter((site) => allowedSites.has(site.id))
    : sites;

  const site =
    visibleSites.find((site) => site.id === selected) ??
    visibleSites[0];

  const siteTasks = visibleTasks.filter(
    (task) => task.object_id === site?.id,
  );

  return (
    <div className="shell">
      <aside>
        <Brand />

        <p className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</p>

        <div className="nav active">
          ▦ {mine ? 'Мои задачи' : 'Объекты'}
          <span>{visibleSites.length}</span>
        </div>

        <div className="user">
          <b>{profile?.display_name ?? session.user.email}</b>

          <small>
            {mine ? 'Исполнитель' : 'Менеджер'}
          </small>

          <button onClick={signOut} disabled={busy}>
            {busy ? 'Выходим…' : 'Выйти ↗'}
          </button>
        </div>
      </aside>

      <main className="main">
        <header>
          Рабочее пространство /{' '}
          <b>{mine ? 'Мои задачи' : 'Объекты'}</b>

          <span>● Рабочий день</span>
        </header>

        <section className="content">
          <div className="heading">
            <div>
              <span className="eyebrow">ОБЗОР РАБОТ</span>

              <h1>{mine ? 'Мои задачи' : 'Объекты'}</h1>

              <p>
                План работ и текущий статус по каждому объекту.
              </p>
            </div>

            {profile?.role === 'manager' && (
              <button
                className="primary"
                onClick={() => { setEditingTask(undefined); setTaskFormOpen(true); }}
              >
                ＋ Новая задача
              </button>
            )}
          </div>

          {error && (
            <div className="error banner">
              {error}

              <button onClick={() => setError('')}>×</button>
            </div>
          )}

          <div className="stats">
            <div>
              Всего задач
              <strong>{visibleTasks.length}</strong>
            </div>

            <div>
              В работе
              <strong>
                {
                  visibleTasks.filter((task) =>
                    ['new', 'in_progress', 'revision'].includes(
                      task.status,
                    ),
                  ).length
                }
              </strong>
            </div>

            <div>
              На проверке
              <strong>
                {
                  visibleTasks.filter(
                    (task) => task.status === 'review',
                  ).length
                }
              </strong>
            </div>
          </div>

          {visibleSites.length === 0 ? (
            <div className="empty">
              <h2>Объектов пока нет</h2>

              <p>
                {mine
                  ? 'Здесь появятся объекты с назначенными вам задачами.'
                  : 'Создайте первый объект, чтобы начать работу.'}
              </p>
            </div>
          ) : (
            <div className="columns">
              <section className="panel">
                <h2>Список объектов</h2>

                {visibleSites.map((site) => (
                  <button
                    className={`site ${
                      site.id === selected ? 'chosen' : ''
                    }`}
                    key={site.id}
                    onClick={() => setSelected(site.id)}
                  >
                    <b>{site.name}</b>
                    <small>{site.address}</small>

                    <small>
                      {
                        visibleTasks.filter(
                          (task) => task.object_id === site.id,
                        ).length
                      }{' '}
                      задач
                    </small>
                  </button>
                ))}
              </section>

              <section className="panel detail">
                <span className="eyebrow">ОБЪЕКТ</span>

                <h2>{site?.name}</h2>
                <p>{site?.address}</p>

                <hr />

                <b>Задачи объекта {siteTasks.length}</b>

                {siteTasks.length === 0 ? (
                  <div className="empty">
                    <p>Задач пока нет</p>
                  </div>
                ) : (
                  siteTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      role={profile?.role}
                      act={act}
                      onEdit={(task) => { setEditingTask(task); setTaskFormOpen(true); }}
                      onDelete={removeTask}
                    />
                  ))
                )}
              </section>
            </div>
          )}

          <footer>
            Доступ к данным защищён политиками Supabase · Прораб ©
            2026
          </footer>
        </section>
      </main>
      {taskFormOpen && profile?.role === 'manager' && (
        <TaskForm
          task={editingTask}
          sites={sites}
          executors={executors}
          initialObjectId={selected}
          busy={savingTask}
          onSave={saveTask}
          onCancel={() => { setTaskFormOpen(false); setEditingTask(undefined); }}
        />
      )}
    </div>
  );
}
