// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Streamdown } from 'streamdown'
import { ChatLink, chatMarkdownComponents } from '~/components/chat-link'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ navigate }) }))

describe('ChatLink', () => {
  it('should navigate inside the app without reloading when the link is an app path', async () => {
    render(<ChatLink href="/cvs/abc-1">Anna, PM</ChatLink>)

    await userEvent.click(screen.getByRole('link', { name: 'Anna, PM' }))

    expect(navigate).toHaveBeenCalledWith({ href: '/cvs/abc-1' })
  })

  it('should leave a modified click to the browser so the link can open in a new tab', async () => {
    navigate.mockClear()
    render(<ChatLink href="/cvs/abc-1">Anna, PM</ChatLink>)

    const user = userEvent.setup()
    await user.keyboard('{Control>}')
    await user.click(screen.getByRole('link', { name: 'Anna, PM' }))

    expect(navigate).not.toHaveBeenCalled()
  })

  it.each(['https://evil.example/?d=secret', '//evil.example/x', 'javascript:alert(1)', 'mailto:a@example.com'])(
    'should render %s as plain text, not a link',
    (href) => {
      render(<ChatLink href={href}>click me</ChatLink>)

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(screen.getByText('click me')).toBeInTheDocument()
    },
  )

  it('should render a markdown app link from the assistant as an in-app link', () => {
    render(
      <Streamdown components={chatMarkdownComponents}>{'[Show these CVs in search](/?cv=%5B%22a1%22%5D)'}</Streamdown>,
    )

    expect(screen.getByRole('link', { name: 'Show these CVs in search' })).toHaveAttribute(
      'href',
      '/?cv=%5B%22a1%22%5D',
    )
  })

  it('should not render markdown images from the assistant', () => {
    const { container } = render(
      <Streamdown components={chatMarkdownComponents}>{'![x](https://evil.example/p.png?d=secret)'}</Streamdown>,
    )

    expect(container.querySelector('img')).toBeNull()
  })
})
