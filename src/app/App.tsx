import { useState } from 'react';

import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../features/auth/useAuth';
import { LoginForm } from '../features/auth/LoginForm';
import { useTasks } from '../features/tasks/useTasks';
import { useObjects } from '../features/objects/useObjects';
import { useSelection } from '../features/workspace/useSelection';
import { useWorkspace } from '../features/workspace/useWorkspace';
import type { WorkspaceView } from '../features/workspace/useWorkspace';
import { SetupScreen } from '../features/workspace/SetupScreen';
import { NoAccessScreen } from '../features/workspace/NoAccessScreen';
import { Screen } from '../components/Screen';
import { SideMenu } from '../features/workspace/SideMenu';
import { WorkspaceMain } from '../features/workspace/WorkspaceMain';

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
        userLabel={auth.profile.display_name ?? auth.session.user.email}
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
