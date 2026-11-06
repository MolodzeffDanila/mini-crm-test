import { Screen } from '../../../components/Screen';
import type { UseAuthResult } from '../model/useAuth';

export function NoAccessScreen({ auth }: { auth: UseAuthResult }) {
  return (
    <Screen>
      <h1>Нет доступа к рабочему пространству</h1>
      <p>{auth.authError || 'Профиль с допустимой ролью не найден.'}</p>
      <button className="primary" onClick={auth.signOut} disabled={auth.busy}>Выйти</button>
    </Screen>
  );
}
