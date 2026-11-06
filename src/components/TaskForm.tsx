import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Site, Task } from '../types/domain'
import type { TaskInput } from '../entities/task/api/task.api'
import type { Executor } from '../features/tasks'
import './TaskForm.css'

type TaskFormProps = {
  task?: Task
  sites: Site[]
  executors: Executor[]
  initialObjectId: string
  busy: boolean
  onSave: (input: TaskInput) => Promise<void>
  onCancel: () => void
}

export function TaskForm({
  task,
  sites,
  executors,
  initialObjectId,
  busy,
  onSave,
  onCancel,
}: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [objectId, setObjectId] = useState(task?.object_id ?? initialObjectId)
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? '')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSave({
      title: title.trim(),
      description: description.trim() || null,
      object_id: objectId,
      assignee_id: assigneeId,
    })
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel()
    }}>
      <section className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="task-form-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">ЗАДАЧА НА ОБЪЕКТЕ</span>
            <h2 id="task-form-title">{task ? 'Редактировать задачу' : 'Новая задача'}</h2>
          </div>
          <button type="button" className="dialog-close" onClick={onCancel} disabled={busy} aria-label="Закрыть">×</button>
        </div>

        <form className="task-form" onSubmit={submit}>
          <label>
            Название задачи
            <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
          </label>
          <label>
            Описание
            <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label>
            Объект
            <select required value={objectId} onChange={(event) => setObjectId(event.target.value)}>
              <option value="" disabled>Выберите объект</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.name} — {site.address}</option>)}
            </select>
          </label>
          <label>
            Исполнитель
            <select required value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="" disabled>Выберите исполнителя</option>
              {executors.map((executor) => <option key={executor.id} value={executor.id}>{executor.display_name || executor.id}</option>)}
            </select>
          </label>
          <div className="dialog-actions">
            <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Отмена</button>
            <button className="primary" disabled={busy}>{busy ? 'Сохраняем…' : task ? 'Сохранить' : 'Создать задачу'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
