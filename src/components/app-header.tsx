import { Link, useMatches } from '@tanstack/react-router'
import { pickHeaderTitle, type HeaderTitle } from './header-title'

export function AppHeader() {
  const title = useMatches({ select: (matches) => pickHeaderTitle(matches) })
  return <AppHeaderView {...(title === undefined ? {} : { title })} />
}

export function AppHeaderView({ title }: { title?: HeaderTitle }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-8">
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
      </div>
    </header>
  )
}
