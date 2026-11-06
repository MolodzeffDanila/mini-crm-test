import { useState } from 'react';

import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth, LoginForm, NoAccessScreen } from '../features/auth';
import { useTasks } from '../features/tasks';
import { useObjects } from '../features/objects';
import {
  useSelection,
  useWorkspace,
  SetupScreen,
  SideMenu,
  WorkspaceMain,
} from '../features/workspace';
import type { WorkspaceView } from '../features/workspace';
import { Screen } from '../components/Screen';

export default function App() {
  const auth = useAuth();
  const selection = useSelection(auth.session);
  const taskState = useTasks(auth.session, {
    selectObject: selection.selectObject,
  });
  const objectState = useObjects(auth.session, {
    selectedId: selection.selected,
    selectObject: selection.selectObject,
  });
  const workspace = useWorkspace({
    session: auth.session,
    profile: auth.profile,
    selected: selection.selected,
    sites: objectState.sites,
    tasks: taskState.tasks,
  });

  const [view, setView] = useState<WorkspaceView>('objects');
  const [selectedTaskId, setSelectedTaskId] = useState('');

  // Supabase configuration
  if (!isSupabaseConfigured) {
    return <SetupScreen />;
  }

  if (auth.authLoading) {
    return <Screen>Проверяем сессию…</Screen>;
  }

  // Login
  if (!auth.session) {
    return <LoginForm auth={auth} />;
  }

  // Loading
  if (!objectState.sitesLoaded || !taskState.tasksLoaded) {
    return <Screen>Загружаем рабочее пространство…</Screen>;
  }

  if (auth.profileError || !auth.profile) {
    return <NoAccessScreen auth={auth} />;
  }

  return (
    <div className="shell">
      <SideMenu
        mine={workspace.mine}
        sitesCount={workspace.visibleSites.length}
        tasksCount={workspace.visibleTasks.length}
        view={view}
        onViewChange={setView}
        userLabel={auth.session.user.email}
        signOutBusy={auth.busy}
        onSignOut={auth.signOut}
      />
      <WorkspaceMain
        auth={auth}
        taskState={taskState}
        objectState={objectState}
        workspace={workspace}
        selection={selection}
        view={view}
        selectedTaskId={selectedTaskId}
        onSelectTask={setSelectedTaskId}
      />
    </div>
  );
}
