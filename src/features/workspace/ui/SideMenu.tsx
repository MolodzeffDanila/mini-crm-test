import { Brand } from '../../../components/Brand';
import './SideMenu.css';
import type { WorkspaceView } from '../model/useWorkspace';

interface SideMenuProps {
  mine: boolean;
  sitesCount: number;
  tasksCount: number;
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  userLabel: string;
  signOutBusy: boolean;
  onSignOut: () => void;
}

export function SideMenu({
  mine,
  sitesCount,
  tasksCount,
  view,
  onViewChange,
  userLabel,
  signOutBusy,
  onSignOut,
}: SideMenuProps) {
  return (
    <aside>
      <Brand />

      <p className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</p>

      <button className={`nav ${view === 'objects' ? 'active' : ''}`} onClick={() => onViewChange('objects')}>
        ▦ Объекты <span>{sitesCount}</span>
      </button>
      {mine && (
        <button className={`nav ${view === 'my_tasks' ? 'active' : ''}`} onClick={() => onViewChange('my_tasks')}>
          ✓ Мои задачи <span>{tasksCount}</span>
        </button>
      )}

      <div className="user">
        <b>{userLabel}</b>

        <small>
          {mine ? 'Исполнитель' : 'Менеджер'}
        </small>

        <button onClick={onSignOut} disabled={signOutBusy}>
          {signOutBusy ? 'Выходим…' : 'Выйти ↗'}
        </button>
      </div>
    </aside>
  );
}
