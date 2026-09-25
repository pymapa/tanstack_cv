import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Vitest globals are off, so Testing Library can't register its own cleanup.
afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})
