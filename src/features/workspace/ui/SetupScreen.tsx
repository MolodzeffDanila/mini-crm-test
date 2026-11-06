import { Screen } from '../../../components/Screen';

export function SetupScreen() {
  return (
    <Screen>
      <span className="eyebrow">НАСТРОЙКА ПРОЕКТА</span>
      <h1>Подключите Supabase</h1>
      <p>
        Скопируйте <code>.env.example</code> в <code>.env</code>,
        укажите URL проекта и публичный ключ, затем примените
        миграцию из <code>supabase/migrations</code>.
      </p>
    </Screen>
  );
}
