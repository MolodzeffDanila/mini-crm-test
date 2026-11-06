import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../../../lib/supabase';
import {
  fetchProfileRole,
  fetchSession,
  signInWithPassword,
  signOutUser,
  subscribeToAuthState,
} from '../api/auth.api';
import type { Role } from '../../../types/domain';

export interface AuthProfile {
  role: Role;
  display_name: string;
}

export interface UseAuthResult {
  session: Session | null;
  profile: AuthProfile | null;
  authLoading: boolean;
  profileError: boolean;
  busy: boolean;
  authError: string;
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  handleSignIn: (e: FormEvent<HTMLFormElement>) => void;
}

/**
 * Управляет состоянием авторизации: сессия Supabase Auth,
 * профиль и роль пользователя, вход и выход.
 * Роль определяется по таблице profiles (см. docs/CONTRACT.md, раздел 4).
 */
export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Восстановление сессии и подписка на её изменения
  useEffect(() => {
    if (!supabase) return;

    const subscription = subscribeToAuthState((nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      if (!nextSession) {
        setProfile(null);
        setProfileError(false);
      }
    });

    fetchSession()
      .then((currentSession) => {
        setSession(currentSession);
        setAuthLoading(false);
      })
      .catch((sessionError: unknown) => {
        console.error('Session restore error:', sessionError);
        setAuthError('Не удалось восстановить сессию. Войдите снова.');
        setAuthLoading(false);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Загрузка профиля и роли после появления сессии
  useEffect(() => {
    if (!session || !supabase) return;

    let live = true;

    void (async () => {
      const role = await fetchProfileRole(session.user.id);

      if (!live) return;

      if (!role) {
        console.error('Profile loading error: profile or role not found');
        setProfile(null);
        setProfileError(true);
        setAuthError('Не удалось определить роль пользователя. Обратитесь к администратору.');
        return;
      }

      setProfileError(false);
      setProfile({
        role,
        display_name: session.user.email ?? '',
      });
    })();

    return () => {
      live = false;
    };
  }, [session]);

  async function signIn(email: string, password: string) {
    if (!supabase) return;

    setBusy(true);
    setAuthError('');
    try {
      await signInWithPassword(email, password);
    } catch (signInError) {
      console.error('Sign in error:', signInError);
      setAuthError('Не удалось войти. Проверьте email и пароль.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;

    setBusy(true);
    try {
      await signOutUser();
    } catch (signOutError) {
      console.error('Sign out error:', signOutError);
      setAuthError('Не удалось выйти из системы. Повторите попытку.');
    } finally {
      setBusy(false);
    }
  }

  // Отправка формы входа
  function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void signIn(email, password);
  }

  return {
    session,
    profile,
    authLoading,
    profileError,
    busy,
    authError,
    email,
    password,
    setEmail,
    setPassword,
    signIn,
    signOut,
    handleSignIn,
  };
}
