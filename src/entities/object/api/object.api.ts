import { supabase } from '../../../lib/supabase'
import type { Site } from '../../../types/domain'

export type ObjectInput = Pick<Site, 'name' | 'address'>

function getClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export async function getObjects() {
  return getClient().from('objects').select('id, name, address').order('id', { ascending: false })
}

export async function createObject(input: ObjectInput) {
  return getClient().from('objects').insert(input).select('id, name, address').single()
}

export async function updateObject(id: string, input: ObjectInput) {
  return getClient().from('objects').update(input).eq('id', id).select('id, name, address').single()
}

export async function deleteObject(id: string) {
  return getClient().from('objects').delete().eq('id', id)
}
