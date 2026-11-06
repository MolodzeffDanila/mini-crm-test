import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';

export interface UseSelectionResult {
  selected: string;
  selectObject: (objectId: string) => void;
}

/**
 * Выбранный объект рабочего пространства.
 * Доступен feature-хукам (tasks, objects) через колбэк selectObject.
 */
export function useSelection(session: Session | null): UseSelectionResult {
  const [selected, setSelected] = useState('');

  // Сброс при выходе (adjust state during render)
  const [prevSession, setPrevSession] = useState(session);
  if (session !== prevSession) {
    setPrevSession(session);
    if (!session) setSelected('');
  }

  return { selected, selectObject: setSelected };
}
