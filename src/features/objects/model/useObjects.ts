import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../../../lib/supabase';
import { createObject, deleteObject, updateObject } from '../../../entities/object/api/object.api';
import type { Site } from '../../../types/domain';

export type ObjectInput = { name: string; address: string };

export interface UseObjectsDeps {
  /** Текущий выбранный объект (чтобы сбросить выбор при удалении) */
  selectedId?: string;
  /** Выбрать объект после сохранения */
  selectObject?: (objectId: string) => void;
}

export interface UseObjectsResult {
  sites: Site[];
  sitesLoaded: boolean;
  saving: boolean;
  objectsError: string;
  clearObjectsError: () => void;
  saveObject: (
    input: ObjectInput,
    editingObjectId?: string,
  ) => Promise<{ ok: boolean; objectId?: string }>;
  removeObject: (objectId: string) => Promise<boolean>;
  // Форма объекта
  objectFormOpen: boolean;
  editingObject: Site | undefined;
  openObjectForm: (object?: Site) => void;
  closeObjectForm: () => void;
  handleSaveObject: (input: ObjectInput) => Promise<void>;
  handleRemoveObject: (object: Site) => Promise<void>;
}

/**
 * Управляет объектами рабочего пространства: загрузка с учётом RLS,
 * создание/редактирование/удаление (только manager; см. docs/CONTRACT.md, раздел 5).
 */
export function useObjects(session: Session | null, deps: UseObjectsDeps = {}): UseObjectsResult {
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoaded, setSitesLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [objectsError, setObjectsError] = useState('');

  const [objectFormOpen, setObjectFormOpen] = useState(false);
  const [editingObject, setEditingObject] = useState<Site | undefined>();

  // Сброс при выходе (adjust state during render)
  const [prevSession, setPrevSession] = useState(session);
  if (session !== prevSession) {
    setPrevSession(session);
    if (!session) {
      setSites([]);
      setSitesLoaded(false);
      setObjectsError('');
      setObjectFormOpen(false);
      setEditingObject(undefined);
    }
  }

  // Загрузка объектов
  useEffect(() => {
    if (!session || !supabase) return;

    let live = true;

    void (async () => {
      const s = await supabase
        .from('objects')
        .select('id, name, address')
        .order('id', { ascending: false });

      if (!live) return;

      if (s.error) {
        console.error('Supabase loading error:', { objects: s.error });
        setObjectsError('Не удалось загрузить данные. Проверьте права доступа.');
      } else {
        setObjectsError('');
      }

      setSites((s.data ?? []) as Site[]);
      setSitesLoaded(true);
    })();

    return () => {
      live = false;
    };
  }, [session]);

  async function saveObject(
    input: ObjectInput,
    editingObjectId?: string,
  ): Promise<{ ok: boolean; objectId?: string }> {
    setSaving(true);
    const result = editingObjectId
      ? await updateObject(editingObjectId, input)
      : await createObject(input);

    if (result.error) {
      console.error('Object save error:', result.error);
      setObjectsError('Не удалось сохранить объект. Проверьте введённые данные и права доступа.');
      setSaving(false);
      return { ok: false };
    }

    setSites((current) =>
      editingObjectId
        ? current.map((item) => (item.id === editingObjectId ? result.data : item))
        : [result.data, ...current],
    );
    setObjectsError('');
    setSaving(false);

    return { ok: true, objectId: result.data.id };
  }

  async function removeObject(objectId: string): Promise<boolean> {
    const { error } = await deleteObject(objectId);

    if (error) {
      console.error('Object delete error:', error);
      setObjectsError('Не удалось удалить объект. Сначала удалите связанные задачи.');
      return false;
    }

    setSites((current) => current.filter((item) => item.id !== objectId));
    setObjectsError('');
    return true;
  }

  // Форма объекта

  function openObjectForm(object?: Site) {
    setEditingObject(object);
    setObjectFormOpen(true);
  }

  function closeObjectForm() {
    setObjectFormOpen(false);
    setEditingObject(undefined);
  }

  // Сохранение объекта из формы (создание или редактирование)
  async function handleSaveObject(input: ObjectInput) {
    const result = await saveObject(input, editingObject?.id);
    if (result.ok && result.objectId) {
      deps.selectObject?.(result.objectId);
      closeObjectForm();
    }
  }

  // Удаление объекта с подтверждением
  async function handleRemoveObject(object: Site) {
    if (!window.confirm(`Удалить объект «${object.name}»?`)) return;
    const removed = await removeObject(object.id);
    if (removed && deps.selectedId === object.id) {
      deps.selectObject?.('');
    }
  }

  return {
    sites,
    sitesLoaded,
    saving,
    objectsError,
    clearObjectsError: () => setObjectsError(''),
    saveObject,
    removeObject,
    objectFormOpen,
    editingObject,
    openObjectForm,
    closeObjectForm,
    handleSaveObject,
    handleRemoveObject,
  };
}
