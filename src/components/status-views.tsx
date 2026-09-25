import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { Container } from './container'

export function NotFoundView() {
  return (
    <Container className="py-24">
      <p className="eyebrow">Not found</p>
      <h1 className="mt-3 text-5xl">
        Nothing <em>here.</em>
      </h1>
      <p className="mt-4 text-muted">The page or CV doesn’t exist, or you don’t have access to it.</p>
      <Link to="/" className="mt-8 inline-block font-medium">
        Back to search
      </Link>
    </Container>
  )
}

/** Generic message only; details stay in server logs (spec §8). */
export function ErrorView({ reset }: ErrorComponentProps) {
  return (
    <Container className="py-24">
      <div role="alert">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-3 text-5xl">
          That didn’t <em>work.</em>
        </h1>
        <p className="mt-4 text-muted">Try again. If it keeps happening, tell the CV bank maintainers.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 rounded-card bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
        >
          Try again
        </button>
      </div>
    </Container>
  )
}
