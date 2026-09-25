import { createContext, useContext, type ReactNode } from 'react'
import type { CvDocument } from '~/cv/schema'
import type { Path } from './update'
import type { EditorIssue } from './validation'

type EditorContextValue = Readonly<{
  cv: CvDocument
  set: (path: Path, value: unknown) => void
  issues: readonly EditorIssue[]
}>

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({ value, children }: { value: EditorContextValue; children: ReactNode }) {
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export const useEditor = (): EditorContextValue => {
  const ctx = useContext(EditorContext)
  if (ctx === null) throw new Error('useEditor must be used inside <EditorProvider>')
  return ctx
}
