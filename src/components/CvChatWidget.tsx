import { MessageCircle, X } from 'lucide-react'
import { useId, useState } from 'react'

import { type ChatHistory, ChatPanel } from '~/components/chat-panel'
import { clearChatHistoryFn, getChatHistoryFn, saveChatHistoryFn } from '~/server/functions/chat-history'

export type { ChatHistory }

const TOOL_LABELS: Record<string, string> = {
  searchPeople: 'Searching CVs',
  getCv: 'Reading a CV',
  linkCvs: 'Linking CVs',
}

const WORK_SPEC_ATTACHMENT = {
  label: 'Attach a work spec',
  listLabel: 'Attached work specs',
  tag: 'work_spec',
  defaultRequest: 'Find suitable CVs for this work spec.',
} as const

const serverChatHistory: ChatHistory = {
  load: () => getChatHistoryFn(),
  save: (messages) => saveChatHistoryFn({ data: { messages } }),
  clear: () => clearChatHistoryFn(),
}

type Props = Readonly<{
  history?: ChatHistory
  /** Hides the widget on pages with their own agent. It stays mounted, so the chat is kept. */
  hidden?: boolean
}>

/** CV bank assistant chat, floating in the bottom-right corner of every page. */
export default function CvChatWidget({ history = serverChatHistory, hidden = false }: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div hidden={hidden} className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 [&[hidden]]:hidden">
      {/* Hidden rather than unmounted, so the conversation survives closing. */}
      <ChatPanel
        id={panelId}
        title="CV assistant"
        endpoint="/api/cv-chat"
        history={history}
        toolLabels={TOOL_LABELS}
        intro={
          <>
            Ask who fits a client need, for example "Who has led agile teams in insurance?" You can also drop a work
            spec here (PDF, .txt or .md).
          </>
        }
        placeholder="Ask about people, skills or clients…"
        attachment={WORK_SPEC_ATTACHMENT}
        open={open && !hidden}
        onClose={() => {
          setOpen(false)
        }}
        focusOnOpen
        className="h-[32rem] max-h-[calc(100vh-7rem)] w-[26rem] max-w-[calc(100vw-2rem)] rounded-2xl border shadow-2xl"
      />
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
        }}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Close CV assistant' : 'Open CV assistant'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-lg transition hover:opacity-90"
      >
        {open ? <X aria-hidden className="h-6 w-6" /> : <MessageCircle aria-hidden className="h-6 w-6" />}
      </button>
    </div>
  )
}
