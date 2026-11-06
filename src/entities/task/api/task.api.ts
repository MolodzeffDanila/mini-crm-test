import { supabase } from '../../../lib/supabase'
import type { TaskStatus } from '../../../types/domain'

export type TaskInput = {
  title: string
  description: string | null
  object_id: string
  assignee_id: string
}

const taskFields =
  'id, title, description, object_id, assignee_id, status, created_at'

function getClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export async function createTask(input: TaskInput, authorId: string) {
  return getClient()
    .from('tasks')
    .insert({ ...input, author_id: authorId, status: 'new' })
    .select(taskFields)
    .single()
}

export async function updateTask(taskId: string, input: TaskInput) {
  return getClient()
    .from('tasks')
    .update(input)
    .eq('id', taskId)
    .select(taskFields)
    .single()
}

export async function deleteTask(taskId: string) {
  return getClient().from('tasks').delete().eq('id', taskId)
}

export async function changeTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  comment?: string | null,
) {
  return getClient().rpc('change_task_status', {
    p_task_id: taskId,
    p_new_status: newStatus,
    p_comment: comment ?? null,
  })
}
