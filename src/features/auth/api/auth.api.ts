import { supabase } from '../../../lib/supabase';
import type { Session, Subscription } from '@supabase/supabase-js';

import type { Role } from '../../../types/domain';

function getClient() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

// Подписка на изменения сессии (см. CONTRACT.md, раздел 4.3)
export function subscribeToAuthState(
  onChange: (session: Session | null) => void,
): Subscription {
  const client = getClient();
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => onChange(session));
  return subscription;
}

// Восстановление сессии при запуске
export async function fetchSession(): Promise<Session | null> {
  const { data, error } = await getClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

// Вход по email и паролю (см. CONTRACT.md, раздел 4.1)
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

// Выход из системы (см. CONTRACT.md, раздел 4.2)
export async function signOutUser(): Promise<void> {
  const { error } = await getClient().auth.signOut();
  if (error) throw error;
}

// Профиль и роль текущего пользователя (см. CONTRACT.md, раздел 4.5)
export async function fetchProfileRole(userId: string): Promise<Role | null> {
  const { data, error } = await getClient()
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data || (data.role !== 'manager' && data.role !== 'executor')) {
    return null;
  }

  return data.role;
}
