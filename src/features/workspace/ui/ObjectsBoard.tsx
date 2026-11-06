import { TaskCard } from '../../../components/TaskCard';
import type { UseObjectsResult } from '../../objects';
import type { UseTasksResult } from '../../tasks';
import type { UseSelectionResult } from '../model/useSelection';
import type { UseWorkspaceResult } from '../model/useWorkspace';

interface ObjectsBoardProps {
  workspace: UseWorkspaceResult;
  objectState: UseObjectsResult;
  taskState: UseTasksResult;
  selection: UseSelectionResult;
  isManager: boolean;
}

export function ObjectsBoard({ workspace, objectState, taskState, selection, isManager }: ObjectsBoardProps) {
  const { visibleSites, visibleTasks, site, siteTasks } = workspace;

  if (visibleSites.length === 0) {
    return (
      <div className="empty">
        <h2>Объектов пока нет</h2>

        <p>
          {workspace.mine
            ? 'Здесь появятся объекты с назначенными вам задачами.'
            : 'Создайте первый объект, чтобы начать работу.'}
        </p>
      </div>
    );
  }

  return (
    <div className="columns">
      <section className="panel">
        <h2>Список объектов</h2>

        {visibleSites.map((item) => (
          <div className="site-row" key={item.id}>
            <button className={`site ${item.id === selection.selected ? 'chosen' : ''}`} onClick={() => selection.selectObject(item.id)}>
              <b>{item.name}</b><small>{item.address}</small>
              <small>{visibleTasks.filter((task) => task.object_id === item.id).length} задач</small>
            </button>
            {isManager && <div className="object-actions">
              <button aria-label={`Редактировать объект ${item.name}`} onClick={() => objectState.openObjectForm(item)}>Изменить</button>
              <button aria-label={`Удалить объект ${item.name}`} onClick={() => void objectState.handleRemoveObject(item)}>Удалить</button>
            </div>}
          </div>
        ))}
      </section>

      <section className="panel detail">
        <span className="eyebrow">ОБЪЕКТ</span>

        <h2>{site?.name}</h2>
        <p>{site?.address}</p>

        <hr />

        <b>Задачи объекта {siteTasks.length}</b>

        {siteTasks.length === 0 ? (
          <div className="empty">
            <p>Задач пока нет</p>
          </div>
        ) : (
          siteTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              object={site!}
              role={isManager ? 'manager' : 'executor'}
              act={taskState.changeStatus}
              onEdit={taskState.openTaskForm}
              onDelete={taskState.handleRemoveTask}
            />
          ))
        )}
      </section>
    </div>
  );
}
