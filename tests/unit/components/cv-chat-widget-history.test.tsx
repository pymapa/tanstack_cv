// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CvChatWidget, { type ChatHistory } from '~/components/CvChatWidget'
import type { StoredMessage } from '~/lib/ai/chat-history'

vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ navigate: vi.fn() }) }))

const saved: StoredMessage[] = [
  { id: 'm1', role: 'user', parts: [{ type: 'text', content: 'Who knows Kotlin?' }] },
  { id: 'a1', role: 'assistant', parts: [{ type: 'text', content: 'Try Aino Example.' }] },
]

const fakeHistory = (messages: StoredMessage[] = []) => ({
  load: vi.fn<ChatHistory['load']>(() => Promise.resolve(messages)),
  save: vi.fn<ChatHistory['save']>(() => Promise.resolve()),
  clear: vi.fn<ChatHistory['clear']>(() => Promise.resolve()),
})

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Response('', { status: 200, headers: { 'content-type': 'text/event-stream' } })),
  )
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const openChat = async (history: ChatHistory) => {
  const user = userEvent.setup()
  render(<CvChatWidget history={history} />)
  await user.click(screen.getByRole('button', { name: 'Open CV assistant' }))
  return user
}

describe('CvChatWidget saved history', () => {
  it('should show the saved conversation', async () => {
    await openChat(fakeHistory(saved))

    expect(await screen.findByText('Who knows Kotlin?')).toBeInTheDocument()
    expect(screen.getByText('Try Aino Example.')).toBeInTheDocument()
  })

  it('should save the conversation when the assistant has answered', async () => {
    const history = fakeHistory()
    const user = await openChat(history)
    await waitFor(() => {
      expect(history.load).toHaveBeenCalled()
    })

    await user.type(screen.getByLabelText('Message'), 'Who knows Rust?{Enter}')

    await waitFor(() => {
      expect(history.save).toHaveBeenCalled()
    })
    expect(history.save.mock.calls.at(-1)?.[0]).toEqual([
      expect.objectContaining({ role: 'user', parts: [{ type: 'text', content: 'Who knows Rust?' }] }),
    ])
  })

  it('should save an attached PDF by name only', async () => {
    const history = fakeHistory()
    const user = await openChat(history)
    await waitFor(() => {
      expect(history.load).toHaveBeenCalled()
    })
    await user.upload(
      screen.getByLabelText('Attach a work spec'),
      new File(['%PDF-1.7 spec'], 'spec.pdf', { type: 'application/pdf' }),
    )
    await screen.findByRole('button', { name: 'Remove spec.pdf' })

    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(history.save).toHaveBeenCalled()
    })
    const [message] = history.save.mock.calls.at(-1)?.[0] ?? []
    expect(message?.parts[0]).toEqual({
      type: 'text',
      content: '<work_spec filename="spec.pdf">\n(The file is not kept in the saved chat.)\n</work_spec>',
    })
  })

  it('should not offer to clear an empty chat', async () => {
    const history = fakeHistory()
    await openChat(history)
    await waitFor(() => {
      expect(history.load).toHaveBeenCalled()
    })

    expect(screen.queryByRole('button', { name: 'Clear chat' })).not.toBeInTheDocument()
  })

  it('should delete the saved chat and empty the panel when clearing is confirmed', async () => {
    const history = fakeHistory(saved)
    const user = await openChat(history)
    await screen.findByText('Who knows Kotlin?')

    await user.click(screen.getByRole('button', { name: 'Clear chat' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() => {
      expect(screen.queryByText('Who knows Kotlin?')).not.toBeInTheDocument()
    })
    expect(history.clear).toHaveBeenCalledOnce()
  })

  it('should keep the chat when clearing is cancelled', async () => {
    const history = fakeHistory(saved)
    const user = await openChat(history)
    await screen.findByText('Who knows Kotlin?')

    await user.click(screen.getByRole('button', { name: 'Clear chat' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Who knows Kotlin?')).toBeInTheDocument()
    expect(history.clear).not.toHaveBeenCalled()
  })

  it('should keep the chat and explain when the saved chat cannot be deleted', async () => {
    const history = { ...fakeHistory(saved), clear: vi.fn(() => Promise.reject(new Error('down'))) }
    const user = await openChat(history)
    await screen.findByText('Who knows Kotlin?')

    await user.click(screen.getByRole('button', { name: 'Clear chat' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("The saved chat couldn't be deleted. Try again.")
    expect(screen.getByText('Who knows Kotlin?')).toBeInTheDocument()
  })

  it('should say when the saved chat cannot be loaded', async () => {
    const history = { ...fakeHistory(), load: vi.fn(() => Promise.reject(new Error('down'))) }

    await openChat(history)

    expect(await screen.findByText("Saved chats aren't available right now.")).toBeInTheDocument()
  })

  it('should not replace the saved chat when it could not be loaded', async () => {
    const history = { ...fakeHistory(), load: vi.fn(() => Promise.reject(new Error('down'))) }
    const user = await openChat(history)
    await screen.findByText("Saved chats aren't available right now.")

    await user.type(screen.getByLabelText('Message'), 'Who knows Rust?{Enter}')

    await screen.findByText('Who knows Rust?')
    await waitFor(() => {
      expect(screen.queryByText('Thinking…')).not.toBeInTheDocument()
    })
    expect(history.save).not.toHaveBeenCalled()
  })

  it('should not send a message before the saved chat has loaded', async () => {
    const history = { ...fakeHistory(), load: vi.fn(() => new Promise<StoredMessage[]>(() => undefined)) }
    const user = await openChat(history)

    await user.type(screen.getByLabelText('Message'), 'Who knows Rust?')

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('should delete the saved chat only after a pending save has finished', async () => {
    const order: string[] = []
    let finishSave: () => void = () => undefined
    const history = {
      ...fakeHistory(),
      save: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishSave = () => {
              order.push('saved')
              resolve()
            }
          }),
      ),
      clear: vi.fn(() => {
        order.push('cleared')
        return Promise.resolve()
      }),
    }
    const user = await openChat(history)
    await waitFor(() => {
      expect(history.load).toHaveBeenCalled()
    })
    await user.type(screen.getByLabelText('Message'), 'Who knows Rust?{Enter}')
    await waitFor(() => {
      expect(history.save).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: 'Clear chat' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    finishSave()

    await waitFor(() => {
      expect(order).toEqual(['saved', 'cleared'])
    })
  })
})
