import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../../../lib/supabase';
import type { AuthProfile } from '../../auth';
import type { Site, Task } from '../../../types/domain';

export type WorkspaceView = 'objects' | 'my_tasks';

export interface UseWorkspaceInput {
  session: Session | null;
  profile: AuthProfile | null;
  selected: string;
  sites: Site[];
  tasks: Task[];
}

export interface UseWorkspaceResult {
  mine: boolean;
  visibleTasks: Task[];
  visibleSites: Site[];
  site: Site | undefined;
  siteTasks: Task[];
  /** id пользователя → отображаемое имя (см. profiles.display_name) */
  userNames: Record<string, string>;
}

/**
 * Ролевая видимость рабочего пространства (см. CONTRACT.md, раздел 11):
 * исполнитель видит только свои задачи и связанные с ними объекты.
 * Фильтрация — только для интерфейса; окончательное ограничение задаёт RLS.
 */
export function useWorkspace({
  session,
  profile,
  selected,
  sites,
  tasks,
}: UseWorkspaceInput): UseWorkspaceResult {
  const userId = session?.user.id ?? null;
  const mine = profile?.role === 'executor';

  // Отображаемые имена пользователей. RLS ограничивает выборку:
  // менеджер получает всех, исполнитель — только себя; недоступные id
  // остаются без подписи и в интерфейсе показывается fallback.
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // Сброс при выходе (adjust state during render)
  const [prevSession, setPrevSession] = useState(session);
  if (session !== prevSession) {
    setPrevSession(session);
    setUserNames({});
  }

  useEffect(() => {
    if (!session || !supabase) return;

    let live = true;

    void supabase
      .from('profiles')
      .select('id, display_name')
      .then(({ data, error }) => {
        if (!live) return;
        if (error) {
          console.error('Profiles loading error:', error);
          return;
        }
        const map: Record<string, string> = {};
        for (const row of data ?? []) {
          map[row.id] = row.display_name || row.id;
        }
        setUserNames(map);
      });

    return () => {
      live = false;
    };
  }, [session]);

  const visibleTasks = useMemo(
    () => (mine && userId ? tasks.filter((task) => task.assignee_id === userId) : tasks),
    [mine, userId, tasks],
  );

  const visibleSites = useMemo(() => {
    if (!mine) return sites;
    const allowed = new Set(visibleTasks.map((task) => task.object_id));
    return sites.filter((site) => allowed.has(site.id));
  }, [mine, sites, visibleTasks]);

  const site = visibleSites.find((item) => item.id === selected) ?? visibleSites[0];
  const siteTasks = visibleTasks.filter((task) => task.object_id === site?.id);

  return { mine, visibleTasks, visibleSites, site, siteTasks, userNames };
}
