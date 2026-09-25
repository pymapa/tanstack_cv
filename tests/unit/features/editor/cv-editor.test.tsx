// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CvDocument } from '~/cv/schema'
import { CvEditor } from '~/features/editor/cv-editor'
import type { EditorIssue } from '~/features/editor/validation'
import { buildCv, buildProject } from '../../../fixtures/cv'

/** Controlled harness: keeps the latest value like the real page does, and records every change. */
function Harness({
  initial,
  issues = [],
  spy,
  nameEditable = false,
}: {
  initial: CvDocument
  issues?: EditorIssue[]
  spy: (cv: CvDocument) => void
  nameEditable?: boolean
}) {
  const [value, setValue] = useState(initial)
  return (
    <CvEditor
      value={value}
      issues={issues}
      nameEditable={nameEditable}
      onChange={(next) => {
        spy(next)
        setValue(next)
      }}
    />
  )
}

const setup = (initial: CvDocument, issues: EditorIssue[] = []) => {
  const spy = vi.fn<(cv: CvDocument) => void>()
  render(<Harness initial={initial} issues={issues} spy={spy} />)
  const last = (): CvDocument => {
    const call = spy.mock.calls.at(-1)
    if (call === undefined) throw new Error('onChange was not called')
    return call[0]
  }
  return { spy, last }
}

const openSection = async (name: RegExp) => {
  const toggle = screen.getByRole('button', { name })
  if (toggle.getAttribute('aria-expanded') !== 'true') await userEvent.click(toggle)
}

describe('CvEditor', () => {
  it('should emit a new object with only the label changed when the label is edited', async () => {
    const initial = buildCv({ projects: [buildProject()] })
    const { last } = setup(initial)

    const label = screen.getByLabelText('Title')
    await userEvent.clear(label)
    await userEvent.type(label, 'Lead')

    expect(last().basics.label).toBe('Lead')
    expect(last().projects).toBe(initial.projects)
    expect(initial.basics.label).toBe('Software Architect')
  })

  it('should show the name as read-only', () => {
    setup(buildCv())

    expect(screen.getByLabelText('Name')).toHaveAttribute('readonly')
  })

  it('should append an empty project and expand the section when Add project is clicked', async () => {
    const { last } = setup(buildCv({ projects: [buildProject({ name: 'First' })] }))

    await userEvent.click(screen.getByRole('button', { name: 'Add project' }))

    expect(last().projects).toHaveLength(2)
    expect(last().projects[1]).toEqual({ name: '', entity: '' })
    expect(screen.getByRole('button', { name: /Projects/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('should reorder projects when Move down is clicked', async () => {
    const { last } = setup(buildCv({ projects: [buildProject({ name: 'Alpha' }), buildProject({ name: 'Beta' })] }))
    await openSection(/Projects/)

    await userEvent.click(screen.getByRole('button', { name: 'Move project Alpha down' }))

    expect(last().projects.map((p) => p.name)).toEqual(['Beta', 'Alpha'])
  })

  it('should keep focus in a field while typing into a project', async () => {
    setup(buildCv({ projects: [buildProject({ name: 'Alpha' })] }))
    await openSection(/Projects/)

    const field = screen.getByTestId('field-projects-0-name')
    await userEvent.type(field, 'X')

    expect(field).toHaveFocus()
    expect(field).toHaveValue('AlphaX')
  })

  it('should set x-highlight when Include in highlights is ticked', async () => {
    const { last } = setup(buildCv({ projects: [buildProject()] }))
    await openSection(/Projects/)

    await userEvent.click(screen.getByTestId('projects-0-highlight'))

    expect(last().projects[0]?.['x-highlight']).toBe(true)
  })

  it('should add a keyword on Enter and remove it with its remove button', async () => {
    const { last } = setup(buildCv())
    await openSection(/Keywords/)

    await userEvent.type(screen.getByLabelText('Keywords'), 'Kanban{Enter}')
    expect(last().basics['x-keywords']).toEqual(['Kanban'])

    await userEvent.click(screen.getByRole('button', { name: 'Remove Kanban' }))
    expect(last().basics['x-keywords']).toBeUndefined()
  })

  it('should not add a duplicate keyword', async () => {
    const { last } = setup(buildCv({ basics: { 'x-keywords': ['Kanban'] } }))
    await openSection(/Keywords/)

    await userEvent.type(screen.getByLabelText('Keywords'), 'kanban{Enter}Lean{Enter}')

    expect(last().basics['x-keywords']).toEqual(['Kanban', 'Lean'])
  })

  it('should show an issue next to its field and link it with aria-describedby', () => {
    setup(buildCv(), [{ path: 'basics.summary', message: 'Too long' }])

    const summary = screen.getByLabelText('Summary')
    const error = screen.getByText(/Too long/)

    expect(summary).toHaveAttribute('aria-invalid', 'true')
    expect(summary.getAttribute('aria-describedby')?.split(' ')).toContain(error.id)
  })

  it('should open a collapsed section that has an issue', () => {
    setup(buildCv({ projects: [buildProject()] }), [{ path: 'projects.0.startDate', message: 'Use YYYY' }])

    const projects = screen.getByRole('region', { name: /Projects/ })

    expect(within(projects).getByText(/Use YYYY/)).toBeInTheDocument()
  })

  it('should let the user type the name when the name is editable', async () => {
    const spy = vi.fn<(cv: CvDocument) => void>()
    render(<Harness initial={buildCv({ basics: { name: '' } })} spy={spy} nameEditable />)

    await userEvent.type(screen.getByLabelText('Name'), 'Mia')

    expect(screen.getByLabelText('Name')).not.toHaveAttribute('readonly')
    expect(spy.mock.calls.at(-1)?.[0].basics.name).toBe('Mia')
  })
})
