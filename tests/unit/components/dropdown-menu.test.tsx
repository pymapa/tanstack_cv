// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/dropdown-menu'

function renderMenu(onExport = vi.fn()) {
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={onExport}>Export PDF</DropdownMenuItem>
        <DropdownMenuItem>Create variant</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  )
  return { onExport }
}

describe('DropdownMenu', () => {
  it('should show only the trigger button when closed', () => {
    renderMenu()

    expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('should open the list of items when the trigger is clicked', async () => {
    renderMenu()

    await userEvent.click(screen.getByRole('button', { name: 'Actions' }))

    expect(await screen.findByRole('menu')).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Export PDF', 'Create variant'])
  })

  it('should run the item action and close when an item is clicked', async () => {
    const { onExport } = renderMenu()

    await userEvent.click(screen.getByRole('button', { name: 'Actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Export PDF' }))

    expect(onExport).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('should close and return focus to the trigger when Escape is pressed', async () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'Actions' })

    await userEvent.click(trigger)
    await screen.findByRole('menu')
    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })
})
