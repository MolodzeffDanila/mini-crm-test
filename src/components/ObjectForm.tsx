import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Site } from '../types/domain'
import type { ObjectInput } from '../entities/object/api/object.api'
import './TaskForm.css'
import './ObjectForm.css'

type Props = { object?: Site; busy: boolean; onSave: (input: ObjectInput) => Promise<void>; onCancel: () => void }

export function ObjectForm({ object, busy, onSave, onCancel }: Props) {
  const [name, setName] = useState(object?.name ?? '')
  const [address, setAddress] = useState(object?.address ?? '')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSave({ name: name.trim(), address: address.trim() })
  }
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="object-form-title">
        <div className="dialog-heading"><div><span className="eyebrow">ОБЪЕКТ</span><h2 id="object-form-title">{object ? 'Редактировать объект' : 'Новый объект'}</h2></div></div>
        <form className="task-form" onSubmit={submit}>
          <label>Название<input required maxLength={200} autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Адрес<input required maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <div className="dialog-actions"><button type="button" className="secondary" onClick={onCancel} disabled={busy}>Отмена</button><button className="primary" disabled={busy}>{busy ? 'Сохраняем…' : object ? 'Сохранить' : 'Создать объект'}</button></div>
        </form>
      </section>
    </div>
  )
}
