import { useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';

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

  return { mine, visibleTasks, visibleSites, site, siteTasks };
}
