import { supabase } from '../../../lib/supabase'

export async function getTaskHistory(taskId: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
    .from('task_status_history')
    .select('id, task_id, changed_by, from_status, to_status, comment, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
}
