import type { Role, Task, TaskStatus } from '../types/domain'
import { taskStatusLabels } from '../types/domain'

type TaskAction = { status: TaskStatus; label: string }

type TaskCardProps = {
  task: Task
  role?: Role
  act: (task: Task, status: TaskStatus) => void
  onEdit?: (task: Task) => void
  onDelete?: (task: Task) => void
}

export function TaskCard({ task, role, act, onEdit, onDelete }: TaskCardProps) {
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
      <small>{new Date(task.created_at).toLocaleDateString('ru-RU')}</small>
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
