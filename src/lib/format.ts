const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Helsinki',
})

/** "25 Sept 2026". UTC so server and client render the same string (no hydration mismatch). */
export const formatDate = (iso: string): string => DATE.format(new Date(iso))

export const formatDateTime = (iso: string): string => DATE_TIME.format(new Date(iso))

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** CV partial dates: "2021" → "2021", "2021-05" → "May 2021". */
export const formatPartialDate = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined
  const [year, month] = value.split('-')
  const name = month === undefined ? undefined : MONTHS[Number(month) - 1]
  return name === undefined ? year : `${name} ${year}`
}

export const formatPeriod = (start?: string, end?: string): string | undefined => {
  const from = formatPartialDate(start)
  const to = formatPartialDate(end)
  if (from === undefined && to === undefined) return undefined
  if (from !== undefined && to === undefined) return `${from} – present`
  if (from === undefined) return to
  return from === to ? from : `${from} – ${to}`
}

/** "Edited 25 Sept 2026", or "2025 CV · imported" when the CV is unchanged since import. */
export const formatLastChange = (updatedAt: string | null, cvYear: string): string =>
  updatedAt === null ? `${cvYear} CV · imported` : `Edited ${formatDate(updatedAt)}`
