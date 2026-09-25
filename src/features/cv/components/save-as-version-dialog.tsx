import { type SubmitEvent, useEffect, useId, useRef, useState } from 'react'
import { VariantName } from '~/cv/variant'
import { FieldError, INPUT } from '~/features/editor/fields'
import type { CreateCvVariantResult } from '~/server/functions/cv'

type Props = Readonly<{
  personName: string
  onSubmit: (variant: string) => Promise<CreateCvVariantResult>
  onCancel: () => void
}>

export function SaveAsVersionDialog({ personName, onSubmit, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    ref.current?.showModal()
    inputRef.current?.focus()
  }, [])

  const submit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (submitting) return
    const parsed = VariantName.safeParse(name)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message)
      return
    }
    setSubmitting(true)
    try {
      const result = await onSubmit(parsed.data)
      if (!result.ok) {
        setError(
          result.error === 'VARIANT_TAKEN'
            ? `${personName} already has a version with this name.`
            : 'Saving failed. Try again.',
        )
      }
    } catch {
      setError('Saving failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        e.preventDefault()
        if (!submitting) onCancel()
      }}
      className="m-auto w-full max-w-md rounded-card border border-line p-8 text-ink backdrop:bg-ink/50"
    >
      <form onSubmit={(e) => void submit(e)} noValidate>
        <h2 id={`${id}-title`} className="text-2xl">
          Save as new version
        </h2>
        <p className="mt-3 text-sm text-muted">
          Your current edits go into the new version. This version stays as it was last saved.
        </p>
        <div className="mt-6 flex flex-col gap-1">
          <label htmlFor={`${id}-name`} className="text-[13px] font-medium text-ink">
            Version name
          </label>
          <input
            ref={inputRef}
            id={`${id}-name`}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(undefined)
            }}
            maxLength={40}
            autoComplete="off"
            aria-invalid={error !== undefined}
            aria-describedby={error === undefined ? hintId : `${hintId} ${errorId}`}
            className={INPUT}
            data-testid="cv-version-name"
          />
          <p id={hintId} className="text-xs text-muted">
            For example, the role or client it’s for. Use letters, digits, spaces, and hyphens.
          </p>
          {error !== undefined && <FieldError id={errorId}>{error}</FieldError>}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-card border border-line px-5 py-2.5 text-sm font-medium hover:border-ink disabled:cursor-not-allowed disabled:text-muted"
            data-testid="cv-version-cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-card bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-ink/30"
            data-testid="cv-version-create"
          >
            {submitting ? 'Creating…' : 'Create version'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
