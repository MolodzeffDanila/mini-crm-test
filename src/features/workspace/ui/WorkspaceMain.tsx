import { TaskForm } from '../../../components/TaskForm';
import { ObjectForm } from '../../../components/ObjectForm';
import type { UseAuthResult } from '../../auth';
import type { UseTasksResult } from '../../tasks';
import { MyTasksBoard } from '../../tasks';
import type { UseObjectsResult } from '../../objects';
import type { UseSelectionResult } from '../model/useSelection';
import type { UseWorkspaceResult, WorkspaceView } from '../model/useWorkspace';
import { ObjectsBoard } from './ObjectsBoard';

interface WorkspaceMainProps {
  auth: UseAuthResult;
  taskState: UseTasksResult;
  objectState: UseObjectsResult;
  workspace: UseWorkspaceResult;
  selection: UseSelectionResult;
  view: WorkspaceView;
  selectedTaskId: string;
  onSelectTask: (taskId: string) => void;
}

export function WorkspaceMain({
  auth,
  taskState,
  objectState,
  workspace,
  selection,
  view,
  selectedTaskId,
  onSelectTask,
}: WorkspaceMainProps) {
  const { mine, visibleTasks } = workspace;
  const isManager = auth.profile?.role === 'manager';
  const showMyTasks = mine && view === 'my_tasks';

  return (
    <>
      <main className="main">
        <header>
          Рабочее пространство /{' '}
          <b>{showMyTasks ? 'Мои задачи' : 'Объекты'}</b>

          <span>● Рабочий день</span>
        </header>

        <section className="content">
          <div className="heading">
            <div>
              <span className="eyebrow">ОБЗОР РАБОТ</span>

              <h1>{showMyTasks ? 'Мои задачи' : 'Объекты'}</h1>

              <p>
                План работ и текущий статус по каждому объекту.
              </p>
            </div>

            {isManager && <div className="heading-actions">
              <button className="secondary" onClick={() => objectState.openObjectForm()}>＋ Новый объект</button>
              <button className="primary" onClick={() => taskState.openTaskForm()} disabled={objectState.sites.length === 0}>＋ Новая задача</button>
            </div>}
          </div>

          {(objectState.objectsError || taskState.tasksError) && (
            <div className="error banner">
              {objectState.objectsError || taskState.tasksError}

              <button onClick={() => { objectState.clearObjectsError(); taskState.clearTasksError(); }}>×</button>
            </div>
          )}

          <div className="stats">
            <div>
              Всего задач
              <strong>{visibleTasks.length}</strong>
            </div>

            <div>
              В работе
              <strong>
                {
                  visibleTasks.filter((task) =>
                    ['new', 'in_progress', 'revision'].includes(
                      task.status,
                    ),
                  ).length
                }
              </strong>
            </div>

            <div>
              На проверке
              <strong>
                {
                  visibleTasks.filter(
                    (task) => task.status === 'review',
                  ).length
                }
              </strong>
            </div>
          </div>

          {showMyTasks ? (
            <MyTasksBoard
              workspace={workspace}
              taskState={taskState}
              sites={objectState.sites}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
            />
          ) : (
            <ObjectsBoard
              workspace={workspace}
              objectState={objectState}
              taskState={taskState}
              selection={selection}
              isManager={isManager}
            />
          )}

          <footer>
            Доступ к данным защищён политиками Supabase · Прораб ©
            2026
          </footer>
        </section>
      </main>

      {taskState.taskFormOpen && isManager && (
        <TaskForm
          task={taskState.editingTask}
          sites={objectState.sites}
          executors={taskState.executors}
          initialObjectId={selection.selected}
          busy={taskState.saving}
          onSave={taskState.handleSaveTask}
          onCancel={taskState.closeTaskForm}
        />
      )}
      {objectState.objectFormOpen && isManager && (
        <ObjectForm object={objectState.editingObject} busy={objectState.saving} onSave={objectState.handleSaveObject} onCancel={objectState.closeObjectForm} />
      )}
    </>
  );
}
