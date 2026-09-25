/**
 * Pure, immutable update helpers for the CV editor. Never mutate CV objects: every change
 * returns a new object and structurally shares everything that didn't change.
 */

export type PathSegment = string | number
export type Path = readonly PathSegment[]

/** Strings that must stay even when empty (the schema requires them). Indexes are written as `*`. */
const REQUIRED_KEYS = new Set([
  'basics.name',
  'basics.label',
  'basics.summary',
  'basics.x-strengths.*.title',
  'basics.x-keyRoles.*.title',
  'basics.x-keySkills.*.title',
  'skills.*.name',
  'skills.*.x-skillDetails.*.name',
  'projects.*.name',
  'projects.*.entity',
  'work.*.name',
  'certificates.*.name',
  'x-testimonials.*.quote',
])

/** Arrays the schema requires at the top level; they become [] instead of disappearing. */
const REQUIRED_ARRAYS = new Set(['skills', 'projects'])

const pattern = (path: Path): string => path.map((s) => (typeof s === 'number' ? '*' : s)).join('.')

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === '' || (Array.isArray(value) && value.length === 0)

const shouldRemove = (path: Path, value: unknown): boolean => {
  if (!isEmpty(value)) return false
  const key = pattern(path)
  if (Array.isArray(value)) return !REQUIRED_ARRAYS.has(key)
  return !REQUIRED_KEYS.has(key)
}

const setAt = (target: unknown, path: Path, fullPath: Path, value: unknown): unknown => {
  const [head, ...rest] = path
  if (head === undefined) return value

  if (typeof head === 'number') {
    const list: readonly unknown[] = Array.isArray(target) ? target : []
    if (rest.length === 0 && value === undefined) return removeAt(list, head)
    const copy = [...list]
    copy[head] = setAt(list[head], rest, fullPath, value)
    return copy
  }

  const record = typeof target === 'object' && target !== null ? (target as Record<string, unknown>) : {}
  if (rest.length === 0 && shouldRemove(fullPath, value)) {
    if (!(head in record)) return record
    const { [head]: _removed, ...kept } = record
    return kept
  }
  return { ...record, [head]: setAt(record[head], rest, fullPath, value) }
}

/**
 * Returns a copy of `root` with `value` at `path`. Empty optional values ('' / undefined / [])
 * remove the key, so the stored JSON never holds empty strings for optional fields.
 */
export const setIn = <T>(root: T, path: Path, value: unknown): T => setAt(root, path, path, value) as T

/** Reads the value at `path`, or undefined when any step is missing. */
export const getIn = (root: unknown, path: Path): unknown =>
  path.reduce<unknown>(
    (node, key) =>
      typeof node === 'object' && node !== null ? (node as Record<PathSegment, unknown>)[key] : undefined,
    root,
  )

/** "projects.2.name" style key, used for issues, ids and test ids. */
export const pathKey = (path: Path): string => path.map(String).join('.')

export const insertAt = <T>(list: readonly T[], index: number, item: T): T[] => [
  ...list.slice(0, index),
  item,
  ...list.slice(index),
]

export const removeAt = <T>(list: readonly T[], index: number): T[] => list.filter((_, i) => i !== index)

/** Moves the item at `from` to `to`. Out-of-range moves return the same list. */
export const move = <T>(list: readonly T[], from: number, to: number): readonly T[] => {
  if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return list
  const item = list[from] as T
  return insertAt(removeAt(list, from), to, item)
}
