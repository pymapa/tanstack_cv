// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RevisionList } from '~/features/cv/components/revision-list'
import type { RevisionSummary } from '~/server/repositories/cv-repository'

const revision = (number: number): RevisionSummary => ({
  id: `rev-${String(number)}`,
  number,
  source: number === 1 ? 'import' : 'manual',
  message: undefined,
  authorName: 'Tester',
  createdAt: '2026-09-25T10:00:00.000Z',
})

const revisions = [revision(2), revision(1)]

const open = async () => {
  await userEvent.click(screen.getByText('History (2)'))
}

describe('RevisionList', () => {
  it('should offer restore for earlier revisions only', async () => {
    render(<RevisionList revisions={revisions} onRestore={vi.fn()} />)
    await open()

    expect(screen.getAllByRole('button', { name: /restore/i }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Restore revision 1',
    ])
  })

  it('should ask for confirmation before restoring', async () => {
    const onRestore = vi.fn()
    render(<RevisionList revisions={revisions} onRestore={onRestore} />)
    await open()

    await userEvent.click(screen.getByRole('button', { name: 'Restore revision 1' }))

    expect(onRestore).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Yes, restore' }))
    expect(onRestore).toHaveBeenCalledWith('rev-1')
  })

  it('should not restore when the user cancels', async () => {
    const onRestore = vi.fn()
    render(<RevisionList revisions={revisions} onRestore={onRestore} />)
    await open()

    await userEvent.click(screen.getByRole('button', { name: 'Restore revision 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onRestore).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Restore revision 1' })).toBeTruthy()
  })

  it('should not confirm a restore while a save is running', async () => {
    const onRestore = vi.fn()
    const { rerender } = render(<RevisionList revisions={revisions} onRestore={onRestore} />)
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Restore revision 1' }))

    rerender(<RevisionList revisions={revisions} onRestore={onRestore} restoreDisabled />)

    expect(screen.getByRole('button', { name: 'Yes, restore' })).toBeDisabled()
  })
})
