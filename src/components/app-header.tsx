import { Link } from '@tanstack/react-router'
import { PixelGrid } from './pixel-grid'

export function AppHeader() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-8 px-8">
        <Link to="/" className="flex items-center gap-3 no-underline" aria-label="Kipinä CV bank, go to search">
          <img src="/brand/kipina-logo.png" alt="Kipinä" className="h-7 w-auto" width={92} height={28} />
          <span className="border-l border-line pl-3 text-lg font-light tracking-tight text-ink">CV bank</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-6 text-sm">
          <Link
            to="/"
            className="border-b-2 border-transparent py-5 uppercase tracking-[0.04em] text-ink no-underline hover:border-line"
            activeProps={{ className: '!border-lime' }}
            activeOptions={{ exact: true, includeSearch: false }}
            data-testid="nav-search"
          >
            Search
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-muted">
          <PixelGrid size={14} />
          <span>Local development</span>
        </div>
      </div>
    </header>
  )
}
