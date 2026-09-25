import { CvDocument } from '~/cv/schema'

export type EditorIssue = Readonly<{ path: string; message: string }>

const FRIENDLY: ReadonlyArray<readonly [RegExp, string]> = [
  [/Too big: expected string to have <=(\d+) characters/, 'Keep this under $1 characters'],
  [/Too small: expected string to have >=1 characters/, 'This field is required'],
  [/Invalid input: expected string, received undefined/, 'This field is required'],
  [/Invalid email address/, 'Enter a valid email address'],
]

const friendly = (message: string): string => {
  for (const [re, text] of FRIENDLY) {
    const m = re.exec(message)
    if (m !== null) return text.replace('$1', m[1] ?? '')
  }
  return message
}

/** Validates with the same Zod schema the server uses and maps issues to dotted field paths. */
export const validateCv = (cv: CvDocument): readonly EditorIssue[] => {
  const result = CvDocument.safeParse(cv)
  if (result.success) return []
  return result.error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: friendly(issue.message),
  }))
}

/** Issues for one field, or for any field below a section prefix (e.g. "projects"). */
export const issuesUnder = (issues: readonly EditorIssue[], prefix: string): readonly EditorIssue[] =>
  issues.filter((i) => i.path === prefix || i.path.startsWith(`${prefix}.`))
