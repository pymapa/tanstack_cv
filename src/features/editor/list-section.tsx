import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useEditor } from './editor-context'
import { Section, SectionIntro } from './section'
import { getIn, insertAt, move, pathKey, removeAt, type Path } from './update'

type Props<T> = Readonly<{
  title: string
  path: Path
  /** Singular noun for buttons and labels: "project" → "Add project", "Move project X up". */
  noun: string
  newItem: () => T
  /** Short human name of an item for aria-labels, e.g. the project name. */
  describe: (item: T, index: number) => string
  intro?: string
  renderItem: (item: T, itemPath: Path, index: number) => ReactNode
}>

let keySeq = 0
const nextKey = () => `item-${++keySeq}`

/**
 * Keeps one stable React key per list position without writing ids into the CV JSON.
 * Our own add/remove/move keep keys in step; any outside change of length re-syncs them.
 */
const resize = (keys: readonly string[], length: number): string[] =>
  keys.length < length ? [...keys, ...Array.from({ length: length - keys.length }, nextKey)] : keys.slice(0, length)

const useStableKeys = (length: number) => {
  const [keys, setKeys] = useState<readonly string[]>(() => resize([], length))
  // Adjusting state while rendering (React-endorsed) when the list changed from outside.
  if (keys.length !== length) {
    const synced = resize(keys, length)
    setKeys(synced)
    return [synced, setKeys] as const
  }
  return [keys, setKeys] as const
}

export function ListSection<T>({ title, path, noun, newItem, describe, intro, renderItem }: Props<T>) {
  const { cv, set } = useEditor()
  const raw = getIn(cv, path)
  const items: readonly T[] = Array.isArray(raw) ? (raw as T[]) : []
  const [keys, setKeys] = useStableKeys(items.length)
  const [open, setOpen] = useState(false)
  // Item to focus after the next render (a ref, so focusing never triggers another render).
  const pendingFocus = useRef<number | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const sectionPath = pathKey(path)

  useEffect(() => {
    if (pendingFocus.current === null) return
    listRef.current?.children[pendingFocus.current]?.querySelector<HTMLElement>('input, textarea')?.focus()
    pendingFocus.current = null
  })

  const add = () => {
    setKeys([...keys, nextKey()])
    set(path, insertAt(items, items.length, newItem()))
    setOpen(true)
    pendingFocus.current = items.length
  }
  const remove = (index: number) => {
    setKeys(removeAt(keys, index))
    set(path, removeAt(items, index))
  }
  const shift = (from: number, to: number) => {
    setKeys(move(keys, from, to))
    set(path, move(items, from, to))
  }

  return (
    <Section
      title={title}
      paths={[sectionPath]}
      count={items.length}
      open={open}
      onOpenChange={setOpen}
      action={
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-[5px] border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink hover:border-ink"
          data-testid={`add-${noun.replace(/\s+/g, '-')}`}
        >
          Add {noun}
        </button>
      }
    >
      {intro !== undefined && <SectionIntro>{intro}</SectionIntro>}
      {items.length === 0 ? (
        <p className="text-sm text-muted">No {noun}s yet.</p>
      ) : (
        <ol ref={listRef} className="flex flex-col gap-3">
          {items.map((item, index) => {
            const name = describe(item, index).trim() || `${index + 1}`
            return (
              <li key={keys[index]} className="rounded-card border border-line bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="eyebrow flex-1 truncate">
                    {noun} {index + 1}
                  </span>
                  <IconButton
                    label={`Move ${noun} ${name} up`}
                    disabled={index === 0}
                    onClick={() => {
                      shift(index, index - 1)
                    }}
                  >
                    <path d="M7 11V3M3.5 6.5 7 3l3.5 3.5" />
                  </IconButton>
                  <IconButton
                    label={`Move ${noun} ${name} down`}
                    disabled={index === items.length - 1}
                    onClick={() => {
                      shift(index, index + 1)
                    }}
                  >
                    <path d="M7 3v8M3.5 7.5 7 11l3.5-3.5" />
                  </IconButton>
                  <IconButton
                    label={`Remove ${noun} ${name}`}
                    onClick={() => {
                      remove(index)
                    }}
                    danger
                  >
                    <path d="M3 4h8M5.5 4V2.8h3V4M4.2 4l.6 7.2h4.4L9.8 4" />
                  </IconButton>
                </div>
                {renderItem(item, [...path, index], index)}
              </li>
            )
          })}
        </ol>
      )}
    </Section>
  )
}

function IconButton({
  label,
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-7 place-items-center rounded-[5px] text-muted hover:bg-mist disabled:opacity-30 disabled:hover:bg-transparent ${
        danger ? 'hover:text-danger' : 'hover:text-ink'
      }`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  )
}
