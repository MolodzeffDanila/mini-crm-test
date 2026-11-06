import { TaskCard } from '../../../components/TaskCard';
import './MyTasksBoard.css';
import { taskStatusLabels } from '../../../types/domain';
import type { Site } from '../../../types/domain';
import type { UseTasksResult } from '../model/useTasks';
import type { UseWorkspaceResult } from '../../workspace';

interface MyTasksBoardProps {
  workspace: UseWorkspaceResult;
  taskState: UseTasksResult;
  sites: Site[];
  selectedTaskId: string;
  onSelectTask: (taskId: string) => void;
}

export function MyTasksBoard({ workspace, taskState, sites, selectedTaskId, onSelectTask }: MyTasksBoardProps) {
  const { visibleTasks } = workspace;

  return (
    <div className="columns">
      <section className="panel">
        <h2>Мои задачи</h2>
        {visibleTasks.length === 0 ? <div className="empty"><p>Назначенных задач пока нет.</p></div> : visibleTasks.map((task) => {
          const taskObject = sites.find((item) => item.id === task.object_id);
          return <button className={`task-link ${selectedTaskId === task.id ? 'chosen' : ''}`} key={task.id} onClick={() => onSelectTask(task.id)}>
            <b>{task.title}</b><small>{taskObject?.name ?? 'Объект'} · {taskStatusLabels[task.status]}</small>
          </button>;
        })}
      </section>
      <section className="panel detail">
        {(() => {
          const task = visibleTasks.find((item) => item.id === selectedTaskId) ?? visibleTasks[0];
          const taskObject = sites.find((item) => item.id === task?.object_id);
          return task && taskObject
            ? <TaskCard task={task} object={taskObject} role="executor" act={taskState.changeStatus} />
            : <div className="empty"><p>Выберите задачу из списка.</p></div>;
        })()}
      </section>
    </div>
  );
}
