import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TaskCard } from './TaskCard'
import type { Site, Task } from '../types/domain'

afterEach(cleanup)

const object: Site = { id: 'object-1', name: 'Корпус А', address: 'Москва' }
const task: Task = {
  id: 'task-1',
  title: 'Подготовить площадку',
  description: 'Убрать строительный мусор',
  object_id: object.id,
  assignee_id: 'executor-1',
  author_id: 'manager-1',
  status: 'new',
  created_at: '2026-11-06T08:00:00.000Z',
}

describe('TaskCard role actions', () => {
  it('shows executor start action for a new task', () => {
    render(<TaskCard task={task} object={object} role="executor" act={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Взять в работу' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Принять' })).toBeNull()
  })

  it('shows review decisions to a manager only while task is under review', () => {
    render(<TaskCard task={{ ...task, status: 'review' }} object={object} role="manager" act={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Принять' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Вернуть на доработку' })).toBeTruthy()
  })

  it('collects a required revision comment in the in-app dialog', () => {
    const act = vi.fn()
    render(<TaskCard task={{ ...task, status: 'review' }} object={object} role="manager" act={act} />)
    fireEvent.click(screen.getByRole('button', { name: 'Вернуть на доработку' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    const submit = within(screen.getByRole('dialog')).getByRole('button', { name: 'Вернуть на доработку' })
    expect(submit).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('Укажите, что нужно исправить'), { target: { value: 'Проверить крепления' } })
    expect(submit).toHaveProperty('disabled', false)
    fireEvent.click(submit)
    expect(act).toHaveBeenCalledWith({ ...task, status: 'review' }, 'revision', 'Проверить крепления')
  })

  it('does not show manager transition controls to an executor', () => {
    render(<TaskCard task={{ ...task, status: 'review' }} object={object} role="executor" act={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Принять' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Вернуть на доработку' })).toBeNull()
  })

  it('renders task data and invokes the status callback', () => {
    const act = vi.fn()
    render(<TaskCard task={task} object={object} role="executor" act={act} />)
    expect(screen.getByText('Корпус А · Москва')).toBeTruthy()
    expect(screen.getByText('executor-1')).toBeTruthy()
    expect(screen.getByText('manager-1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Взять в работу' }))
    expect(act).toHaveBeenCalledWith(task, 'in_progress')
  })
})
