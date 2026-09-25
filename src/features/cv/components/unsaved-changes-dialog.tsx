import { useEffect, useRef } from 'react'

/**
 * Modal shown when the user tries to leave with unsaved edits. Native <dialog>: showModal() traps
 * focus and moves it to the first button ("Keep editing", the safe choice).
 */
export function UnsavedChangesDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby="unsaved-title"
      onCancel={(e) => {
        e.preventDefault()
        onStay()
      }}
      className="m-auto max-w-md rounded-card border border-line p-8 text-ink backdrop:bg-ink/50"
    >
      <h2 id="unsaved-title" className="text-2xl">
        Discard unsaved changes?
      </h2>
      <p className="mt-3 text-sm text-muted">Your edits to this CV haven’t been saved.</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onStay}
          className="rounded-card bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
          data-testid="unsaved-stay"
        >
          Keep editing
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-card border border-line px-5 py-2.5 text-sm font-medium hover:border-ink"
          data-testid="unsaved-leave"
        >
          Discard and leave
        </button>
      </div>
    </dialog>
  )
}
