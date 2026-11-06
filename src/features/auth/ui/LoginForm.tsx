import { Brand } from '../../../components/Brand';
import type { UseAuthResult } from '../model/useAuth';

export function LoginForm({ auth }: { auth: UseAuthResult }) {
  const {
    email,
    password,
    setEmail,
    setPassword,
    busy,
    authError,
    handleSignIn,
  } = auth;

  return (
    <main className="login">
      <section className="hero">
        <Brand />

        <div>
          <span className="eyebrow">
            РАБОТА НА ОБЪЕКТЕ — ПОД КОНТРОЛЕМ
          </span>

          <h1>
            Все задачи.
            <br />
            В одном месте.
          </h1>

          <p>
            Понятный рабочий ритм для команды и руководителя.
          </p>
        </div>

        <small>ОБЪЕКТЫ · ЗАДАЧИ · РЕЗУЛЬТАТ</small>
      </section>

      <form className="login-form" onSubmit={handleSignIn}>
        <span className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</span>

        <h2>С возвращением</h2>
        <p>Войдите, чтобы продолжить работу.</p>

        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label>
          Пароль
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {authError && <div className="error">{authError}</div>}

        <button className="primary" disabled={busy}>
          {busy ? 'Входим…' : 'Войти в систему'} →
        </button>

        <small>Доступ выдаёт руководитель. Регистрация закрыта.</small>
      </form>
    </main>
  );
}
