import { useId, useState } from 'react'
import type { FacetCount } from '~/cv/search'
import { FACET_KINDS, FACET_LABELS, type FacetKind } from '~/cv/search-text'

const COLLAPSED_COUNT = 6

type Props = Readonly<{
  facets: Readonly<Record<FacetKind, readonly FacetCount[]>>
  selected: Readonly<Record<FacetKind, readonly string[]>>
  onToggle: (kind: FacetKind, values: string[]) => void
}>

export function FacetPanel({ facets, selected, onToggle }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {FACET_KINDS.filter((kind) => facets[kind].length > 0 || selected[kind].length > 0).map((kind) => (
        <FacetGroup
          key={kind}
          kind={kind}
          counts={facets[kind]}
          selected={selected[kind]}
          onChange={(values) => {
            onToggle(kind, values)
          }}
        />
      ))}
    </div>
  )
}

function FacetGroup({
  kind,
  counts,
  selected,
  onChange,
}: {
  kind: FacetKind
  counts: readonly FacetCount[]
  selected: readonly string[]
  onChange: (values: string[]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const selectedKeys = new Set(selected.map((s) => s.toLowerCase()))
  // Selected values always stay visible, even when collapsed or no longer in the counts.
  const missingSelected = selected
    .filter((s) => !counts.some((c) => c.value.toLowerCase() === s.toLowerCase()))
    .map((value) => ({ key: value.toLowerCase(), value, count: 0 }))
  const all = [...missingSelected, ...counts]
  const visible = expanded ? all : all.filter((c, i) => i < COLLAPSED_COUNT || selectedKeys.has(c.value.toLowerCase()))

  const toggle = (value: string) => {
    onChange(
      selectedKeys.has(value.toLowerCase())
        ? selected.filter((s) => s.toLowerCase() !== value.toLowerCase())
        : [...selected, value],
    )
  }

  return (
    <fieldset>
      <legend className="eyebrow mb-2">{FACET_LABELS[kind]}</legend>
      <ul id={listId} className="flex flex-col gap-0.5">
        {visible.map((c) => {
          const checked = selectedKeys.has(c.value.toLowerCase())
          return (
            <li key={c.key}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-white">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    toggle(c.value)
                  }}
                  className="size-4 accent-ink"
                  data-testid={`facet-${kind}-${c.key.replace(/[^a-z0-9]+/g, '-')}`}
                />
                <span className={checked ? 'font-medium' : ''}>{c.value}</span>
                <span className="ml-auto tabular-nums text-muted" aria-label={`${c.count} CVs`}>
                  {c.count}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {all.length > COLLAPSED_COUNT && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => {
            setExpanded((e) => !e)
          }}
          className="mt-1 px-1 text-sm font-medium text-teal hover:underline"
        >
          {expanded ? 'Show fewer' : `Show all ${all.length}`}
        </button>
      )}
    </fieldset>
  )
}
