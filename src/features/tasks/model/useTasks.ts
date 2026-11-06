import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../../../lib/supabase';
import {
  changeTaskStatus,
  createTask,
  deleteTask,
  updateTask,
} from '../../../entities/task/api/task.api';
import type { TaskInput } from '../../../entities/task/api/task.api';
import type { Task, TaskStatus } from '../../../types/domain';

const taskFields =
  'id, title, description, status, object_id, assignee_id, author_id, created_at';

export interface UseTasksDeps {
  /** Выбрать объект после сохранения задачи */
  selectObject?: (objectId: string) => void;
}

export interface UseTasksResult {
  tasks: Task[];
  executors: { id: string }[];
  tasksLoaded: boolean;
  saving: boolean;
  tasksError: string;
  clearTasksError: () => void;
  changeStatus: (task: Task, status: TaskStatus, comment?: string) => Promise<void>;
  saveTask: (
    input: TaskInput,
    editingTaskId?: string,
  ) => Promise<{ ok: boolean; objectId?: string }>;
  removeTask: (taskId: string) => Promise<boolean>;
  // Форма задачи
  taskFormOpen: boolean;
  editingTask: Task | undefined;
  openTaskForm: (task?: Task) => void;
  closeTaskForm: () => void;
  handleSaveTask: (input: TaskInput) => Promise<void>;
  handleRemoveTask: (task: Task) => Promise<void>;
}

/**
 * Управляет задачами рабочего пространства: загрузка с учётом RLS,
 * список исполнителей, создание/редактирование/удаление (только manager)
 * и смена статуса исключительно через RPC change_task_status
 * (см. docs/CONTRACT.md, разделы 6–7).
 */
export function useTasks(session: Session | null, deps: UseTasksDeps = {}): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [executors, setExecutors] = useState<{ id: string }[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tasksError, setTasksError] = useState('');

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();

  // Сброс при выходе (adjust state during render)
  const [prevSession, setPrevSession] = useState(session);
  if (session !== prevSession) {
    setPrevSession(session);
    if (!session) {
      setTasks([]);
      setExecutors([]);
      setTasksLoaded(false);
      setTasksError('');
      setTaskFormOpen(false);
      setEditingTask(undefined);
    }
  }

  // Загрузка задач и списка исполнителей
  useEffect(() => {
    if (!session || !supabase) return;

    let live = true;

    void (async () => {
      const [t, e] = await Promise.all([
        supabase
          .from('tasks')
          .select(taskFields)
          .order('created_at', { ascending: false }),

        supabase.from('profiles').select('id').eq('role', 'executor'),
      ]);

      if (!live) return;

      if (t.error || e.error) {
        console.error('Supabase loading error:', {
          tasks: t.error,
          executors: e.error,
        });

        setTasksError('Не удалось загрузить данные. Проверьте права доступа.');
      } else {
        setTasksError('');
      }

      setTasks((t.data ?? []) as Task[]);
      setExecutors(e.data ?? []);
      setTasksLoaded(true);
    })();

    return () => {
      live = false;
    };
  }, [session]);

  // Перечитывает список задач (RLS сама ограничивает выборку)
  async function reloadTasks(onErrorMessage: string): Promise<boolean> {
    if (!supabase) return false;

    const { data, error } = await supabase
      .from('tasks')
      .select(taskFields)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Tasks reload error:', error);
      setTasksError(onErrorMessage);
      return false;
    }

    setTasks((data ?? []) as Task[]);
    setTasksError('');
    return true;
  }

  // Смена статуса задачи через RPC (см. docs/CONTRACT.md, раздел 7)
  async function changeStatus(task: Task, status: TaskStatus, comment?: string) {
    if (status === 'revision' && !comment?.trim()) return;

    const { error } = await changeTaskStatus(task.id, status, comment?.trim() || null);

    if (error) {
      console.error('Status transition error:', error);
      setTasksError('Переход не выполнен: проверьте права и допустимость действия.');
      return;
    }

    await reloadTasks('Статус изменён, но не удалось обновить список задач.');
  }

  // Создание или обновление задачи (только manager)
  async function saveTask(
    input: TaskInput,
    editingTaskId?: string,
  ): Promise<{ ok: boolean; objectId?: string }> {
    if (!session) return { ok: false };

    setSaving(true);
    const result = editingTaskId
      ? await updateTask(editingTaskId, input)
      : await createTask(input, session.user.id);

    if (result.error) {
      console.error('Task save error:', result.error);
      setTasksError('Не удалось сохранить задачу. Проверьте введённые данные и права доступа.');
      setSaving(false);
      return { ok: false };
    }

    const reloaded = await reloadTasks('Задача сохранена, но список не удалось обновить.');
    setSaving(false);

    if (!reloaded) return { ok: false };

    return { ok: true, objectId: input.object_id };
  }

  // Удаление задачи (только manager)
  async function removeTask(taskId: string): Promise<boolean> {
    const { error } = await deleteTask(taskId);

    if (error) {
      console.error('Task delete error:', error);
      setTasksError('Не удалось удалить задачу. Проверьте права доступа.');
      return false;
    }

    setTasks((current) => current.filter((item) => item.id !== taskId));
    setTasksError('');
    return true;
  }

  // Форма задачи

  function openTaskForm(task?: Task) {
    setEditingTask(task);
    setTaskFormOpen(true);
  }

  function closeTaskForm() {
    setTaskFormOpen(false);
    setEditingTask(undefined);
  }

  // Сохранение задачи из формы (создание или редактирование)
  async function handleSaveTask(input: TaskInput) {
    const result = await saveTask(input, editingTask?.id);
    if (result.ok && result.objectId) {
      deps.selectObject?.(result.objectId);
      closeTaskForm();
    }
  }

  // Удаление задачи с подтверждением
  async function handleRemoveTask(task: Task) {
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    await removeTask(task.id);
  }

  return {
    tasks,
    executors,
    tasksLoaded,
    saving,
    tasksError,
    clearTasksError: () => setTasksError(''),
    changeStatus,
    saveTask,
    removeTask,
    taskFormOpen,
    editingTask,
    openTaskForm,
    closeTaskForm,
    handleSaveTask,
    handleRemoveTask,
  };
}
