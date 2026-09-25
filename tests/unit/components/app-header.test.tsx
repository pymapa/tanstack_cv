// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AppHeaderView } from '~/components/app-header'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    'aria-label': label,
  }: {
    children: ReactNode
    to: string
    params?: { personId?: string }
    'aria-label'?: string
  }) => (
    <a href={to.replace('$personId', params?.personId ?? '')} aria-label={label}>
      {children}
    </a>
  ),
  useMatches: () => [],
}))

describe('AppHeaderView', () => {
  it('should show only the logo when the view has no title', () => {
    render(<AppHeaderView />)

    expect(screen.getByRole('link', { name: /go to search/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByText('CV bank')).not.toBeInTheDocument()
    expect(screen.queryByText('Local development')).not.toBeInTheDocument()
  })

  it('should show the view title as the page heading', () => {
    render(<AppHeaderView title={{ title: 'Anna Example' }} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Anna Example' })).toBeInTheDocument()
  })

  it('should show the subtitle and link the title to its person page', () => {
    render(<AppHeaderView title={{ title: 'Anna Example', subtitle: 'default', personId: 'person-1' }} />)

    expect(screen.getByRole('link', { name: 'Anna Example' })).toHaveAttribute('href', '/people/person-1')
    expect(screen.getByText('default')).toBeInTheDocument()
  })
})
