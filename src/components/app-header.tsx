import { Link, useMatches } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { pickHeaderTitle, rendersOwnHeader, type HeaderTitle } from './header-title'

export function AppFrame({ children }: { children: ReactNode }) {
  const title = useMatches({ select: (matches) => pickHeaderTitle(matches) })
  const ownHeader = useMatches({ select: (matches) => rendersOwnHeader(matches) })
  if (ownHeader) return children
  return (
    <>
      <AppHeaderView {...(title === undefined ? {} : { title })} />
      <main id="main">{children}</main>
    </>
  )
}

export function AppHeaderView({ title, actions }: { title?: HeaderTitle; actions?: ReactNode }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center gap-6 px-8">
        <Link
          to="/"
          className="flex flex-none items-center no-underline"
          aria-label="Kipinä CV bank, go to search"
          data-testid="nav-home"
        >
          <img src="/brand/kipina-logo.png" alt="Kipinä" className="h-7 w-auto" width={92} height={28} />
        </Link>
        {title !== undefined && (
          <div className="min-w-0 border-l border-line pl-6">
            <h1 className="truncate text-xl leading-tight font-light tracking-tight" tabIndex={-1}>
              {title.personId === undefined ? (
                title.title
              ) : (
                <Link
                  to="/people/$personId"
                  params={{ personId: title.personId }}
                  className="text-ink no-underline hover:underline"
                >
                  {title.title}
                </Link>
              )}
            </h1>
            {title.subtitle !== undefined && <p className="truncate text-sm text-muted">{title.subtitle}</p>}
          </div>
        )}
        <div className="ml-auto flex flex-none items-center gap-6">
          {actions}
          <Link
            to="/cvs/new"
            className="border-b-2 border-transparent py-5 text-sm uppercase tracking-[0.04em] text-ink no-underline hover:border-line"
            activeProps={{ className: '!border-lime' }}
            data-testid="nav-new-cv"
          >
            New CV
          </Link>
        </div>
      </div>
    </header>
  )
}
