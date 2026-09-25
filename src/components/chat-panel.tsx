import type { AnyClientTool, ContentPart } from '@tanstack/ai'
import { createChatClientOptions, fetchServerSentEvents, useChat } from '@tanstack/ai-react'
import { FileText, Loader2, Paperclip, Send, Square, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Streamdown } from 'streamdown'

import { chatMarkdownComponents } from '~/components/chat-link'
import { type StoredMessage, toStoredMessages } from '~/lib/ai/chat-history'
import { endedBeforeAnswer, withoutRepeatedToolCalls } from '~/lib/ai/chat-parts'
import { attachmentName, type AttachmentTag, toAttachmentPart, WORK_SPEC_ACCEPT } from '~/lib/ai/work-spec'

type Attachment = Readonly<{ name: string; part: ContentPart }>

/** Where the conversation is saved between visits. Injected so tests don't need a server. */
export type ChatHistory = Readonly<{
  load: () => Promise<StoredMessage[]>
  save: (messages: StoredMessage[]) => Promise<void>
  clear: () => Promise<void>
}>

const NO_TOOLS: ReadonlyArray<AnyClientTool> = []

export type ChatPanelProps = Readonly<{
  id: string
  /** Heading and accessible name of the panel. */
  title: string
  /** The agent's chat route, e.g. "/api/cv-chat". */
  endpoint: string
  /** Browser-side tools the agent may call. Keep the array stable across renders. */
  tools?: ReadonlyArray<AnyClientTool>
  /** Saves the conversation between visits. Without it the chat lasts as long as the page. */
  history?: ChatHistory
  /** Progress text shown while a tool runs, by tool name. */
  toolLabels: Readonly<Record<string, string>>
  /** Shown before the first message. */
  intro: ReactNode
  placeholder: string
  attachment: Readonly<{
    /** Accessible name of the attach button, e.g. "Attach a work spec". */
    label: string
    /** Accessible name of the list of pending attachments. */
    listLabel: string
    tag: AttachmentTag
    /** Sent when the user attaches files without typing a message. */
    defaultRequest: string
  }>
  /** false hides the panel but keeps the conversation. */
  open?: boolean
  /** Called on Escape. Leave it out when the panel can't be closed. */
  onClose?: () => void
  /** Focus the message box whenever the panel opens. */
  focusOnOpen?: boolean
  /** Size, border and shadow of the panel. */
  className: string
}>

/** A chat with one agent: messages, tool progress, file attachments and the message box. */
export function ChatPanel({
  id,
  title,
  endpoint,
  tools = NO_TOOLS,
  history,
  toolLabels,
  intro,
  placeholder,
  attachment,
  open = true,
  onClose,
  focusOnOpen = false,
  className,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ReadonlyArray<Attachment>>([])
  const [attachError, setAttachError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const options = useMemo(
    () => createChatClientOptions({ connection: fetchServerSentEvents(endpoint), tools }),
    [endpoint, tools],
  )
  const { messages, sendMessage, isLoading, stop, error, setMessages, clear } = useChat(options)
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'unavailable'>(
    history === undefined ? 'ready' : 'loading',
  )
  const wasLoading = useRef(false)
  const pendingSave = useRef<Promise<void>>(Promise.resolve())
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const attach = async (files: ReadonlyArray<File>) => {
    const results = await Promise.all(
      files.map(async (file) => ({ file, result: await toAttachmentPart(file, attachment.tag) })),
    )
    const added = results.flatMap(({ file, result }) => (result.ok ? [{ name: file.name, part: result.value }] : []))
    const failed = results.flatMap(({ result }) => (result.ok ? [] : [result.error]))
    setAttachments((current) => [...current, ...added])
    setAttachError(failed.length > 0 ? failed.join(' ') : null)
  }

  useEffect(() => {
    if (open && focusOnOpen) inputRef.current?.focus()
  }, [open, focusOnOpen])

  // Restore the saved conversation once. Sending waits for this, so nothing overwrites it.
  useEffect(() => {
    if (history === undefined) return
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
    if (history !== undefined && wasLoading.current && !isLoading && historyState === 'ready') {
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
      await history?.clear()
      clear()
      setHistoryError(null)
    } catch {
      setHistoryError("The saved chat couldn't be deleted. Try again.")
    }
    setConfirmingClear(false)
  }

  useEffect(() => {
    if (!open || onClose === undefined) return
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
        content: [...attachments.map((a) => a.part), { type: 'text', content: text || attachment.defaultRequest }],
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
      aria-label={title}
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
      className={`flex [&[hidden]]:hidden flex-col overflow-hidden bg-white text-black ${className} ${
        dragging ? 'border-2 border-dashed border-teal' : 'border-neutral-200'
      }`}
    >
      <header className="flex min-h-14 items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2">
        <h2 className="m-0 text-base font-semibold text-black">{title}</h2>
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
        {messages.length === 0 && <p className="m-0 text-sm text-neutral-700">{intro}</p>}
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
                    {toolLabels[part.name] ?? part.name}…
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
        {!isLoading && !error && endedBeforeAnswer(messages) && (
          <p role="alert" className="m-0 text-sm text-red-700">
            The assistant stopped before it finished. Send a message to continue.
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
            <ul aria-label={attachment.listLabel} className="m-0 flex list-none flex-wrap gap-2 p-0">
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
          title={`${attachment.label} (PDF, .txt or .md)`}
          className="flex w-10 cursor-pointer items-center justify-center rounded-xl border border-neutral-300 text-black focus-within:outline focus-within:outline-2 focus-within:outline-teal"
        >
          <Paperclip aria-hidden className="h-4 w-4" />
          <span className="sr-only">{attachment.label}</span>
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
          placeholder={placeholder}
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
