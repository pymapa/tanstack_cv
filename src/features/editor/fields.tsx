import { useId, useState, type ReactNode } from 'react'
import { useEditor } from './editor-context'
import { getIn, pathKey, type Path } from './update'

export const SHORT_LIMIT = 300
export const LONG_LIMIT = 5000

export const INPUT =
  'w-full rounded-[5px] border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 ' +
  'hover:border-ink/40 aria-[invalid=true]:border-danger read-only:bg-mist read-only:text-muted'

const testIdOf = (path: Path) => `field-${pathKey(path).replace(/[^A-Za-z0-9]+/g, '-')}`

/** Shared wiring: ids, value, error lookup and aria-describedby for one bound field. */
const useField = (path: Path, hint?: string) => {
  const { cv, set, issues } = useEditor()
  const id = useId()
  const key = pathKey(path)
  const error = issues.find((i) => i.path === key)?.message
  const hintId = hint === undefined ? undefined : `${id}-hint`
  const errorId = error === undefined ? undefined : `${id}-error`
  return {
    id,
    value: getIn(cv, path),
    set: (value: unknown) => {
      set(path, value)
    },
    error,
    hintId,
    errorId,
    describedBy: (...extra: (string | undefined)[]) =>
      [hintId, ...extra, errorId].filter((x): x is string => x !== undefined).join(' ') || undefined,
  }
}

type BaseProps = Readonly<{ path: Path; label: string; hint?: string; testId?: string; className?: string }>

function FieldShell({
  id,
  label,
  hint,
  hintId,
  error,
  errorId,
  aside,
  className = '',
  children,
}: {
  id: string
  label: string
  hint: string | undefined
  hintId: string | undefined
  error: string | undefined
  errorId: string | undefined
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint !== undefined && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error !== undefined && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}

export function FieldError({ id, children }: { id: string | undefined; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1 text-xs font-medium text-danger">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="mt-px shrink-0">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5v4.2M8 11v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="sr-only">Error: </span>
      {children}
    </p>
  )
}

export function TextField({
  path,
  label,
  hint,
  testId,
  className,
  readOnly = false,
  type = 'text',
  maxLength = SHORT_LIMIT,
  placeholder,
}: BaseProps & { readOnly?: boolean; type?: 'text' | 'email' | 'tel'; maxLength?: number; placeholder?: string }) {
  const f = useField(path, hint)
  return (
    <FieldShell {...f} label={label} hint={hint} className={className ?? ''}>
      <input
        id={f.id}
        type={type}
        value={typeof f.value === 'string' ? f.value : ''}
        onChange={(e) => {
          f.set(e.target.value)
        }}
        readOnly={readOnly}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={f.error !== undefined}
        aria-describedby={f.describedBy()}
        className={INPUT}
        data-testid={testId ?? testIdOf(path)}
      />
    </FieldShell>
  )
}

export function DateField(props: BaseProps) {
  return <TextField {...props} hint={props.hint ?? 'YYYY or YYYY-MM'} maxLength={10} placeholder="2024-05" />
}

export function TextArea({
  path,
  label,
  hint,
  testId,
  className,
  rows = 5,
  maxLength = LONG_LIMIT,
}: BaseProps & { rows?: number; maxLength?: number }) {
  const f = useField(path, hint)
  const text = typeof f.value === 'string' ? f.value : ''
  const countId = `${f.id}-count`
  const near = text.length > maxLength * 0.9
  return (
    <FieldShell
      {...f}
      label={label}
      hint={hint}
      className={className ?? ''}
      aside={
        <span id={countId} className={`text-xs tabular-nums ${near ? 'font-medium text-danger' : 'text-muted'}`}>
          {text.length} / {maxLength}
        </span>
      }
    >
      <textarea
        id={f.id}
        value={text}
        rows={rows}
        onChange={(e) => {
          f.set(e.target.value)
        }}
        aria-invalid={f.error !== undefined}
        aria-describedby={f.describedBy(countId)}
        className={`${INPUT} resize-y leading-relaxed`}
        data-testid={testId ?? testIdOf(path)}
      />
    </FieldShell>
  )
}

export function CheckboxField({ path, label, hint, testId, className = '' }: BaseProps) {
  const f = useField(path, hint)
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={f.id} className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          id={f.id}
          type="checkbox"
          checked={f.value === true}
          onChange={(e) => {
            f.set(e.target.checked ? true : undefined)
          }}
          aria-describedby={f.describedBy()}
          className="size-4 accent-ink"
          data-testid={testId ?? testIdOf(path)}
        />
        {label}
      </label>
      {hint !== undefined && (
        <p id={f.hintId} className="pl-6 text-xs text-muted">
          {hint}
        </p>
      )}
      {f.error !== undefined && <FieldError id={f.errorId}>{f.error}</FieldError>}
    </div>
  )
}

export function ChipsField({ path, label, hint, testId, className }: BaseProps) {
  const f = useField(path, hint ?? 'Press Enter to add')
  const [draft, setDraft] = useState('')
  const values = Array.isArray(f.value) ? (f.value as unknown[]).filter((v): v is string => typeof v === 'string') : []
  const base = testId ?? testIdOf(path)

  const add = () => {
    const next = draft.trim().slice(0, SHORT_LIMIT)
    if (next === '') return
    if (!values.some((v) => v.toLowerCase() === next.toLowerCase())) f.set([...values, next])
    setDraft('')
  }

  return (
    <FieldShell {...f} label={label} hint={hint ?? 'Press Enter to add'} className={className ?? ''}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-[5px] border border-line bg-white p-1.5 focus-within:border-ink/60">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-mist py-0.5 pl-2.5 pr-1 text-xs text-ink"
          >
            {v}
            <button
              type="button"
              onClick={() => {
                f.set(values.filter((x) => x !== v))
              }}
              aria-label={`Remove ${v}`}
              className="grid size-4 place-items-center rounded-full text-muted hover:bg-ink hover:text-white"
              data-testid={`${base}-remove`}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
                <path d="M1 1l6 6M7 1 1 7" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          </span>
        ))}
        <input
          id={f.id}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          onBlur={add}
          maxLength={SHORT_LIMIT}
          aria-invalid={f.error !== undefined}
          aria-describedby={f.describedBy()}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
          data-testid={base}
        />
      </div>
    </FieldShell>
  )
}
