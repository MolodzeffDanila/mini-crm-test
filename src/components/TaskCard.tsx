import { useEffect, useState } from 'react'
import type { Role, Site, Task, TaskStatus } from '../types/domain'
import { taskStatusLabels } from '../types/domain'
import type { TaskStatusHistory } from '../types/domain'
import { getTaskHistory } from '../entities/task/api/task-history.api'
import './TaskCard.css'

type TaskAction = { status: TaskStatus; label: string }

type TaskCardProps = {
  task: Task
  object: Site
  role?: Role
  act: (task: Task, status: TaskStatus) => void
  onEdit?: (task: Task) => void
  onDelete?: (task: Task) => void
}

export function TaskCard({ task, object, role, act, onEdit, onDelete }: TaskCardProps) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<TaskStatusHistory[]>([])
  const [historyError, setHistoryError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    if (!historyOpen) return
    let active = true
    void getTaskHistory(task.id).then(({ data, error }) => {
      if (!active) return
      setHistoryLoading(false)
      if (error) {
        setHistoryError('Не удалось загрузить историю изменений.')
        return
      }
      setHistory((data ?? []) as TaskStatusHistory[])
      setHistoryError('')
    }).catch((error: unknown) => {
      if (!active) return
      setHistoryLoading(false)
      console.error('Task history error:', error)
      setHistoryError('Не удалось загрузить историю изменений.')
    })
    return () => { active = false }
  }, [historyOpen, task.id, task.status])

  let actions: TaskAction[] = []
  if (role === 'executor') {
    if (task.status === 'new' || task.status === 'revision') {
      actions = [{ status: 'in_progress', label: 'Взять в работу' }]
    } else if (task.status === 'in_progress') {
      actions = [{ status: 'review', label: 'На проверку' }]
    }
  } else if (role === 'manager' && task.status === 'review') {
    actions = [
      { status: 'accepted', label: 'Принять' },
      { status: 'revision', label: 'Вернуть на доработку' },
    ]
  }

  return (
    <article className="task">
      <span className={`status ${task.status}`}>● {taskStatusLabels[task.status]}</span>
      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
      <dl className="task-details">
        <div><dt>ID задачи</dt><dd>{task.id}</dd></div>
        <div><dt>Объект</dt><dd>{object.name} · {object.address}</dd></div>
        <div><dt>Исполнитель</dt><dd>{task.assignee_id ?? 'Не назначен'}</dd></div>
        <div><dt>Автор</dt><dd>{task.author_id}</dd></div>
        <div><dt>Создана</dt><dd>{new Date(task.created_at).toLocaleString('ru-RU')}</dd></div>
      </dl>
      <button className="history-toggle" onClick={() => { setHistoryOpen((open) => !open); setHistoryLoading(!historyOpen); }}>
        {historyOpen ? 'Скрыть историю' : 'История изменений'}
      </button>
      {historyOpen && <div className="history-list" aria-live="polite">
        {historyLoading && <small>Загружаем историю…</small>}
        {historyError && <p className="error">{historyError}</p>}
        {!historyError && history.length === 0 && <small>История пока пуста.</small>}
        {history.map((entry) => <div className="history-entry" key={entry.id}>
          <b>{entry.from_status ? taskStatusLabels[entry.from_status] : 'Создана'} → {taskStatusLabels[entry.to_status]}</b>
          <small>{entry.changed_by} · {new Date(entry.created_at).toLocaleString('ru-RU')}</small>
          {entry.comment && <p>{entry.comment}</p>}
        </div>)}
      </div>}
      {(actions.length > 0 || (role === 'manager' && (onEdit || onDelete))) && (
        <div className="actions">
          {actions.map(({ status, label }) => (
            <button
              className={status === 'revision' ? 'secondary' : 'primary'}
              key={status}
              onClick={() => act(task, status)}
            >
              {label}
            </button>
          ))}
          {role === 'manager' && onEdit && (
            <button className="secondary" onClick={() => onEdit(task)}>Редактировать</button>
          )}
          {role === 'manager' && onDelete && (
            <button className="danger" onClick={() => onDelete(task)}>Удалить</button>
          )}
        </div>
      )}
    </article>
  )
}
