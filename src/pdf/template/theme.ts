/**
 * Kipinä design tokens for the CV document (preview + PDF).
 * Values come from kipina.fi (see .claude/skills/kipina-brand/SKILL.md) and match src/styles/app.css.
 */
export const theme = {
  color: {
    ink: '#2b2b2b',
    lime: '#cbff2b',
    teal: '#006d5e',
    mist: '#f7fafc',
    line: '#e3e8ec',
    muted: '#5e6468',
    white: '#ffffff',
    forestDeep: '#0c241d',
    forest: '#16392f',
    moss: '#4c5d36',
  },
  /** Logo mark cells, top-left to bottom-right. Only for the 3×3 grid motif. */
  grid: ['#fff200', '#d8ff2b', '#b7fb2e', '#cbff2b', '#9ef534', '#5ff58c', '#7cf03c', '#4df5a0', '#00a896'],
  /** Type scale in pt. Body is never below 9.5pt. */
  size: { small: '8.5pt', body: '9.5pt', lead: '11pt', h3: '11pt', h2: '20pt', label: '13pt', name: '48pt' },
  /** Page geometry in mm. */
  page: { marginX: '16mm', marginTop: '16mm', marginBottom: '18mm', rail: '36mm', gutter: '6mm' },
} as const
