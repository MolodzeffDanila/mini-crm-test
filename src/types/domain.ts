export type Role = 'manager' | 'executor'

export type Site = {
  id: string
  name: string
  address: string
}

export type TaskStatus = 'new' | 'in_progress' | 'review' | 'accepted' | 'revision'

export type Task = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  object_id: string
  assignee_id: string | null
  created_at: string
}

export const taskStatusLabels: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  revision: 'На доработке',
}
