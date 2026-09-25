import type { ContentPart } from '@tanstack/ai'
import { createChatClientOptions, fetchServerSentEvents, useChat } from '@tanstack/ai-react'
import { FileText, Loader2, MessageCircle, Paperclip, Send, Square, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Streamdown } from 'streamdown'

import { chatMarkdownComponents } from '~/components/chat-link'
import { type StoredMessage, toStoredMessages } from '~/lib/ai/chat-history'
import { withoutRepeatedToolCalls } from '~/lib/ai/chat-parts'
import { attachmentName, toWorkSpecPart, WORK_SPEC_ACCEPT } from '~/lib/ai/work-spec'
import { clearChatHistoryFn, getChatHistoryFn, saveChatHistoryFn } from '~/server/functions/chat-history'

const chatOptions = createChatClientOptions({
  connection: fetchServerSentEvents('/api/cv-chat'),
})

const TOOL_LABELS: Record<string, string> = {
  searchPeople: 'Searching CVs',
  getCv: 'Reading a CV',
  linkCvs: 'Linking CVs',
}

const DEFAULT_WORK_SPEC_REQUEST = 'Find suitable CVs for this work spec.'

type Attachment = Readonly<{ name: string; part: ContentPart }>

/** Where the conversation is saved between visits. Injected so tests don't need a server. */
export type ChatHistory = Readonly<{
  load: () => Promise<StoredMessage[]>
  save: (messages: StoredMessage[]) => Promise<void>
  clear: () => Promise<void>
}>

const serverChatHistory: ChatHistory = {
  load: () => getChatHistoryFn(),
  save: (messages) => saveChatHistoryFn({ data: { messages } }),
  clear: () => clearChatHistoryFn(),
}

/** CV assistant chat, floating in the bottom-right corner of every page. */
export default function CvChatWidget({ history = serverChatHistory }: { history?: ChatHistory }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
      {/* Hidden rather than unmounted, so the conversation survives closing. */}
      <ChatPanel
        id={panelId}
        history={history}
        open={open}
        onClose={() => {
          setOpen(false)
        }}
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

function ChatPanel({
  id,
  history,
  open,
  onClose,
}: {
  id: string
  history: ChatHistory
  open: boolean
  onClose: () => void
}) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ReadonlyArray<Attachment>>([])
  const [attachError, setAttachError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const { messages, sendMessage, isLoading, stop, error, setMessages, clear } = useChat(chatOptions)
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const wasLoading = useRef(false)
  const pendingSave = useRef<Promise<void>>(Promise.resolve())
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const attach = async (files: ReadonlyArray<File>) => {
    const results = await Promise.all(files.map(async (file) => ({ file, result: await toWorkSpecPart(file) })))
    const added = results.flatMap(({ file, result }) => (result.ok ? [{ name: file.name, part: result.value }] : []))
    const failed = results.flatMap(({ result }) => (result.ok ? [] : [result.error]))
    setAttachments((current) => [...current, ...added])
    setAttachError(failed.length > 0 ? failed.join(' ') : null)
  }

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Restore the saved conversation once. Sending waits for this, so nothing overwrites it.
  useEffect(() => {
    let cancelled = false
    history.load().then(
      (saved) => {
        if (cancelled) return
        // Stored parts are the UI parts minus attachment content, so they render and resend as-is.
        if (saved.length > 0) setMessages(saved as Parameters<typeof setMessages>[0])
        setHistoryState('ready')
      },
      () => {
        if (cancelled) return
        // Keep chatting, but don't save: that would replace the chat that failed to load.
        setHistoryState('unavailable')
        setHistoryError("Saved chats aren't available right now.")
      },
    )
    return () => {
      cancelled = true
    }
  }, [history, setMessages])

  // Save when an answer has finished (or was stopped).
  useEffect(() => {
    if (wasLoading.current && !isLoading && historyState === 'ready') {
      pendingSave.current = history.save(toStoredMessages(messages)).then(
        () => {
          setHistoryError(null)
        },
        () => {
          setHistoryError("This chat couldn't be saved.")
        },
      )
    }
    wasLoading.current = isLoading
  }, [history, historyState, isLoading, messages])

  const clearChat = async () => {
    try {
      // A save still in flight would otherwise write the chat back after the delete.
      await pendingSave.current
      await history.clear()
      clear()
      setHistoryError(null)
    } catch {
      setHistoryError("The saved chat couldn't be deleted. Try again.")
    }
    setConfirmingClear(false)
  }

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, onClose])

  // Keep the newest message in view as it streams in.
  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const canSend = historyState !== 'loading' && (input.trim() !== '' || attachments.length > 0)

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!canSend || isLoading) return
    const text = input.trim()
    if (attachments.length === 0) {
      void sendMessage(text)
    } else {
      void sendMessage({
        content: [...attachments.map((a) => a.part), { type: 'text', content: text || DEFAULT_WORK_SPEC_REQUEST }],
      })
    }
    setInput('')
    setAttachments([])
    setAttachError(null)
  }

  return (
    <section
      id={id}
      hidden={!open}
      aria-label="CV assistant"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        void attach([...e.dataTransfer.files])
      }}
      className={`flex h-[32rem] [&[hidden]]:hidden max-h-[calc(100vh-7rem)] w-[26rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border bg-white text-black shadow-2xl ${
        dragging ? 'border-2 border-dashed border-teal' : 'border-neutral-200'
      }`}
    >
      <header className="flex min-h-14 items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2">
        <h2 className="m-0 text-base font-semibold text-black">CV assistant</h2>
        {confirmingClear ? (
          <div role="group" aria-label="Clear this chat?" className="flex items-center gap-2 text-sm">
            <span>Clear this chat?</span>
            <button
              type="button"
              onClick={() => {
                void clearChat()
              }}
              className="rounded-lg bg-ink px-3 py-1 text-white"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingClear(false)
              }}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-black"
            >
              Cancel
            </button>
          </div>
        ) : (
          messages.length > 0 &&
          !isLoading && (
            <button
              type="button"
              onClick={() => {
                setConfirmingClear(true)
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              Clear chat
            </button>
          )
        )}
      </header>

      <div aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="m-0 text-sm text-neutral-700">
            Ask who fits a client need, for example "Who has led agile teams in insurance?" You can also drop a work
            spec here (PDF, .txt or .md).
          </p>
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            aria-label={message.role === 'user' ? 'You' : 'Assistant'}
            className={`max-w-[85%] rounded-xl p-3 text-sm ${
              message.role === 'user' ? 'self-end bg-neutral-100' : 'self-start'
            }`}
          >
            {withoutRepeatedToolCalls(message.parts).map((part, index) => {
              const fileName = message.role === 'user' ? attachmentName(part) : null
              if (fileName !== null) {
                return (
                  <p
                    // biome-ignore lint/suspicious/noArrayIndexKey: parts have no stable id
                    key={index}
                    className="m-0 mb-2 flex items-center gap-2 rounded-lg bg-white px-2 py-1 text-neutral-700"
                  >
                    <FileText aria-hidden className="h-4 w-4 shrink-0" />
                    <span>{fileName}</span>
                  </p>
                )
              }
              if (part.type === 'text' && part.content) {
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: parts have no stable id
                    key={index}
                    className="prose prose-sm max-w-none"
                  >
                    <Streamdown components={chatMarkdownComponents}>{part.content}</Streamdown>
                  </div>
                )
              }
              if (part.type === 'tool-call') {
                return (
                  <p key={part.id} className="m-0 italic text-neutral-700">
                    {TOOL_LABELS[part.name] ?? part.name}…
                  </p>
                )
              }
              return null
            })}
          </article>
        ))}
        {isLoading && (
          <p className="m-0 flex items-center gap-2 text-sm text-neutral-700">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            Thinking…
          </p>
        )}
        {historyError !== null && (
          <p role="alert" className="m-0 text-sm text-red-700">
            {historyError}
          </p>
        )}
        {error && (
          <p role="alert" className="m-0 text-sm text-red-700">
            Something went wrong: {error.message}
          </p>
        )}
        <div ref={endRef} />
      </div>

      {(attachments.length > 0 || attachError !== null) && (
        <div className="flex flex-col gap-2 border-t border-neutral-200 px-3 pt-3">
          {attachError !== null && (
            <p role="alert" className="m-0 text-sm text-red-700">
              {attachError}
            </p>
          )}
          {attachments.length > 0 && (
            <ul aria-label="Attached work specs" className="m-0 flex list-none flex-wrap gap-2 p-0">
              {attachments.map((a, index) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: the same file may be attached twice
                  key={index}
                  className="flex items-center gap-1 rounded-full bg-neutral-100 py-1 pr-1 pl-3 text-sm"
                >
                  <FileText aria-hidden className="h-4 w-4" />
                  {a.name}
                  <button
                    type="button"
                    onClick={() => {
                      setAttachments((current) => current.filter((_, i) => i !== index))
                    }}
                    aria-label={`Remove ${a.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-neutral-200"
                  >
                    <X aria-hidden className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={submit} className="flex gap-2 border-t border-neutral-200 p-3">
        <label
          htmlFor={`${id}-file`}
          title="Attach a work spec (PDF, .txt or .md)"
          className="flex w-10 cursor-pointer items-center justify-center rounded-xl border border-neutral-300 text-black focus-within:outline focus-within:outline-2 focus-within:outline-teal"
        >
          <Paperclip aria-hidden className="h-4 w-4" />
          <span className="sr-only">Attach a work spec</span>
          <input
            id={`${id}-file`}
            type="file"
            accept={WORK_SPEC_ACCEPT}
            multiple
            onChange={(e) => {
              void attach([...(e.target.files ?? [])])
              e.target.value = ''
            }}
            className="sr-only"
            data-testid="chat-attach-input"
          />
        </label>
        <label htmlFor={`${id}-input`} className="sr-only">
          Message
        </label>
        <textarea
          id={`${id}-input`}
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e)
          }}
          rows={2}
          placeholder="Ask about people, skills or clients…"
          className="flex-1 resize-none rounded-xl border border-neutral-300 bg-white p-2 text-sm text-black placeholder:text-neutral-500"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop"
            className="flex w-10 items-center justify-center rounded-xl border border-neutral-300 text-black"
          >
            <Square aria-hidden className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            className="flex w-10 items-center justify-center rounded-xl bg-ink text-white disabled:opacity-50"
          >
            <Send aria-hidden className="h-4 w-4" />
          </button>
        )}
      </form>
    </section>
  )
}
